"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkle,
} from "lucide-react";
import type { Confidence } from "@auditor/report-model";
import { DIFF_LABEL, SEVERITY_LABEL } from "./labels";
import { CONFIDENCE_BADGE } from "./StackTable";
import styles from "./Badge.module.css";

export type BadgeVariant =
  | "critical"
  | "warning"
  | "ok"
  | "new"
  | "persistent"
  | "resolved"
  | "info"
  | "neutral"
  | "warningSubtle";

interface BadgeProps {
  /** Eje visual: mapea a foreground + soft-fill por token. */
  variant: BadgeVariant;
  /** Etiqueta ya localizada (sin voceo). El texto porta el significado. */
  children: React.ReactNode;
  /** Icono lucide opcional (14px, aria-hidden, hereda currentColor). */
  icon?: LucideIcon;
}

/** variante → clase de color del CSS Module. */
const VARIANT_CLASS: Record<BadgeVariant, string | undefined> = {
  critical: styles.critical,
  warning: styles.warning,
  ok: styles.ok,
  new: styles.new,
  persistent: styles.persistent,
  resolved: styles.resolved,
  info: styles.info,
  neutral: styles.neutral,
  warningSubtle: styles.warningSubtle,
};

/**
 * Badge (COMP-03) — pill decorativo reutilizable de severidad/diff.
 *
 * Primitivo self-contained: los soft-fills `--sev-*` se definen locales en la
 * clase `.badge` (no en scope global), así el badge funciona en cualquier
 * pantalla sin depender de variables de la página. Nueve variantes mapeadas a
 * foreground/background por token semántico (DS-01), cero hex crudo.
 *
 * Accesibilidad:
 *   - Estático, no focusable: el color nunca es señal única, el texto siempre
 *     lleva el significado.
 *   - El icono opcional es `aria-hidden` y hereda `currentColor`.
 */
export function Badge({ variant, children, icon: Icon }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${VARIANT_CLASS[variant]}`}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

type Severity = "critical" | "warning" | "ok";

/** Iconos por defecto del eje severidad (UI-SPEC COMP-03). */
const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  ok: CheckCircle2,
};

interface SeverityBadgeProps {
  severity: Severity;
  /** Si es `false`, omite el icono líder (default `true`). */
  icon?: boolean;
}

/**
 * SeverityBadge (COMP-03) — wrapper tipado del eje severidad.
 *
 * Mapea `critical|warning|ok` a su etiqueta en español desde `SEVERITY_LABEL`
 * y su icono lucide por defecto.
 */
export function SeverityBadge({ severity, icon = true }: SeverityBadgeProps) {
  return (
    <Badge variant={severity} icon={icon ? SEVERITY_ICON[severity] : undefined}>
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

type Diff = "new" | "persistent" | "resolved";

/** Iconos por defecto del eje diff (UI-SPEC COMP-03). */
const DIFF_ICON: Record<Diff, LucideIcon> = {
  new: Sparkle,
  persistent: Circle,
  resolved: CheckCircle2,
};

interface DiffBadgeProps {
  diff: Diff;
  /** Si es `false`, omite el icono líder (default `true`). */
  icon?: boolean;
}

/**
 * DiffBadge (COMP-03) — wrapper tipado del eje diff.
 *
 * Mapea `new|persistent|resolved` a su etiqueta en español desde `DIFF_LABEL`
 * y su icono lucide por defecto.
 */
export function DiffBadge({ diff, icon = true }: DiffBadgeProps) {
  return (
    <Badge variant={diff} icon={icon ? DIFF_ICON[diff] : undefined}>
      {DIFF_LABEL[diff]}
    </Badge>
  );
}

/**
 * Icono redundante por confianza (aria-hidden); `no-detectado` sin icono.
 *
 * Lives here (not in StackTable.tsx, a Server Component) because a Lucide
 * icon is a component reference (a function) — React cannot serialize
 * functions passed as props from a Server Component into a Client Component
 * like `Badge`. Confirmed at runtime ("Functions cannot be passed directly
 * to Client Components") the first time a real audit rendered this table.
 */
const CONFIDENCE_ICON: Record<Confidence, LucideIcon | undefined> = {
  alto: CheckCircle2,
  medio: AlertTriangle,
  bajo: AlertTriangle,
  "no-detectado": undefined,
};

interface ConfidenceBadgeProps {
  confidence: Confidence;
  children: React.ReactNode;
}

/**
 * ConfidenceBadge (STACKUI-02/FPRINT-08) — wrapper tipado del eje confianza.
 *
 * Resuelve variante + icono enteramente del lado cliente a partir de
 * `confidence` (un string, serializable) en vez de recibir el icono ya
 * resuelto como prop desde un Server Component.
 */
export function ConfidenceBadge({ confidence, children }: ConfidenceBadgeProps) {
  return (
    <Badge variant={CONFIDENCE_BADGE[confidence]} icon={CONFIDENCE_ICON[confidence]}>
      {children}
    </Badge>
  );
}
