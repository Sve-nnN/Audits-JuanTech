import { describe, expect, it } from "vitest";
import type { EntityGraph, EntityGraphNode } from "@auditor/checks";
import { NODE_RADIUS, layoutEntityGraph } from "./entityGraphLayout";

function node(id: string, type = "Thing", label = id): EntityGraphNode {
  return { id, type, label };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("layoutEntityGraph", () => {
  it("un solo componente: root centrado en su banda, hijos equidistantes", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("B")],
      edges: [
        { from: "R", to: "A", rel: "has" },
        { from: "R", to: "B", rel: "has" },
      ],
    };
    const { width, height, positions } = layoutEntityGraph(graph);
    const R = positions.get("R")!;
    const A = positions.get("A")!;
    const B = positions.get("B")!;

    // Root al centro horizontal y al centro de la (única) banda.
    expect(Math.abs(R.x - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(R.y - height / 2)).toBeLessThanOrEqual(1);
    expect(R.isRoot).toBe(true);
    // Hijos equidistantes del root (mismo anillo).
    expect(dist(R, A)).toBeGreaterThan(0);
    expect(Math.abs(dist(R, A) - dist(R, B))).toBeLessThan(1e-6);
    expect(A.isRoot).toBe(false);
  });

  it("anillo uniforme: N hijos con espaciado angular igual", () => {
    const kids = ["A", "B", "C", "D"];
    const graph: EntityGraph = {
      nodes: [node("R"), ...kids.map((k) => node(k))],
      edges: kids.map((k) => ({ from: "R", to: k, rel: "has" })),
    };
    const { positions } = layoutEntityGraph(graph);
    const R = positions.get("R")!;
    // Todos a igual radio del centro.
    const radii = kids.map((k) => dist(R, positions.get(k)!));
    for (const r of radii) expect(Math.abs(r - radii[0]!)).toBeLessThan(1e-6);
    // Ángulos uniformes: la distancia entre vecinos consecutivos es constante.
    const pts = kids.map((k) => positions.get(k)!);
    const gaps = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]!));
    for (const g of gaps) expect(Math.abs(g - gaps[0]!)).toBeLessThan(1e-6);
  });

  it("root = nodo sin incoming (no A/B)", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("B")],
      edges: [
        { from: "R", to: "A", rel: "has" },
        { from: "R", to: "B", rel: "has" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);
    expect(positions.get("R")!.isRoot).toBe(true);
    expect(positions.get("A")!.isRoot).toBe(false);
    expect(positions.get("B")!.isRoot).toBe(false);
  });

  it("tie-break determinista en ciclo: root = primero en nodes", () => {
    const graph: EntityGraph = {
      nodes: [node("A"), node("B")],
      edges: [
        { from: "A", to: "B", rel: "r" },
        { from: "B", to: "A", rel: "r" },
      ],
    };
    const { width, height, positions } = layoutEntityGraph(graph);
    const A = positions.get("A")!;
    expect(A.isRoot).toBe(true);
    expect(Math.abs(A.x - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(A.y - height / 2)).toBeLessThanOrEqual(1);
  });

  it("agrupamiento no dirigido: External sameAs cae en el mismo componente", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("E", "External")],
      edges: [{ from: "R", to: "E", rel: "sameAs" }],
    };
    const { positions } = layoutEntityGraph(graph);
    expect(positions.size).toBe(2);
    // Un solo componente ⇒ E queda en el anillo del mismo root.
    expect(positions.get("R")!.isRoot).toBe(true);
    expect(dist(positions.get("R")!, positions.get("E")!)).toBeGreaterThan(0);
  });

  it("multiples componentes: bandas apiladas sin solaparse verticalmente", () => {
    const graph: EntityGraph = {
      nodes: [node("R1"), node("A1"), node("R2"), node("A2")],
      edges: [
        { from: "R1", to: "A1", rel: "r" },
        { from: "R2", to: "A2", rel: "r" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);

    const bbox = (ids: string[]) => {
      const pts = ids.map((id) => positions.get(id)!);
      return {
        miny: Math.min(...pts.map((p) => p.y)),
        maxy: Math.max(...pts.map((p) => p.y)),
      };
    };
    const b1 = bbox(["R1", "A1"]);
    const b2 = bbox(["R2", "A2"]);
    // Componente 1 arriba, componente 2 abajo, con un pasillo vertical entre medio.
    const verticalGap = b2.miny - b1.maxy;
    expect(verticalGap).toBeGreaterThan(40);
  });

  it("apilado vertical: mas componentes ⇒ mas alto", () => {
    const single = layoutEntityGraph({ nodes: [node("S")], edges: [] });
    const three = layoutEntityGraph({
      nodes: [node("R1"), node("R2"), node("R3")],
      edges: [],
    });
    expect(three.height).toBeGreaterThan(single.height);
  });

  it("anillos concentricos por nivel: nieto en anillo exterior", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("C")],
      edges: [
        { from: "R", to: "A", rel: "r" },
        { from: "A", to: "C", rel: "r" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);
    const R = positions.get("R")!;
    const A = positions.get("A")!;
    const C = positions.get("C")!;
    expect(dist(R, A)).toBeGreaterThan(0);
    expect(dist(R, C)).toBeGreaterThan(dist(R, A));
  });

  it("cadena profunda (depth 4): radios estrictamente crecientes, sin coincidencias", () => {
    // Regresión del bug real: una cadena de hijo único (R→A→B→C→D) NO debe apilar
    // nodos en el mismo radio/coordenada (antes los niveles se topaban al radio
    // máximo y caían en el mismo punto). Cada profundidad queda a un radio mayor.
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("B"), node("C"), node("D")],
      edges: [
        { from: "R", to: "A", rel: "r" },
        { from: "A", to: "B", rel: "r" },
        { from: "B", to: "C", rel: "r" },
        { from: "C", to: "D", rel: "r" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);
    const R = positions.get("R")!;
    const radii = ["A", "B", "C", "D"].map((id) => dist(R, positions.get(id)!));
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThan(radii[i - 1]!); // estrictamente creciente por profundidad
    }
    // Ningún par de nodos comparte (casi) la misma coordenada.
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(dist(pts[i]!, pts[j]!)).toBeGreaterThan(NODE_RADIUS);
      }
    }
  });

  it("determinismo: dos llamadas producen posiciones identicas", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("B"), node("C")],
      edges: [
        { from: "R", to: "A", rel: "r" },
        { from: "R", to: "B", rel: "r" },
        { from: "A", to: "C", rel: "r" },
      ],
    };
    const a = layoutEntityGraph(graph);
    const b = layoutEntityGraph(graph);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect([...a.positions.keys()]).toEqual([...b.positions.keys()]);
    for (const [k, v] of a.positions) {
      expect(b.positions.get(k)).toEqual(v);
    }
  });

  it("nodos del anillo sin encimarse (centros a > NODE_RADIUS)", () => {
    const kids = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const graph: EntityGraph = {
      nodes: [node("R"), ...kids.map((k) => node(k))],
      edges: kids.map((k) => ({ from: "R", to: k, rel: "has" })),
    };
    const { positions } = layoutEntityGraph(graph);
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(dist(pts[i]!, pts[j]!)).toBeGreaterThan(NODE_RADIUS);
      }
    }
  });

  it("grafo vacio: no lanza, size 0, dimensiones finitas > 0", () => {
    const { width, height, positions } = layoutEntityGraph({ nodes: [], edges: [] });
    expect(positions.size).toBe(0);
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(0);
  });
});
