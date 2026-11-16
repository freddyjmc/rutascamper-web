// Idiomas del sitio. El español es el original y no lleva prefijo; el resto va bajo /en/, /fr/…
// Para añadir un idioma (pt, de, it): crear su archivo de textos (como en.ts), añadirlo a LANGS, a META y a TEXTOS,
// y listar en TRADUCIDAS las páginas que ya tiene. Las vistas (src/views) piden sus textos por idioma.
import { T as es } from "./es";
import { T as en } from "./en";
import { T as fr } from "./fr";
import type { Pais } from "../lib/paises";

export const LANGS = ["es", "en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "es";
/** Idiomas con prefijo en la dirección (todos menos el original). */
export const OTHER_LANGS = LANGS.filter((l) => l !== DEFAULT_LANG) as Exclude<Lang, "es">[];

export const META: Record<Lang, { nombre: string; corto: string; locale: string; fecha: string }> = {
  es: { nombre: "Español", corto: "ES", locale: "es_ES", fecha: "es-ES" },
  en: { nombre: "English", corto: "EN", locale: "en_GB", fecha: "en-GB" },
  fr: { nombre: "Français", corto: "FR", locale: "fr_FR", fecha: "fr-FR" },
};

const TEXTOS = { es, en, fr };
export const t = (lang: Lang) => TEXTOS[lang];

/** Páginas (dirección española) ya traducidas a cada idioma. Solo estas generan hreflang y selector directo. */
const COMUN = ["/", "/destinos/", "/pernocta/", "/francia/", "/portugal/", "/metodo/", "/quienes-somos/", "/aviso-legal/", "/privacidad/", "/cookies/", "/normativa-pernocta-camper/", "/multas-acampar-camper/", "/pernoctar-playa-camper/", "/camper-parques-naturales/"];
export const TRADUCIDAS: Record<Exclude<Lang, "es">, string[]> = { en: COMUN, fr: COMUN };
/** Páginas cuyo texto traducido debe contener también todas las cifras del original (lo comprueba check.mjs). */
export const COMPLETAS = ["/metodo/", "/quienes-somos/", "/aviso-legal/", "/privacidad/", "/cookies/"];

export const traducida = (lang: Lang, path: string) => lang === "es" || TRADUCIDAS[lang].includes(path);

/** Dirección de una página (dada en español) dentro de un idioma, sin comprobar que exista. */
export const localePath = (lang: Lang, path: string) => (lang === "es" ? path : `/${lang}${path}`);

/** Enlace desde una página en `lang`: a la versión traducida si existe; si no, a la española. */
export const href = (lang: Lang, path: string) => (traducida(lang, path) ? localePath(lang, path) : path);

/** Separa idioma y dirección española de una dirección del sitio. */
export function splitLang(pathname: string): { lang: Lang; path: string } {
  const m = pathname.match(/^\/(en|fr)(\/.*)?$/);
  return m ? { lang: m[1] as Lang, path: m[2] ?? "/" } : { lang: "es", path: pathname };
}

/** Enlace del selector de idioma: la misma página en `target`, o la página de «no disponible». */
export const switchHref = (target: Lang, path: string) =>
  traducida(target, path) ? localePath(target, path) : `/${target}/no-disponible/?p=${encodeURIComponent(path)}`;

/** Países con los nombres y textos del idioma (y la cabecera traducida si existe). */
export const paisesEn = (paises: Pais[], lang: Lang): Pais[] =>
  paises.map((p) => {
    const x = (t(lang).paises as Record<string, { nombre: string; regionUno: string; regionVarias: string; regionTitulo: string; resumen: string }>)[p.code];
    return { ...p, nombre: x.nombre, regionUno: x.regionUno, regionVarias: x.regionVarias, regionTitulo: x.regionTitulo, resumen: x.resumen, base: href(lang, p.base) };
  });

/** Parámetros de ruta para las páginas bajo /[lang]/ (todos los idiomas menos el original). */
export const langParams = () => OTHER_LANGS.map((lang) => ({ params: { lang } }));
