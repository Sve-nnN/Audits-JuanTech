"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type RefObject,
} from "react";

interface UseRevealOptions {
  /** Retraso de stagger en ms; se aplica como --reveal-delay inline. Default 0. */
  delay?: number;
  /** Umbral de intersección. Default 0.15. */
  threshold?: number;
  /** rootMargin del observer. Default "0px 0px -10% 0px". */
  rootMargin?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * useReveal — devuelve un ref que, al adjuntarse a un elemento con el atributo
 * `data-reveal`, lo transiciona a `data-reveal="in"` la primera vez que entra
 * al viewport (una sola vez, con unobserve).
 *
 * Contratos:
 *   - El contenido SIEMPRE está en el DOM: el hook solo cambia el atributo
 *     data-reveal, nunca condiciona el render (visible para AT y no-JS).
 *   - Los estilos de la transición viven en globals.css ([data-reveal]); este
 *     hook no define estilos, solo togglea el atributo (+ --reveal-delay opcional).
 *   - Con prefers-reduced-motion setea data-reveal="in" de inmediato (la
 *     neutralización visual también está garantizada en globals.css).
 *   - Client-safe con mounted-guard; limpia el observer en cleanup.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  opts: UseRevealOptions = {},
): RefObject<T | null> {
  const { delay = 0, threshold = 0.15, rootMargin = "0px 0px -10% 0px" } = opts;

  const ref = useRef<T | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const node = ref.current;
    if (!node) return;

    if (delay) {
      node.style.setProperty("--reveal-delay", `${delay}ms`);
    }

    // Sin observer o reduced-motion: revelar de inmediato (contenido visible).
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-reveal", "in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [mounted, delay, threshold, rootMargin]);

  return ref;
}

type RevealProps<E extends ElementType> = {
  /** Tag/componente a renderizar. Default "div". */
  as?: E;
  /** Retraso de stagger en ms. */
  delay?: number;
} & Omit<ComponentPropsWithoutRef<E>, "as" | "delay">;

/**
 * Reveal — wrapper ergonómico sobre useReveal. Renderiza el elemento con el
 * atributo `data-reveal` inicial y lo revela al entrar al viewport. El contenido
 * hijo siempre está en el DOM. Construido con createElement (sin JSX) para vivir
 * en un módulo .ts junto al hook.
 */
export function Reveal<E extends ElementType = "div">({
  as,
  delay,
  ...rest
}: RevealProps<E>) {
  const ref = useReveal<HTMLElement>({ delay });
  const Tag = (as ?? "div") as ElementType;
  return createElement(Tag, { ref, "data-reveal": "", ...rest });
}
