---
status: testing
phase: 30-checks-de-meta-tags-social
source: [30-VERIFICATION.md]
started: 2026-08-03T10:55:00Z
updated: 2026-08-03T10:55:00Z
---

## Current Test

number: 1
name: Revisar el estrechamiento de SOCIAL-06 a la lista blanca de 7 propiedades og de valor único
expected: |
  Confirmar que excluir og:image, og:locale:alternate y las familias og:video*/og:audio* del check es la decisión deseada, y registrar un override si se acepta. La lista blanca es más estrecha que el Success Criterion #3 y que la regla lockeada en 30-CONTEXT.md, aunque coincide mejor con el objetivo de fase (una og:image repetida no rompe el compartido: es la forma documentada del protocolo para declarar varios recursos).
awaiting: user response

## Tests

### 1. Revisar el estrechamiento de SOCIAL-06 a la lista blanca de 7 propiedades og de valor único (og:title, og:description, og:url, og:type, og:site_name, og:locale, og:determiner) contra la regla lockeada en 30-CONTEXT.md
expected: Confirmar que excluir og:image, og:locale:alternate y las familias og:video*/og:audio* del check es la decisión deseada, y registrar un override si se acepta.
result: [pending]

### 2. Decidir el destino de WR-05: packages/cms-adapters/src/types.ts sigue listando ONPAGE-05 en SUPPORTED_CHECK_IDS y no contiene ninguna entrada SOCIAL-01..08
expected: Toda incidencia de Open Graph sobre WordPress/Shopify/Webflow/Wix/Squarespace pierde la recomendación específica de plataforma que tenía antes de v1.6 y cae al texto genérico, mientras un slot del catálogo lo ocupa un check que ya no puede dispararse. Ni Phase 31 ni Phase 32 lo cubren, así que o se planifica o se acepta explícitamente.
result: [pending]

### 3. Aceptar o corregir los falsos negativos de SOCIAL-08 (WR-01)
expected: Una página con `<meta name="description" content="Como declarar charset=utf-8">` y sin declaración real devuelve hasCharsetInFirstKB = true; una con la etiqueta comentada `<!-- <meta charset="utf-8"> -->` también. En los dos casos el usuario nunca ve la fila de advertencia. El comportamiento central es correcto.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
