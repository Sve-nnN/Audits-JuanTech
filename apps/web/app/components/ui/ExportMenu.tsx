"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileCode,
  FileText,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./Button";
import styles from "./ExportMenu.module.css";

type ExportFormat = "pdf" | "md" | "pptx";

interface ExportOption {
  label: string;
  format: ExportFormat;
  icon: LucideIcon;
  ext: ExportFormat;
}

/** Opciones del menú (Copywriting Contract, español neutro sin voceo). */
const OPTIONS: ExportOption[] = [
  { label: "PDF", format: "pdf", icon: FileText, ext: "pdf" },
  { label: "Markdown (para IA)", format: "md", icon: FileCode, ext: "md" },
  { label: "Presentación (PPTX)", format: "pptx", icon: Presentation, ext: "pptx" },
];

const ERROR_MSG = "No se pudo generar el archivo. Intenta de nuevo.";

interface ExportMenuProps {
  /** Id de la auditoría; alimenta la route de export. */
  auditId: string;
  /** Dominio para el nombre de archivo de fallback (opcional). */
  domain?: string;
}

/**
 * Parsea `filename="..."` de un header Content-Disposition. Devuelve null si no
 * hay match. El valor se usa SOLO como atributo `download` del enlace temporal
 * (nunca como sink de DOM/innerHTML) — T-14-01.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  // decodeURIComponent lanza URIError ante un `%` suelto (p. ej. "50% off");
  // en ese caso conservamos el filename literal en lugar de abortar la descarga.
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * ExportMenu (EXPORT-04) — botón "Exportar" con menú desplegable accesible de 3
 * formatos (PDF / Markdown / PPTX). Dispara la descarga contra la route de
 * export (Phase 13) vía fetch→blob→enlace temporal, con estado de carga real
 * que bloquea el doble envío y error inline neutro.
 *
 * Accesibilidad:
 *   - Trigger: aria-haspopup="menu", aria-expanded, aria-controls.
 *   - Panel role="menu"; items role="menuitem" con roving tabindex.
 *   - Teclado: Enter/Space/ArrowDown abren (foco al primero), ArrowUp abre (al
 *     último), flechas navegan con wrap, Home/End extremos, Esc cierra y
 *     devuelve foco al trigger, Tab/click-fuera cierran sin exportar.
 *   - El panel se muestra por presencia en el DOM (no depende de animación).
 */
export function ExportMenu({ auditId, domain }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Guard síncrono contra doble envío: el estado `loading` se actualiza async,
  // así que dos activaciones en el mismo tick podrían colarse antes del re-render.
  const inFlightRef = useRef(false);
  // Revoke diferido del object URL (WR-02): revocar de inmediato tras click()
  // puede cancelar la descarga en Firefox/Chromium bajo carga. Guardamos el
  // timer y la URL pendiente para poder revocar también en el desmontaje.
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  const scheduleRevoke = useCallback((url: string) => {
    pendingUrlRef.current = url;
    revokeTimerRef.current = setTimeout(() => {
      URL.revokeObjectURL(url);
      pendingUrlRef.current = null;
      revokeTimerRef.current = null;
    }, 1000);
  }, []);

  // Al desmontar: revocar cualquier URL pendiente para no filtrar memoria.
  useEffect(() => {
    return () => {
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    };
  }, []);

  // El Button primitivo no expone ref; recuperamos el trigger por id para el
  // manejo de foco (patrón establecido en el codebase, cf. 10-02).
  const focusTrigger = useCallback(() => {
    document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  const closeMenu = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) focusTrigger();
    },
    [focusTrigger]
  );

  // Abre el menú posicionando el foco en el primer o último item.
  const openMenu = useCallback(
    (index: number) => {
      if (loading) return;
      setActiveIndex(index);
      setOpen(true);
    },
    [loading]
  );

  // Mueve el foco al item activo cuando el menú está abierto (roving tabindex).
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Cierre por click fuera del wrapper (sin disparar export).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const runExport = useCallback(
    async (option: ExportOption) => {
      // guard: bloquea doble/multi envío (T-14-02, SC#3). El ref es síncrono y
      // estable en el closure; `loading` queda como respaldo legible.
      if (inFlightRef.current || loading) return;
      inFlightRef.current = true;
      setErrorMsg(null);
      setOpen(false);
      setLoading(true);
      let objectUrl: string | null = null;
      try {
        const res = await fetch(
          `/api/audits/${auditId}/export?format=${option.format}`
        );
        if (!res.ok) throw new Error(`export failed: ${res.status}`);
        const blob = await res.blob();
        const filename =
          filenameFromDisposition(res.headers.get("content-disposition")) ??
          `auditoria-${domain ?? auditId}.${option.ext}`;
        objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        // WR-02: diferir el revoke para dar tiempo al navegador a iniciar la
        // transferencia; anulamos objectUrl para no revocarlo en el finally.
        scheduleRevoke(objectUrl);
        objectUrl = null;
      } catch {
        // Texto neutro fijo; nunca exponemos status/stack al usuario (T-14-03).
        setErrorMsg(ERROR_MSG);
      } finally {
        // Sólo la ruta de error/early-exit revoca de inmediato (aún no hubo
        // descarga); el éxito ya programó el revoke diferido (WR-02, T-14-04).
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [auditId, domain, loading, scheduleRevoke]
  );

  // Teclado del trigger.
  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (loading) return;
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        openMenu(0);
        break;
      case "ArrowUp":
        event.preventDefault();
        openMenu(OPTIONS.length - 1);
        break;
      default:
        break;
    }
  }

  function onTriggerClick() {
    if (loading) return;
    if (open) closeMenu(false);
    else openMenu(0);
  }

  // Teclado dentro del menú.
  function onItemKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index + 1) % OPTIONS.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index - 1 + OPTIONS.length) % OPTIONS.length);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(OPTIONS.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = OPTIONS[index];
        if (option) void runExport(option);
        break;
      }
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        // Deja pasar el foco pero cierra el menú (sin exportar).
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Button
        id={triggerId}
        variant="secondary"
        size="md"
        iconLeft={Download}
        loading={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        Exportar
      </Button>

      {open && (
        <div
          className={styles.menu}
          role="menu"
          id={menuId}
          aria-labelledby={triggerId}
        >
          {OPTIONS.map((option, index) => {
            const Icon = option.icon;
            return (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                className={styles.item}
                tabIndex={activeIndex === index ? 0 : -1}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onKeyDown={(event) => onItemKeyDown(event, index)}
                onClick={() => void runExport(option)}
              >
                <Icon size={16} aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {errorMsg && (
        <p className={styles.error} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}
