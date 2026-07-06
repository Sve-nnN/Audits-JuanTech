"use client";

import type { ScoreStatus } from "@auditor/scoring";
import { useCountUp } from "../../components/motion/useCountUp";
import { ScoreGauge } from "../../components/ui/ScoreGauge";

interface ScoreGaugeAnimatedProps {
  /** Score final 0–100 (no-null; el caso "sin datos" usa ScoreGauge estático). */
  value: number;
  /** Estado semántico que colorea el arco. */
  status: ScoreStatus | null;
  /** Etiqueta accesible fija (número + palabra de estado, valor final). */
  ariaLabel: string;
}

/**
 * ScoreGaugeAnimated (MOTION-01) — envoltorio cliente del ScoreGauge del hero
 * que hace count-up al entrar al viewport. `useCountUp` interpola 0→value en
 * 900ms disparado por IntersectionObserver; al pasar el valor interpolado a
 * ScoreGauge, el número cuenta y el arco (--gauge-offset, recalculado por render)
 * se llena en paralelo. El `aria-label` queda en el valor final (no cuenta para
 * AT). Con prefers-reduced-motion el hook devuelve `value` de inmediato: gauge
 * en su estado final, sin barrido.
 */
export function ScoreGaugeAnimated({ value, status, ariaLabel }: ScoreGaugeAnimatedProps) {
  const { value: animated, ref } = useCountUp<HTMLDivElement>(value, { duration: 900 });

  return (
    <div ref={ref}>
      <ScoreGauge size="lg" value={animated} status={status} aria-label={ariaLabel} />
    </div>
  );
}
