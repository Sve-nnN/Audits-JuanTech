import type { PageFingerprintInput } from "../types";

/**
 * Fixtures de CALIBRACIÓN contra HTML REAL de sitios públicos por builder de
 * WordPress (cierra el blocker de STATE.md: firmas de builder eran MEDIUM
 * confidence). Cada `html` es un fragmento RECORTADO (no volcados de megabytes)
 * con los marcadores REALES capturados del sitio de origen el 2026-07-21 vía
 * fetch HTTP. Se conservan las clases/paths textuales que producen el match.
 *
 * Resultado de la QA: los marcadores de `signatures/builder.ts` (clases
 * `elementor-*`, `et_pb_*`, `vc_row`/`wpb_*`/`js_composer`) matchean en HTML real
 * sin necesidad de ajustar ninguna firma.
 */

// --- Elementor -------------------------------------------------------------

/** Origen: https://elementor.com/ (WordPress 6.9.5 + Elementor). */
export const elementorReal1: PageFingerprintInput = {
  url: "https://elementor.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="WordPress 6.9.5" /><link rel="stylesheet" href="https://elementor.com/wp-content/plugins/elementor/assets/css/widget-video.min.css" /></head><body><div class="elementor elementor-429 elementor-location-header" data-elementor-type="header" data-elementor-id="429"><section class="elementor-section elementor-top-section"></section></div></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

/** Origen: https://websitedemos.net/ (WordPress 6.9.5 + Astra + Elementor). */
export const elementorReal2: PageFingerprintInput = {
  url: "https://websitedemos.net/",
  isHome: true,
  html: `<html><head><meta name="generator" content="WordPress 6.9.5" /><link rel="stylesheet" href="https://websitedemos.net/wp-content/themes/astra/assets/css/minified/style.min.css" /></head><body><a class="elementor-button elementor-size-md elementor-animation-grow" href="#">Empezar</a></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

// --- Divi ------------------------------------------------------------------

/** Origen: https://www.elegantthemes.com/preview/Divi/ (tema Divi oficial). */
export const diviReal1: PageFingerprintInput = {
  url: "https://www.elegantthemes.com/preview/Divi/",
  isHome: true,
  html: `<html><head><link rel="stylesheet" href="https://www.elegantthemes.com/wp-content/themes/Divi/style.css" /><img src="https://www.elegantthemes.com/wp-content/themes/Divi/includes/builder/styles/images/preloader.gif" /></head><body><div class="et_pb_section et_pb_section_0 et_pb_fullwidth_section et_section_regular"><div class="et_pb_row et_pb_row_1"></div></div></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

/** Origen: https://divilover.com/ (WordPress 6.9 + tema Divi). */
export const diviReal2: PageFingerprintInput = {
  url: "https://divilover.com/",
  isHome: true,
  html: `<html><head><meta name="generator" content="WordPress 6.9" /><link rel="stylesheet" href="https://divilover.com/wp-content/themes/Divi/core/admin/css/theme.css" /></head><body><div class="et_pb_section et_pb_section_0 dl-corner-bl et_pb_with_background et_section_regular"><div class="et_pb_row et_pb_row_0"></div></div></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

// --- WPBakery --------------------------------------------------------------

/** Origen: https://wpbakery.com/ (WordPress + WPBakery / js_composer). */
export const wpbakeryReal1: PageFingerprintInput = {
  url: "https://wpbakery.com/",
  isHome: true,
  html: `<html><head><link rel="stylesheet" id="js_composer_front-css" href="https://wpbakery.com/wp-content/plugins/js_composer/assets/css/js_composer.min.css" /></head><body><div class="vc_row content-area wpb_row vc_row-fluid"><div class="wpb_column vc_column_container"></div></div></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

/** Origen: https://demo.wpbakery.com/ (tema Dazzling + WPBakery / js_composer). */
export const wpbakeryReal2: PageFingerprintInput = {
  url: "https://demo.wpbakery.com/",
  isHome: true,
  html: `<html><head><link rel="stylesheet" id="js_composer_front-css" href="https://demo.wpbakery.com/wp-content/plugins/js_composer/assets/css/js_composer.min.css" /><link rel="stylesheet" href="https://demo.wpbakery.com/wp-content/themes/dazzling/inc/css/bootstrap.min.css" /></head><body><div class="vc_row wpb_row vc_row-fluid vc_custom_1449223123447 vc_row-has-fill vc_general vc_parallax"></div></body></html>`,
  responseHeaders: {},
  cookieNames: [],
};

/** Todos los fixtures reales con su builder esperado (verdad conocida). */
export const realBuilderFixtures: { page: PageFingerprintInput; expectedBuilder: string }[] = [
  { page: elementorReal1, expectedBuilder: "Elementor" },
  { page: elementorReal2, expectedBuilder: "Elementor" },
  { page: diviReal1, expectedBuilder: "Divi" },
  { page: diviReal2, expectedBuilder: "Divi" },
  { page: wpbakeryReal1, expectedBuilder: "WPBakery" },
  { page: wpbakeryReal2, expectedBuilder: "WPBakery" },
];
