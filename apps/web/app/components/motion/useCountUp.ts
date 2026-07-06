"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Geometría opcional del arco del ScoreGauge. Cuando se provee, el hook anima
 * la custom prop `--gauge-offset` del elemento referenciado desde `from`
 * (círculo vacío = circumference) hasta `to` (offset final), en paralelo al
 * count-up numérico. El hook NO conoce la geometría interna del gauge: solo
 * recibe los dos valores finales y anima la custom prop registrada
 * (@property --gauge-offset en globals.css).
 */
interface GaugeArc {
  /** stroke-dashoffset inicial (arco vacío). Normalmente = circumference. */
  from: number;
  /** stroke-dashoffset final (arco lleno al ratio del score). */
  to: number;
}

interface UseCountUpOptions {
  /** Duración en ms. Default: 900 (equivale a --motion-count). */
  duration?: number;
  /** Si es false, el hook no anima y devuelve el target final. Default: true. */
  enabled?: boolean;
  /** Geometría del arco a animar vía WAAPI sobre --gauge-offset. */
  gauge?: GaugeArc;
}

interface UseCountUpResult<T extends Element> {
  /** Número interpolado 0→target (o target directo con reduced-motion). */
  value: number;
  /** Ref a adjuntar al elemento observado/animable (svg/circle del gauge). */
  ref: RefObject<T | null>;
}

/** Ease-out cúbico, espejo de --ease-out (cubic-bezier(0.22,1,0.36,1)). */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * useCountUp — anima un número de 0 a `target` (y, opcionalmente, el arco del
 * ScoreGauge vía --gauge-offset) cuando el elemento entra al viewport, una sola
 * vez. CSS + WAAPI/rAF, sin librerías.
 *
 * Contratos:
 *   - Client-safe: mounted-guard (patrón ThemeToggle) → sin hydration mismatch.
 *   - Dispara UNA sola vez al intersectar el viewport (no en mount).
 *   - Con prefers-reduced-motion: devuelve `target` de inmediato y deja el arco
 *     en su offset final sin barrido (el ScoreGauge ya renderiza el offset final
 *     en su inline style, así que no se toca).
 *   - Limpia rAF/observer/animation en cleanup.
 */
export function useCountUp<T extends Element = HTMLElement>(
  target: number,
  opts: UseCountUpOptions = {},
): UseCountUpResult<T> {
  const { duration = 900, enabled = true, gauge } = opts;

  const ref = useRef<T | null>(null);
  const [mounted, setMounted] = useState(false);
  // SSR y primer render: valor final (evita mismatch y garantiza que sin JS el
  // número correcto ya esté presente). El barrido de 0→target ocurre en cliente.
  const [value, setValue] = useState(target);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const node = ref.current;

    // Sin animación: reduced-motion, deshabilitado o sin soporte de observer.
    if (
      !enabled ||
      prefersReducedMotion() ||
      typeof IntersectionObserver === "undefined" ||
      !node
    ) {
      setValue(target);
      return;
    }

    let rafId: number | null = null;
    let startTs: number | null = null;
    let gaugeAnim: Animation | null = null;
    let triggered = false;

    const runCount = () => {
      const step = (ts: number) => {
        if (startTs === null) startTs = ts;
        const elapsed = ts - startTs;
        const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
        const eased = easeOutCubic(progress);
        setValue(Math.round(target * eased));
        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setValue(target);
          rafId = null;
        }
      };
      rafId = requestAnimationFrame(step);
    };

    const runGauge = () => {
      if (!gauge || typeof node.animate !== "function") return;
      gaugeAnim = node.animate(
        [
          { "--gauge-offset": String(gauge.from) },
          { "--gauge-offset": String(gauge.to) },
        ] as Keyframe[],
        {
          duration,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );
    };

    // Estado inicial pre-trigger: número en 0 (el arco parte de su inline style
    // final; WAAPI lo llevará de from→to al disparar).
    setValue(0);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggered) {
            triggered = true;
            observer.unobserve(entry.target);
            runCount();
            runGauge();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (gaugeAnim) gaugeAnim.cancel();
    };
    // Deps por valor (gauge?.from/to) en vez del objeto para no re-disparar la
    // animación cuando el consumidor pasa un literal de gauge inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, target, duration, enabled, gauge?.from, gauge?.to]);

  return { value, ref };
}
