---
status: testing
phase: 32-panel-de-preview-social-snippets-de-fix
source: [32-VERIFICATION.md]
started: 2026-08-06T00:00:00Z
updated: 2026-08-06T00:00:00Z
---

## Current Test

number: 1
name: Panel de Google visible con datos reales
expected: |
  El panel "Vista previa al compartir" se ve con favicon, dominio, título, URL y descripción reales de esa página.
awaiting: user response

## Tests

### 1. Panel de Google visible con datos reales
expected: El panel se ve con favicon, dominio, título, URL y descripción reales de esa página.
result: [pending]

### 2. Backstop — truncado de título de 300 caracteres en GooglePreview
expected: El título se trunca a 1 línea sin desbordar ni crecer el contenedor.
result: [pending]

### 3. Proxy de imágenes — comportamiento de red real
expected: Sólo la imagen "ok" genera un request al proxy; la "unavailable" no emite ningún request.
result: [pending]

### 4. Bloque de snippet de fix — visual e interacción de Clipboard
expected: Snippet visible en bloque scrolleable, botón siempre accesible, copiar funciona.
result: [pending]

### 5. Backstop — snippet de 5 etiquetas con valores largos
expected: Bloque scrolleable sin desbordar la card ni tapar el botón de copiar.
result: [pending]

### 6. Navegación por teclado de los 3 tabs + legibilidad del indicador
expected: Navegación fluida, indicador --accent legible en ambos temas, snippet alcanzable sin que el scroll horizontal atrape el foco.
result: [pending]

### 7. Backstop — truncado de título de 300 caracteres en SocialCardPreview/XPreview
expected: Ninguna tarjeta se desborda ni rompe su aspect-ratio.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
