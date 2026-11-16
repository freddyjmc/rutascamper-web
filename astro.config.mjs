import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://rutascamper.com",
  trailingSlash: "always",
  // Seguridad: ningún script va dentro del HTML (así la CSP puede prohibir los scripts en línea).
  vite: { build: { assetsInlineLimit: (file) => (file.endsWith(".js") ? false : undefined) } },
  // Las fichas sin verificar no se generan en producción (ver visible() en src/site.ts).
  // Mi ruta y Mis guardados son personales (noindex): no van al sitemap.
  integrations: [
    sitemap({
      filter: (page) => !/\/(mi-ruta|mis-guardados|no-disponible)\/$/.test(page),
      // hreflang en el sitemap solo entre páginas que existen en cada idioma.
      i18n: { defaultLocale: "es", locales: { es: "es-ES", en: "en-GB", fr: "fr-FR" } },
    }),
  ],
});
