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
  it("un solo componente: root centrado, hijos equidistantes", () => {
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

    expect(Math.abs(R.x - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(R.y - height / 2)).toBeLessThanOrEqual(1);
    expect(dist(R, A)).toBeGreaterThan(0);
    expect(Math.abs(dist(R, A) - dist(R, B))).toBeLessThan(1e-6);
  });

  it("root = nodo sin incoming (no A/B)", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("B")],
      edges: [
        { from: "R", to: "A", rel: "has" },
        { from: "R", to: "B", rel: "has" },
      ],
    };
    const { width, height, positions } = layoutEntityGraph(graph);
    const A = positions.get("A")!;
    const B = positions.get("B")!;
    const offCenter = (p: { x: number; y: number }) =>
      Math.abs(p.x - width / 2) > 1 || Math.abs(p.y - height / 2) > 1;
    expect(offCenter(A)).toBe(true);
    expect(offCenter(B)).toBe(true);
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
    expect(Math.abs(A.x - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(A.y - height / 2)).toBeLessThanOrEqual(1);
  });

  it("agrupamiento no dirigido: External sameAs cae en el mismo componente", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("E", "External")],
      edges: [{ from: "R", to: "E", rel: "sameAs" }],
    };
    const { width, height, positions } = layoutEntityGraph(graph);
    expect(positions.size).toBe(2);
    const center = { x: width / 2, y: height / 2 };
    const maxRadius = Math.max(...[...positions.values()].map((p) => dist(center, p)));
    for (const p of positions.values()) {
      expect(dist(center, p)).toBeLessThanOrEqual(maxRadius * 1.5 + 1e-9);
    }
    // E enlazado a R (no root) queda descentrado dentro de la misma celda
    const E = positions.get("E")!;
    expect(dist(center, E)).toBeGreaterThan(0);
  });

  it("multiples componentes sin solape", () => {
    const graph: EntityGraph = {
      nodes: [node("R1"), node("A1"), node("R2"), node("A2")],
      edges: [
        { from: "R1", to: "A1", rel: "r" },
        { from: "R2", to: "A2", rel: "r" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);
    const R1 = positions.get("R1")!;
    const R2 = positions.get("R2")!;
    expect(R1.x !== R2.x || R1.y !== R2.y).toBe(true);

    const bbox = (ids: string[]) => {
      const pts = ids.map((id) => positions.get(id)!);
      return {
        minx: Math.min(...pts.map((p) => p.x)),
        maxx: Math.max(...pts.map((p) => p.x)),
        miny: Math.min(...pts.map((p) => p.y)),
        maxy: Math.max(...pts.map((p) => p.y)),
      };
    };
    const b1 = bbox(["R1", "A1"]);
    const b2 = bbox(["R2", "A2"]);
    const disjoint =
      b1.maxx < b2.minx || b2.maxx < b1.minx || b1.maxy < b2.miny || b2.maxy < b1.miny;
    expect(disjoint).toBe(true);
  });

  it("grid con 2 filas: alto mayor que un solo componente", () => {
    const single = layoutEntityGraph({
      nodes: [node("S")],
      edges: [],
    });
    // 3 componentes → 2 columnas × 2 filas
    const threeComponents: EntityGraph = {
      nodes: [node("R1"), node("R2"), node("R3")],
      edges: [],
    };
    const multi = layoutEntityGraph(threeComponents);
    expect(multi.height).toBeGreaterThan(single.height);
  });

  it("anillos por BFS: nieto en anillo exterior", () => {
    const graph: EntityGraph = {
      nodes: [node("R"), node("A"), node("C")],
      edges: [
        { from: "R", to: "A", rel: "r" },
        { from: "A", to: "C", rel: "r" },
      ],
    };
    const { width, height, positions } = layoutEntityGraph(graph);
    const center = { x: width / 2, y: height / 2 };
    const A = positions.get("A")!;
    const C = positions.get("C")!;
    expect(dist(center, A)).toBeGreaterThan(0);
    expect(dist(center, C)).toBeGreaterThan(dist(center, A));
  });

  it("multi-componente con profundidad >= 2: anillos distintos y sin coincidencias", () => {
    // Dos componentes independientes fuerzan columns = 2 (celda más chica). Cada
    // uno es una cadena de profundidad 2 (R→A→C). Antes, con constantes fijas de
    // anillo, A (nivel 1) y C (nivel 2) saturaban al mismo radio y coincidían.
    const graph: EntityGraph = {
      nodes: [node("R1"), node("A1"), node("C1"), node("R2"), node("A2"), node("C2")],
      edges: [
        { from: "R1", to: "A1", rel: "r" },
        { from: "A1", to: "C1", rel: "r" },
        { from: "R2", to: "A2", rel: "r" },
        { from: "A2", to: "C2", rel: "r" },
      ],
    };
    const { positions } = layoutEntityGraph(graph);

    const chains: Array<[string, string, string]> = [
      ["R1", "A1", "C1"],
      ["R2", "A2", "C2"],
    ];
    for (const [rId, aId, cId] of chains) {
      const center = positions.get(rId)!;
      const A = positions.get(aId)!;
      const C = positions.get(cId)!;
      // Anillos distintos: nivel 2 estrictamente más lejos del centro que nivel 1.
      expect(dist(center, A)).toBeGreaterThan(0);
      expect(dist(center, C)).toBeGreaterThan(dist(center, A));
    }

    // Ningún par de nodos comparte coordenada exacta.
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(dist(pts[i]!, pts[j]!)).toBeGreaterThan(1e-6);
      }
    }
  });

  it("relajacion por fuerzas: hub denso sin nodos encimados", () => {
    // Un root con muchos hijos: la relajación debe dejarlos separados (centros a
    // más de un radio de nodo entre sí), sin colapsos.
    const kids = ["A", "B", "C", "D", "E", "F"];
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

  it("determinismo: dos llamadas producen Maps identicos", () => {
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

  it("grafo vacio: no lanza, size 0, dimensiones finitas > 0", () => {
    const { width, height, positions } = layoutEntityGraph({ nodes: [], edges: [] });
    expect(positions.size).toBe(0);
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(0);
  });
});
