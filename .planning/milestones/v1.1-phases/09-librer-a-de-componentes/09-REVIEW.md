---
phase: 09-librer-a-de-componentes
reviewed: 2026-07-06T00:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - apps/web/app/components/ui/ScoreGauge.tsx
  - apps/web/app/components/ui/CategoryCard.tsx
  - apps/web/app/components/ui/Badge.tsx
  - apps/web/app/components/ui/IssuesTable.tsx
  - apps/web/app/components/ui/CategoryAccordion.tsx
  - apps/web/app/components/ui/Button.tsx
  - apps/web/app/components/ui/Input.tsx
  - apps/web/app/components/ui/Field.tsx
  - apps/web/app/components/ui/EmptyState.tsx
  - apps/web/app/components/ui/Skeleton.tsx
  - apps/web/app/components/ui/labels.ts
  - apps/web/app/components/ui/url.ts
  - apps/web/app/components/ui/Badge.module.css
  - apps/web/app/components/ui/ScoreGauge.module.css
  - apps/web/app/components/ui/IssuesTable.module.css
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-07-06
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Se revisó la librería de componentes de UI de la Fase 9 (ScoreGauge, CategoryCard,
Badge, IssuesTable, CategoryAccordion, Button, Input, Field, EmptyState, Skeleton
más `labels.ts` y `url.ts`) con foco en corrección React 19 / Next 15, seguridad
(XSS / referrer en IssuesTable, navegación en EmptyState), accesibilidad y tipado.

La calidad general es alta: no hay `dangerouslySetInnerHTML`, ni `eval`, ni secretos,
ni artefactos de debug. El punto de seguridad más sensible —linkificar celdas en
IssuesTable— está bien resuelto: solo strings con prefijo `http` se vuelven `<a>`,
todo lo demás se escapa como texto (React por defecto), y el enlace lleva
`rel="noreferrer"`, que cubre tanto fuga de referrer como tabnabbing (`noopener`
implícito). Verifiqué además que `lucide-react ^1.23.0` es una versión real y que los
íconos importados (`Sparkle`, `Loader2`, `Inbox`, etc.) existen en esa versión, así
que no hay falso positivo de dependencia.

No se encontraron bloqueadores. Sí hay tres warnings de corrección/robustez y varios
puntos de calidad. El más relevante para un app Next es que `EmptyState` navega con
`window.location.assign` (recarga completa, sale del router de Next). Los otros dos
warnings son casos borde no protegidos: `ScoreGauge` con `max=0` produce `NaN` en el
arco, y `Field` clona el hijo de forma que puede pisar/perder wiring de accesibilidad.

Nota de alcance: no se marca "componente sin usar" ni ausencia de motion en vivo
(ambos corresponden a Fase 10), según lo indicado.

## Warnings

### WR-01: EmptyState navega con `window.location.assign` (recarga completa, fuera del router de Next) y sin validar el esquema

**File:** `apps/web/app/components/ui/EmptyState.tsx:77-83`
**Issue:** Cuando la acción trae `href`, el handler hace
`window.location.assign(action.href)`. En una app Next (App Router) esto fuerza una
navegación de página completa: se pierde el estado del cliente, se recarga todo el
bundle y se anula el prefetch/transición del router. El propósito documentado del
`href` es "ruta de app provista por el consumidor interno", justamente el caso donde
se quiere navegación SPA. Además no se valida el esquema del `href`; si algún
consumidor llegara a enrutar dato no confiable, `location.assign` con un esquema
`javascript:` es un vector de ejecución en navegadores que no lo bloquean.
**Fix:** Para rutas internas, usar el router de Next en vez de `location.assign`, y
validar que el destino sea una ruta interna (empieza con `/`):
```tsx
import { useRouter } from "next/navigation";
// ...
const router = useRouter();
const handleAction = action?.onClick
  ? action.onClick
  : action?.href
    ? () => {
        const href = action.href!;
        if (href.startsWith("/")) router.push(href);
        else window.location.assign(href); // externo explícito
      }
    : undefined;
```
Alternativa preferida: renderizar la acción con `href` como `<Link href={...}>`
estilizado como Button, en lugar de un `<button onClick>`.

### WR-02: ScoreGauge no protege `max <= 0`; produce `NaN` en el `stroke-dashoffset` y dibuja un arco incorrecto

**File:** `apps/web/app/components/ui/ScoreGauge.tsx:76-77`
**Issue:** `ratio = Math.min(Math.max(value / max, 0), 1)`. Con `max=0` y `value=0`,
`value / max` es `0/0 = NaN`; `Math.max(NaN,0)` y `Math.min(NaN,1)` propagan `NaN`, de
modo que `offset = circumference * (1 - NaN) = NaN`. Ese `NaN` se inyecta como
`--gauge-offset`, y en el CSS `stroke-dashoffset: var(--gauge-offset)` recibe un valor
inválido que el navegador descarta a `0` (arco completo). Resultado: un score `0 de 0`
se pinta como anillo lleno (100%), señal visual falsa. `hasValue` es `true` porque
`0 !== null`, así que el guard de "sin datos" no aplica.
**Fix:** Normalizar el denominador antes de dividir:
```tsx
const safeMax = max > 0 ? max : 1;
const ratio = hasValue ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
```
(O rechazar/`clamp` `max` inválido en el borde del componente.)

### WR-03: Field pisa `aria-describedby`/`id` del hijo sin fusionar, y pierde el wiring de accesibilidad si `children` no es un único elemento válido

**File:** `apps/web/app/components/ui/Field.tsx:54-62`
**Issue:** Dos problemas de robustez en el `cloneElement`:
1. Inyecta `id`, `aria-describedby` y `aria-invalid` sobrescribiendo cualquier valor
   previo del hijo. Si el `Input` ya trae un `aria-describedby` propio (p. ej. apunta a
   una descripción extra), se descarta; y cuando no hay hint ni error, `describedBy` es
   `undefined`, con lo que además borra cualquier `aria-describedby` que el hijo tuviera.
2. `isValidElement(children)` solo es `true` para un único elemento. Si el consumidor
   pasa un fragmento o varios hijos, se cae al `else` y el control queda **sin**
   `id={htmlFor}`, por lo que el `<label htmlFor>` deja de asociarse a ningún control:
   fallo de accesibilidad silencioso, sin error ni warning.
**Fix:** Fusionar `aria-describedby` con el existente del hijo y no anularlo cuando no
haya hint/error:
```tsx
const childDescribedBy = (children.props as InjectedControlProps)["aria-describedby"];
const mergedDescribedBy = [describedBy, childDescribedBy].filter(Boolean).join(" ") || undefined;
// cloneElement(..., { id: htmlFor, "aria-describedby": mergedDescribedBy, ... })
```
Y considerar advertir en dev (o documentar como invariante fuerte) que `children`
debe ser exactamente un elemento controlable.

## Info

### IN-01: Tipo `ScoreStatus` duplicado y divergente en lugar de importarlo de `@auditor/scoring`

**File:** `apps/web/app/components/ui/ScoreGauge.tsx:5`, `apps/web/app/components/ui/CategoryCard.tsx:6`
**Issue:** Ambos archivos redeclaran localmente
`type ScoreStatus = "good" | "needs_improvement" | "critical" | null`, mientras que
`labels.ts` sí importa `ScoreStatus` desde `@auditor/scoring`. Es la misma fuente de
verdad copiada a mano en dos lugares: si el enum canónico cambia (o no incluye `null`),
estos literales quedan desincronizados sin que el compilador lo detecte.
**Fix:** Importar el tipo canónico y componer el `null` localmente:
`import type { ScoreStatus } from "@auditor/scoring";` y usar `ScoreStatus | null` en
las props.

### IN-02: Heurística de linkificado en IssuesTable frágil (case-sensitive + falsos positivos)

**File:** `apps/web/app/components/ui/IssuesTable.tsx:49`
**Issue:** `value.startsWith("http")` es sensible a mayúsculas: una URL válida en
`HTTP://` o `HTTPS://` no se convierte en enlace (se muestra como texto). A la inversa,
una celda de texto plano que empiece con "http" (p. ej. `"https everywhere ayuda"`) se
vuelve un `<a>` con `href` inválido. La seguridad es correcta (solo `http*` pasa a
`href`, resto escapado, `rel="noreferrer"`), pero la detección debería ser precisa.
**Fix:** Validar con `URL` real o regex de esquema:
`if (/^https?:\/\//i.test(value)) { ... }`.

### IN-03: IssuesTable usa el índice del array como React `key` de las filas

**File:** `apps/web/app/components/ui/IssuesTable.tsx:122-123`
**Issue:** `key={rowIndex}` es aceptable mientras la tabla no reordene/filtre filas,
pero si Fase 10 introduce orden/filtros dinámicos puede provocar reconciliación
incorrecta (estado de celda pegado a la posición, no a la fila).
**Fix:** Si el modelo de fila tiene un identificador estable (checkId/URL), exponerlo y
usarlo como key; documentar la asunción de "filas estáticas" mientras tanto.

### IN-04: Field inyecta la prop no estándar `invalid` al hijo

**File:** `apps/web/app/components/ui/Field.tsx:60`
**Issue:** Cuando hay error, clona el hijo con `invalid: true`. El `Input` de la
librería la consume, pero la doc del propio Field dice que también acepta "control
nativo". Si el hijo es un `<input>` nativo, React 19 reenvía `invalid` como atributo DOM
desconocido (`invalid="true"`), HTML no válido y sin efecto.
**Fix:** Inyectar solo props estándar al hijo (`aria-invalid`), o restringir por tipos
que el hijo sea el `Input` de la librería (que traduce `invalid` a clase/estilo).

### IN-05: EmptyState fuerza `role="heading" aria-level={2}` sobre un `<p>`

**File:** `apps/web/app/components/ui/EmptyState.tsx:95`
**Issue:** Se simula un heading nivel 2 vía ARIA sobre un párrafo. Como este componente
se reutiliza dentro de otras vistas (incluido el estado vacío de IssuesTable), fijar el
nivel a 2 puede romper la jerarquía de encabezados de la pantalla contenedora.
**Fix:** Usar un `<h2>` real o exponer el nivel como prop (`headingLevel`) para que el
consumidor lo alinee con su estructura de encabezados.

### IN-06: CategoryCard renderiza un `<p>` de estado vacío cuando hay valor pero no `statusLabel`

**File:** `apps/web/app/components/ui/CategoryCard.tsx:63-65`
**Issue:** `statusLabel ?? (hasValue ? "" : "sin datos")` produce un párrafo de estado
vacío (string `""`) cuando el score existe pero no se pasó `statusLabel`. Queda un nodo
con clase de color sin texto; el estado, que "nunca debe ser solo color", queda sin
palabra que lo comunique.
**Fix:** Omitir el `<p>` de estado cuando no haya texto, o exigir `statusLabel` cuando
`score` no es `null`.

### IN-07: EmptyState ignora silenciosamente `href` cuando también viene `onClick`

**File:** `apps/web/app/components/ui/EmptyState.tsx:77-83`
**Issue:** Si `action` trae `onClick` y `href`, gana `onClick` y `href` se descarta sin
aviso. La precedencia no está documentada en el tipo `StateAction`.
**Fix:** Documentar la precedencia en la interfaz, o tratar la combinación como
mutuamente excluyente a nivel de tipos (union discriminada `{ onClick } | { href }`).

---

_Reviewed: 2026-07-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
