# Fuentes embebidas del PDF (`@auditor/export`)

Estos TTF se embeben en el serializer PDF (`src/pdf.tsx`, vía `@react-pdf/renderer`).
`@react-pdf/renderer` **solo acepta TTF/OTF** (no `woff2`), por eso vendorizamos los
`.ttf` aquí en lugar de reusar los `woff2` que sirve la web con `next/font`.

## Roles tipográficos v1.1 (preferencia validada `array-no-titulos`)

| Rol | Familia | Archivo(s) | Peso(s) |
|-----|---------|-----------|---------|
| Headings / títulos | **Khand** | `Khand-Regular.ttf`, `Khand-SemiBold.ttf` | 400, 600 |
| Body / texto corrido | **Geist Sans** | `GeistSans-Regular.ttf` | 400 |

**Array NO se usa en títulos** (queda reservada a display puntual en la web) y por eso
**no** se materializa aquí. No añadir un TTF de Array a este directorio.

Ambas familias tienen cobertura Latin completa (`áéíóúñ¿¡ÁÉÍÓÚÑ`), verificada con
`fontkit.hasGlyphForCodePoint`, así que sirven tanto para heading como para body sin
caer al Helvetica core de PDF (que no cubre bien los acentos del español).

## Origen y licencia

Todas las fuentes son **OFL (SIL Open Font License 1.1)**, redistribución libre:

- **Khand** — Google Fonts, `ofl/khand` del repo oficial [`google/fonts`](https://github.com/google/fonts/tree/main/ofl/khand). TTF estáticos descargados directo (sin recomprimir).
- **Geist Sans** — proyecto [Geist](https://github.com/vercel/geist-font) de Vercel (OFL). Se copia el `Geist-Regular.ttf` que ya trae el paquete npm `geist` en `node_modules` (misma fuente que sirve la web).

## Regenerar

Reproducible vía script (preferir TTF directo; fallback woff2→sfnt con `wawoff2`,
que es `devDependency`):

```bash
node packages/export/scripts/fetch-fonts.mjs
```

El script valida cada archivo como sfnt válido (firma `0x00010000` / `OTTO` / `true`)
antes de escribirlo.
