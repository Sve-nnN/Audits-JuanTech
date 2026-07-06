# UI Feedback de Juan — validación visual v1.1 (2026-07-06)

Feedback de Juan tras validar la Fase 8 en el dev server. Insumo dirigido para el discuss/plan de Fases 9 y 10. Léelo al planificar esas fases.

## Decisiones de marca (locked)

- **Array NO se aplica a títulos.** Los títulos van en Khand y a Juan le gusta así. `--font-array` queda expuesta (FONT-01) por si se usa en algún display puntual, pero NO es la fuente de headings. No "arreglar" esto aplicando Array a H1/H2.

## Gaps de UI/UX reportados (spacing/layout + componentes)

Juan marcó problemas en **Home**, **Header/Footer (shell)** y **Reporte /audits/[id]**, tipo spacing/layout/alineación + componentes/interacción. El shell base (Fase 8) se validó OK; el resto se rediseña acá:

### Home (SCREEN-01, Fase 10)
- La card del formulario flota con un **vacío vertical enorme arriba** (centrado a 100vh). Rehacer el hero con jerarquía y densidad correctas, sin dead space.
- **Contraste bajo** del texto de descripción y del footnote (gris tenue sobre fondo oscuro). Subir a AA (usar `--text-secondary`/`--muted` con contraste verificado).

### Reporte /audits/[id] (COMP-01..05 en Fase 9 → ensamblado en SCREEN-04, Fase 10)
- Spacing/layout y componentes (score gauge, cards de categoría, tabla de issues, acordeón, métricas) a reconstruir con la librería de Fase 9.

### Shell (Fase 8, ya validado)
- Header/footer base OK. Si al ensamblar pantallas aparece desalineación puntual, ajustar en Fase 10.

## Copy — voceo (COPY-01/02, Fase 10)
- El copy actual tiene **voceo** ("Ingresá", "podés", "te damos"). Regla dura: español neutro SIN voceo. Reescribir todo el copy de UI en Fase 10 vía skill humanizer. Ej: "Ingresá tu email" → "Ingresa tu correo".

## Nota de proceso
- Juan valida el render él mismo y es pixel-perfect / design-conscious. Las Fases 9/10 deben pasar por validación visual en dev server antes de cerrar.
