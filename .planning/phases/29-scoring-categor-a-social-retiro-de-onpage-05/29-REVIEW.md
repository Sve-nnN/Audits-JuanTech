---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
reviewed: 2026-08-01T23:40:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - packages/scoring/src/overallScore.ts
  - packages/scoring/src/overallScore.test.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
  - packages/export/src/labels.ts
  - packages/export/src/labels.test.ts
  - packages/export/src/test-fixtures.ts
  - packages/export/src/markdown.test.ts
  - packages/checks/src/registry.test.ts
  - packages/checks/src/checks/onpage/index.ts
  - apps/web/app/components/ui/labels.ts
  - apps/web/app/components/ui/labels.test.ts
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/tests/pages/api/audits/[id]/export.test.ts
findings:
  critical: 1
  warning: 8
  info: 5
  total: 14
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-08-01T23:40:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Se revisaron los 14 archivos fuente que los cuatro SUMMARY de la fase declaran como creados o modificados, más los consumidores transitivos que el cambio de tipo alcanza (`apps/worker/src/index.ts`, `packages/checks/src/types.ts`, `packages/export/src/pptx.ts`, `packages/export/src/pdf.tsx`, `packages/export/src/markdown.ts`, `packages/cms-adapters/*`).

La ejecución mecánica del fan-out está bien hecha: la sexta categoría llega a los tres arrays `Category[]`, a los dos mapas de etiquetas y a las fixtures, y los guardarrailes de exhaustividad contra `Object.keys(CATEGORY_WEIGHTS)` son la técnica correcta. El retiro de ONPAGE-05 está completo en el árbol y en el barrel.

Dicho eso, la fase construyó toda su tesis alrededor de una frase: *"TypeScript exige exhaustividad en un `Record<Category, T>` pero no en los sitios que lo indexan en runtime"*. Esa tesis se aplicó a los cuatro sitios de **presentación** (donde el peor caso es que un issue no se muestre) y **no se aplicó al único sitio de cálculo**: `scoreOverall` indexa `CATEGORY_WEIGHTS` con una categoría que llega como `string` sin validar desde el check, y una categoría desconocida convierte el score general de la auditoría entera en `NaN`, que Prisma persiste como `null`. Está confirmado por reproducción, no inferido. Es el hallazgo BLOCKER de esta revisión y es exactamente la clase de defecto silencioso que la fase decía estar cerrando.

Además hay una inconsistencia de copy visible para el usuario (la página de reporte sigue enumerando cinco categorías), un docblock que ahora se contradice con los valores que tiene tres líneas abajo, un test nuevo que es duplicado byte a byte de otro y no aporta cobertura, y un quinto sitio sin guardarraíl dentro del mismo archivo que 29-03 declara cerrado.

## Critical Issues

### CR-01: Una categoría fuera de `CATEGORY_WEIGHTS` convierte el score general en `NaN` y lo persiste como `null`

**File:** `packages/scoring/src/overallScore.ts:93-101`
**Cadena completa:** `packages/checks/src/types.ts:24` → `apps/worker/src/index.ts:470` → `apps/worker/src/index.ts:572-584` → `packages/scoring/src/overallScore.ts:94`

**Issue:**

`IssueDraft.category` está declarado `category: string`, no `category: Category` (`packages/checks/src/types.ts:24`). El worker lo persiste verbatim (`apps/worker/src/index.ts:470`, `:484`, `:501`), la columna `Issue.category` es `String` sin enum, y al puntuar lo agrupa con un cast desnudo:

```ts
// apps/worker/src/index.ts:574
const category = row.category as Category;   // mentira al compilador
```

Ese valor llega sin filtrar a `scoreOverall`, que lo usa como clave de `CATEGORY_WEIGHTS`:

```ts
// packages/scoring/src/overallScore.ts:93-101
const present = (Object.keys(byCategory) as Category[]).filter((cat) => byCategory[cat] !== undefined);
const totalWeight = present.reduce((sum, cat) => sum + CATEGORY_WEIGHTS[cat], 0);

if (present.length === 0 || totalWeight === 0) { ... }   // NaN !== 0 → no entra

const weightedSum = present.reduce((sum, cat) => sum + byCategory[cat]!.score * CATEGORY_WEIGHTS[cat], 0);
const overall = Math.round(weightedSum / totalWeight);
```

Si la clave no existe, `CATEGORY_WEIGHTS[cat]` es `undefined`, `sum + undefined` es `NaN`, y el guard `totalWeight === 0` **no** atrapa `NaN`. Reproducción ejecutada:

```
present [ 'tech', 'sociall' ] totalWeight NaN weightedSum NaN
totalWeight === 0 ? false
overall NaN
JSON {"overall":null}
```

Consecuencias, en orden de gravedad:

1. `scores.overall` se persiste como `null` en el campo Json (`JSON.stringify(NaN) === "null"`). La auditoría queda sin score general: pérdida de dato, no degradación.
2. `statusForScore(NaN)` cae al `else` y devuelve `"critical"`, así que el reporte muestra estado *Crítico* sobre un score inexistente.
3. Falla en silencio: no hay throw, no hay log, no hay test que lo cubra.

**Por qué es de esta fase y no deuda ambiental:** el radio de exposición lo abrió este cambio. Hasta v1.5 las cinco categorías estaban congeladas y ningún check nuevo escribía un literal de categoría. Phase 29 amplía el union y Phase 30 va a escribir a mano `category: "social"` en ocho checks nuevos (`SOCIAL-01..08`) contra un campo tipado `string`. Un solo typo (`"sociales"`, `"Social"`, `"social "`) en cualquiera de esos ocho archivos NaNea el score general de todas las auditorías, y el `if (bucket)` de `build.ts:248` (ver WR-08) se encarga de que el issue tampoco aparezca en el reporte para delatar el error. La fase entera se justificó como "cerrar los sitios que TypeScript no protege"; este es ese sitio, es el único con consecuencia de dato, y quedó abierto.

**Fix (mínimo, en el punto de cálculo):**

```ts
// packages/scoring/src/overallScore.ts
const present = (Object.keys(byCategory) as Category[]).filter(
  (cat) => byCategory[cat] !== undefined && CATEGORY_WEIGHTS[cat] !== undefined
);
const totalWeight = present.reduce((sum, cat) => sum + CATEGORY_WEIGHTS[cat], 0);

// Defensa en profundidad: NaN nunca debe escaparse a la persistencia.
if (present.length === 0 || !Number.isFinite(totalWeight) || totalWeight === 0) {
  return { overall: 0, status: statusForScore(0), byCategory };
}
```

**Fix complementario (cerrar el origen, recomendado para Phase 30):**

```ts
// packages/checks/src/types.ts
import type { Category } from "@auditor/scoring";

export interface IssueDraft {
  checkId: string;
  category: Category;   // era: string
  ...
}
```

Esto convierte cualquier typo de categoría en un error de compilación en el check que lo escribe, que es donde se puede arreglar barato. Si tomar la dependencia `@auditor/checks → @auditor/scoring` no es aceptable, la alternativa es validar en el worker antes de `createMany` y descartar/loggear la fila.

**Test que debería acompañar el fix:**

```ts
it("ignora una categoría desconocida en vez de NaNear el overall", () => {
  const result = scoreOverall(
    { tech: scoreCategory([]), ["sociall" as never]: scoreCategory([]) },
    { mobileAvgScore: 100, desktopAvgScore: 100 }
  );
  expect(Number.isFinite(result.overall)).toBe(true);
  expect(result.overall).toBe(100);
});
```

## Warnings

### WR-01: La página de reporte le sigue diciendo al usuario que el score son cinco categorías

**File:** `apps/web/app/audits/[id]/page.tsx:173-176`
**Issue:** El copy del bloque "Score general" enumera las categorías a mano y quedó en la lista pre-v1.6:

```tsx
Promedio ponderado de SEO técnico, rendimiento, on-page, datos estructurados y
AEO, calculado con los hallazgos de esta auditoría.
```

Tres líneas más abajo, el mismo componente renderiza seis tarjetas desde `CATEGORY_ORDER` (línea 199), una de ellas titulada "Meta Tags / Social". El usuario ve seis tarjetas y un texto que dice que son cinco cosas. Es el único punto del fan-out que quedó sin cerrar y es justamente el que el usuario lee. Ningún test lo cubre porque es prosa.

**Fix:**

```tsx
Promedio ponderado de SEO técnico, rendimiento, on-page, datos estructurados,
AEO y meta tags / social, calculado con los hallazgos de esta auditoría.
```

### WR-02: El docblock de `CATEGORY_WEIGHTS` contradice los valores que declara tres líneas abajo

**File:** `packages/scoring/src/overallScore.ts:14-38`
**Issue:** El docblock afirma:

> Technical SEO and Performance carry the most weight, **AEO the least** (its ranking impact is not yet confirmed).

Después del rebalanceo, AEO vale `.15` y es la **tercera** más pesada; las menores son `onpage` (.10, empatada con social) y `schema` (.05). El plan 29-01 editó este mismo docblock para agregarle la nota de corte v1.6 y dejó en pie la frase que el rebalanceo acababa de invalidar. Un lector que use el docblock para decidir un rebalanceo futuro parte de un dato falso. En la misma línea, "tuned to land in the reference report's range (juan-tech.com ~86/100)" ya no describe el modelo vigente.

**Fix:**

```ts
 * Default category weights for the overall score: Technical SEO and
 * Performance carry the most weight; `schema` the least since the v1.6
 * rebalance. Tunable — adjust these constants to rebalance the model
 * without touching the averaging logic.
```

### WR-03: El test de renormalización de `social` es un duplicado byte a byte del test de 20 líneas arriba y no aporta cobertura

**File:** `packages/scoring/src/overallScore.test.ts:69-81` (vs `:48-56`)
**Issue:** Los dos casos pasan **exactamente** el mismo input:

```ts
scoreOverall({ tech: perfect, onpage: perfect, schema: perfect, aeo: perfect },
             { mobileAvgScore: 100, desktopAvgScore: 100 })
```

El único assert que agrega el caso nuevo es `expect(result.byCategory.social).toBeUndefined()`, que es trivialmente cierto porque `social` nunca entró al input: pasaría igual con `social` ausente del union, con peso 0, o con el bloque de renormalización borrado y reemplazado por un `return 100`.

Además, con todas las categorías en 100 **ningún** assert del archivo puede distinguir qué denominador se usó: `900/9 === 100` y `90/0.9 === 100` dan lo mismo. El comentario del test afirma que verifica que `totalWeight` cae a 0.90; el assert no puede verlo. El SUMMARY 29-01 registra esto como cobertura D5 con `status: pass` y `human_judgment: false` — la afirmación de cobertura es más fuerte que el test.

**Fix:** usar scores diferenciados, que es lo único que fija el denominador:

```ts
it("renormalizes weights when social has no data", () => {
  const result = scoreOverall(
    { tech: s(100), onpage: s(0), schema: s(0), aeo: s(0) },
    { mobileAvgScore: 100, desktopAvgScore: 100 }
  );
  // (100*0.3 + 100*0.3) / 0.90 = 66.67 -> 67   (con denominador 1.0 daría 60)
  expect(result.overall).toBe(67);
  expect(result.byCategory.social).toBeUndefined();
});
```

### WR-04: Queda un quinto sitio sin guardarraíl dentro del mismo archivo que 29-03 declara cerrado

**File:** `packages/export/src/test-fixtures.ts:68-75`
**Issue:** 29-03 agregó el test de exhaustividad sobre `CATS` (línea 44), pero el objeto que los serializadores realmente consumen para los issues es un literal aparte con cast:

```ts
const issuesByCategory = {
  tech: [], perf: [], onpage: [], schema: [], aeo: [], social: [],
} as Record<Category, ReportIssue[]>;
```

El cast `as` suprime el error de exhaustividad y **ningún test mira las claves de este objeto** — `labels.test.ts:40-44` compara `CATS`, que es un array distinto. Una séptima categoría agregada al union y a `CATS` pero no a este literal reproduce exactamente el falso verde que 29-03 dice haber eliminado: `buildModel` la saltea en `if (issuesByCategory[cat])` (línea 86) y los tests de markdown/PDF/PPTX vuelven a pasar sin haberla visto nunca. La deuda está registrada como T-29-07 `accept`, pero el racional de la disposición ("cubiertos indirectamente por los tests de exhaustividad") es incorrecto: este literal no está cubierto por ninguno.

**Fix:** construir el objeto desde la misma fuente de verdad, y el cast desaparece solo:

```ts
const issuesByCategory = Object.fromEntries(
  CATS.map((c) => [c, [] as ReportIssue[]])
) as Record<Category, ReportIssue[]>;
```

### WR-05: El guardarraíl de paridad de copy web↔export cubre 1 de 6 etiquetas y no mira el paquete de export

**File:** `apps/web/app/components/ui/labels.test.ts:34-44`
**Issue:** El docblock promete:

> un cambio unilateral en cualquiera de los dos lados ponga esta suite en rojo

El test que lo respalda es un solo assert contra un literal escrito a mano:

```ts
expect(CATEGORY_LABEL.social).toBe("Meta Tags / Social");
```

Dos huecos: (a) sólo cubre `social` — cambiar `"SEO Técnico"` en cualquiera de los dos archivos no pone nada en rojo, y son gemelos verbatim por diseño igual que `social`; (b) no compara contra `@auditor/export`, así que un cambio del lado de export no puede poner **esta** suite en rojo (lo salva de rebote el `toContain("Meta Tags / Social")` de `markdown.test.ts:17`, que también cubre sólo esa etiqueta). La promesa del docblock es más amplia que el guardarraíl.

**Fix:** o se acota el docblock a lo que el test hace, o se extiende el assert a las seis etiquetas:

```ts
it("las etiquetas de la UI son verbatim las del paquete de export", () => {
  expect(CATEGORY_LABEL).toEqual({
    tech: "SEO Técnico",
    perf: "Rendimiento / CWV",
    onpage: "On-Page",
    schema: "Datos Estructurados",
    aeo: "AEO (Visibilidad en IA)",
    social: "Meta Tags / Social",
  });
});
```

(el mismo `toEqual` de objeto entero que 29-01 eligió, con buen criterio, para `CATEGORY_WEIGHTS`).

### WR-06: La ventana 29→30 puntúa con una tercera distribución de pesos que ninguna documentación declara

**File:** `packages/scoring/src/overallScore.ts:20-29`
**Issue:** El corte de versión está documentado en tres sitios como "de pesos v1.5 a pesos v1.6". No es lo que corre en producción hasta que aterrice Phase 30. Con `social` ponderada .10 y cero checks que emitan en ella, `scoreOverall` la excluye de `present` y renormaliza sobre 0.90, produciendo pesos efectivos que no son ni los de v1.5 ni los declarados en `CATEGORY_WEIGHTS`:

| Categoría | v1.5 | `CATEGORY_WEIGHTS` v1.6 | Efectivo hoy (÷0.90) |
|-----------|------|-------------------------|----------------------|
| tech      | .30  | .30                     | **.333** |
| perf      | .30  | .30                     | **.333** |
| onpage    | .15  | .10                     | .111 |
| schema    | .10  | .05                     | **.056** |
| aeo       | .15  | .15                     | **.167** |
| social    | —    | .10                     | excluida |

El peso efectivo de `schema` cae casi a la mitad y el de `aeo` sube, cambios que nadie decidió y que ninguna fila de Key Decisions menciona. La fila de `PROJECT.md:153` sólo dice que "la categoría social aparece en el reporte sin datos", que describe el síntoma visual y no el efecto sobre el score. Las auditorías corridas en esta ventana no son comparables ni con las de v1.5 ni con las de post-Phase-30: son un tercer baseline no documentado.

**Fix:** agregar la tabla de pesos efectivos al docblock del corte de versión (`overallScore.ts:25-29`) y una frase a la fila de `PROJECT.md`, en la línea de "mientras `social` no tenga checks, el score general se renormaliza sobre 0.90 y los pesos efectivos de las cinco categorías restantes no son los declarados". Es documentación, no código: el comportamiento de renormalización es correcto y deseado.

### WR-07: El PPTX presenta la categoría no medida como una barra en 0; PDF y Markdown dicen "sin datos"

**File:** `packages/export/src/pptx.ts:477-478`
**Issue:** Los tres serializadores tratan una categoría sin score de forma distinta:

```ts
// pptx.ts:478  -> se muestra como un 0 real en el gráfico
const values = CATEGORY_ORDER.map((c) => model.byCategory[c as Category]?.score ?? 0);

// pdf.tsx:191-194 y markdown.ts:45-51  -> se muestra como "sin datos"
result ? `${scoreText(result.score)} — ${STATUS_LABEL[result.status]}` : "sin datos"
```

Durante toda la ventana 29→30, **cada** PPTX exportado va a llevar una barra "Meta Tags / Social" en 0 con la etiqueta de dato `0` impresa encima (`showValue: true`), compensada sólo por una nota en itálica de 11pt al pie de la slide. Un deck que se comparte por pantalla o se recorta a la slide de scores comunica "esta web tiene 0 en Meta Tags / Social", que es falso: no se midió. El SUMMARY 29-01 registra esto como T-29-04 `accept` con el racional de que "el guard interno del `.map` de `pdf.tsx:191-194` sigue intacto y ahora cubre también a `social`" — ese guard es del PDF, no del PPTX; el PPTX no tiene guard equivalente, tiene un `?? 0`.

**Fix:** excluir las categorías sin score del gráfico en vez de graficarlas en 0.

```ts
const scored = CATEGORY_ORDER.filter((c) => model.byCategory[c as Category] !== undefined);
const labels = scored.map((c) => CATEGORY_LABEL[c]);
const values = scored.map((c) => model.byCategory[c as Category]!.score);
```

La nota "Sin datos: ..." de la línea 503 ya existe y pasa a ser la única representación de esas categorías, que es el comportamiento correcto y el que ya tienen los otros dos formatos.

### WR-08: `buildReportModel` descarta issues de categoría desconocida sin log ni contador

**File:** `packages/report-model/src/build.ts:246-249`
**Issue:**

```ts
for (const issue of issuesForDetail as unknown as IssueRow[]) {
  const bucket = issuesByCategory[issue.category as Category];
  if (bucket) bucket.push(toReportIssue(issue, rawStack));
}
```

El test de exhaustividad que agregó 29-03 cubre el caso "categoría del union ausente del array", que es real y estaba bien atacarlo. No cubre el caso complementario, que es el que queda vivo: una categoría **fuera** del union — que el tipo `string` de `IssueDraft.category` permite emitir y la columna `String` permite persistir — se descarta acá sin error, sin log y sin contador. Es la mitad silenciosa de CR-01: el mismo dato malo que NaNea el score también desaparece del reporte, así que el operador no tiene ni siquiera el issue huérfano como pista de qué pasó.

**Fix:** que el descarte deje rastro.

```ts
const unknownCategories = new Set<string>();
for (const issue of issuesForDetail as unknown as IssueRow[]) {
  const bucket = issuesByCategory[issue.category as Category];
  if (bucket) bucket.push(toReportIssue(issue, rawStack));
  else unknownCategories.add(issue.category);
}
if (unknownCategories.size > 0) {
  console.warn(
    `[report-model] audit ${auditId}: issues descartados con categoría desconocida: ${[...unknownCategories].join(", ")}`
  );
}
```

## Info

### IN-01: Comentarios "5 categorías" desactualizados en consumidores fuera del set modificado

**Files:** `packages/export/src/pptx.ts:21`, `apps/web/app/components/ui/CategoryCard.tsx:34`, `apps/web/app/audits/[id]/AuditProgress.tsx:22`
**Issue:** Tres comentarios y un copy quedaron con la cardinalidad vieja: `"bar chart horizontal de las 5 categorías"`, `"Consistente para las 5 categorías del reporte"`, y el texto de progreso `"Analizando checks (SEO técnico, on-page, datos estructurados y AEO)"` (que ya venía incompleto: nunca mencionó rendimiento). Ninguno de los tres archivos está en el set modificado por la fase, pero los tres describen la constante que la fase cambió.
**Fix:** actualizar a "seis categorías" los dos comentarios; alinear el copy de `AuditProgress.tsx` con el de `page.tsx` una vez resuelto WR-01.

### IN-02: `CATEGORY_ORDER` se exporta de `build.ts` pero no del barrel, forzando la cuarta copia del literal

**File:** `packages/report-model/src/index.ts` (ausencia) / `apps/web/app/components/ui/labels.ts:11`
**Issue:** La decisión de 29-01 de no ampliar la API pública del paquete es defendible, pero su efecto es que `apps/web` no puede consumir el array y lo redeclara. El repo queda con cuatro literales paralelos de la lista de categorías (`report-model/build.ts:25`, `export/labels.ts:10`, `web/labels.ts:11`, `export/test-fixtures.ts:44`) más el literal de `issuesByCategory` de WR-04. Los guardarrailes de 29-03 detectan la divergencia, que es lo importante, pero el costo de mantenimiento (cinco sitios a editar por categoría nueva) es una decisión que conviene revisitar en Phase 30, cuando el patrón se ejercite por primera vez de verdad.
**Fix:** exportar `CATEGORY_ORDER` desde `packages/report-model/src/index.ts` y consumirlo desde `apps/web`; queda como única duplicación deliberada la de `packages/export` (que no debe depender de la web).

### IN-03: Fallback muerto en `test-fixtures.ts`

**File:** `packages/export/src/test-fixtures.ts:85`
**Issue:** `const cat = (issue.category as Category) ?? "tech";` — `ReportIssue.category` es `string` requerido, nunca `null` ni `undefined`, así que el `?? "tech"` es inalcanzable. Peor: sugiere que protege contra una categoría inválida, cuando la protección real es el `if (issuesByCategory[cat])` de la línea siguiente.
**Fix:** eliminar el `?? "tech"`.

### IN-04: `cms-adapters` conserva seis referencias a un checkId que ya no se puede emitir, sin nota que lo explique

**Files:** `packages/cms-adapters/src/types.ts:42`, `wordpress.ts:42`, `shopify.ts:20`, `webflow.ts:20`, `wixSquarespace.ts:23`, `wixSquarespace.ts:48`
**Issue:** Conservarlas es la decisión correcta y está bien razonada (las filas `Issue` históricas resuelven su copy de fix en tiempo de lectura). El problema es que la explicación vive sólo en `packages/checks/src/registry.test.ts:24-49` y en `PROJECT.md`, en otro paquete. Quien abra `wordpress.ts` va a ver una entrada para un check que no existe en el catálogo y su lectura razonable es "código muerto, borrar" — que rompería la copy de los reportes históricos.
**Fix:** un comentario de una línea junto a `"ONPAGE-05"` en `types.ts:42`, del tipo `// Retirado del catálogo activo en v1.6; se conserva para resolver copy de reportes históricos (SOCIAL-09).`

### IN-05: Archivo de test de vitest dentro del árbol `app/` del App Router

**File:** `apps/web/app/components/ui/labels.test.ts`
**Issue:** El archivo importa `vitest` desde dentro de `apps/web/app/`. Hoy es inerte (Next.js sólo compila lo alcanzable desde rutas, y este archivo no lo es), y el gemelo `packages/export/src/labels.test.ts` justifica la colocación por simetría. Se anota porque el resto de los tests de la web viven en `apps/web/tests/`, así que la convención del repo queda ambigua a partir de este commit.
**Fix:** ninguno obligatorio. Si se prefiere consistencia, mover a `apps/web/tests/components/ui/labels.test.ts`; si se prefiere colocación, dejarlo y anotar la convención cuando la sección Conventions de `CLAUDE.md` se empiece a poblar.

---

_Reviewed: 2026-08-01T23:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
