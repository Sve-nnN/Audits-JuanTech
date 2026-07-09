"use client";

import type { ReportArchitecture } from "@auditor/report-model";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { ArchitectureTreeSvg } from "./ArchitectureTreeSvg";
import styles from "./ArchitectureMap.module.css";

/** Escala acotada del viewport: nunca por debajo de 0.2x ni por encima de 3x. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
/** Factor de zoom por “tick” de rueda o botón (~10%). */
const ZOOM_STEP = 1.1;
/** Paso de pan por pulsación de flecha (px, en coordenadas de pantalla). */
const PAN_STEP = 40;
/** Margen alrededor del árbol al encuadrar (fit-to-view). */
const FIT_PADDING = 24;

interface ViewState {
  x: number;
  y: number;
  k: number;
}

interface ArchitectureMapProps {
  architecture: ReportArchitecture;
}

function clampScale(k: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, k));
}

/**
 * Viewport cliente que envuelve `ArchitectureTreeSvg` (reusado SIN cambios) y lo
 * convierte en un mapa navegable con zoom (rueda hacia el cursor + botones,
 * acotado 0.2-3x), pan (arrastrar con pointer + teclado) y reajuste (fit-to-view).
 * Cero dependencias externas: es un `transform: translate scale` puro sobre un
 * `stage`, movido por estado de React. El `stage` neutraliza el cap
 * `--container-narrow` del `.canvas` del árbol (ver CSS) para dibujarlo a tamaño
 * natural y navegarlo. La transición del transform vive en CSS y se anula bajo
 * `prefers-reduced-motion`, así que aquí no hace falta lógica de motion.
 */
export function ArchitectureMap({ architecture }: ArchitectureMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [view, setView] = useState<ViewState>({ x: 0, y: 0, k: 1 });
  const [grabbing, setGrabbing] = useState(false);

  // Estado de "fit" para el botón Reajustar; se recalcula al medir (ver abajo).
  const fitRef = useRef<ViewState>({ x: 0, y: 0, k: 1 });
  // Origen del arrastre en curso (coords de pantalla + view al iniciar).
  const dragRef = useRef<{ pointerId: number; sx: number; sy: number; ox: number; oy: number } | null>(null);

  /** Mide el tamaño natural del árbol y del viewport y calcula un encuadre centrado. */
  const computeFit = useCallback((): ViewState => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!viewport || !stage) return { x: 0, y: 0, k: 1 };
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    // scrollWidth/Height del stage = tamaño natural del svg (sin cap por el CSS).
    const cw = stage.scrollWidth;
    const ch = stage.scrollHeight;
    if (cw === 0 || ch === 0) return { x: 0, y: 0, k: 1 };
    const k = clampScale(
      Math.min((vw - FIT_PADDING * 2) / cw, (vh - FIT_PADDING * 2) / ch, 1)
    );
    const x = (vw - cw * k) / 2;
    const y = (vh - ch * k) / 2;
    return { x, y, k };
  }, []);

  const applyFit = useCallback(() => {
    const fit = computeFit();
    fitRef.current = fit;
    setView(fit);
  }, [computeFit]);

  // Fit inicial una vez montado (el svg ya tiene tamaño natural en el DOM).
  useEffect(() => {
    applyFit();
    // Re-encuadrar si el viewport cambia de tamaño (responsive), respetando
    // solo el estado inicial: recalculamos el fit de referencia.
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      fitRef.current = computeFit();
    });
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [applyFit, computeFit]);

  /** Zoom fijando el punto (px, py) relativo al viewport (transformOrigin 0 0). */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((prev) => {
      const k2 = clampScale(prev.k * factor);
      if (k2 === prev.k) return prev;
      const ratio = k2 / prev.k;
      const x2 = px - (px - prev.x) * ratio;
      const y2 = py - (py - prev.y) * ratio;
      return { x: x2, y: y2, k: k2 };
    });
  }, []);

  /** Zoom centrado en el centro del viewport (botones + / - y teclado). */
  const zoomCenter = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      zoomAt(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAt]
  );

  // Rueda: listener NO pasivo para poder llamar preventDefault y no scrollear la
  // página. React onWheel es pasivo (preventDefault no surte efecto), así que se
  // registra a mano sobre el ref con { passive: false }.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(factor, px, py);
    }
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Solo botón principal / touch / lápiz; ignorar clicks en los controles.
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.controls}`)) return;
    dragRef.current = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: view.x,
      oy: view.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setGrabbing(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    setView((prev) => ({ ...prev, x: drag.ox + dx, y: drag.oy + dy }));
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setGrabbing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // El pointer pudo soltarse fuera; capturarlo puede fallar, sin efecto.
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "+":
      case "=":
        e.preventDefault();
        zoomCenter(ZOOM_STEP);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomCenter(1 / ZOOM_STEP);
        break;
      case "0":
        e.preventDefault();
        setView(fitRef.current);
        break;
      case "ArrowUp":
        e.preventDefault();
        setView((p) => ({ ...p, y: p.y + PAN_STEP }));
        break;
      case "ArrowDown":
        e.preventDefault();
        setView((p) => ({ ...p, y: p.y - PAN_STEP }));
        break;
      case "ArrowLeft":
        e.preventDefault();
        setView((p) => ({ ...p, x: p.x + PAN_STEP }));
        break;
      case "ArrowRight":
        e.preventDefault();
        setView((p) => ({ ...p, x: p.x - PAN_STEP }));
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport}${grabbing ? ` ${styles.grabbing}` : ""}`}
      tabIndex={0}
      role="application"
      aria-label="Mapa de arquitectura navegable"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlBtn}
          aria-label="Acercar"
          onClick={() => zoomCenter(ZOOM_STEP)}
        >
          <Plus size={18} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.controlBtn}
          aria-label="Alejar"
          onClick={() => zoomCenter(1 / ZOOM_STEP)}
        >
          <Minus size={18} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.controlBtn}
          aria-label="Reajustar vista"
          onClick={applyFit}
        >
          <Maximize2 size={18} aria-hidden />
        </button>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: "0 0",
        }}
      >
        <ArchitectureTreeSvg architecture={architecture} />
      </div>
    </div>
  );
}
