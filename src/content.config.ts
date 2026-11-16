import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob, file } from "astro/loaders";

const fuente = z.object({
  titulo: z.string(),
  url: z.string().url(),
  // oficial: BOE, boletín autonómico u ordenanza. secundaria: prensa o foros (solo como pista).
  tipo: z.enum(["oficial", "secundaria"]),
  fecha: z.coerce.date().optional(),
});

// Solo se publica en producción lo que tenga verificado: true, es decir,
// contrastado con al menos una fuente oficial.
const comunidades = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/comunidades" }),
  schema: z.object({
    nombre: z.string(),
    resumen: z.string(),
    normaAutonomica: z.string().optional(),
    claves: z.array(z.string()).default([]),
    // Resumen de una línea para la tabla comparativa del artículo central.
    pernoctaVia: z.string().optional(),
    estanciaAreas: z.string().optional(),
    fuentes: z.array(fuente).default([]),
    revisado: z.coerce.date().optional(),
    verificado: z.boolean().default(false),
  }),
});

const municipios = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/municipios" }),
  schema: z.object({
    nombre: z.string(),
    comunidad: z.string(),
    provincia: z.string(),
    estado: z.enum(["permitido", "restringido", "prohibido", "sin-datos"]),
    resumen: z.string(),
    reglas: z.array(z.string()).default([]),
    areas: z
      .array(
        z.object({
          nombre: z.string(),
          detalle: z.string().optional(),
          // Coordenadas solo si las publica una fuente oficial (coordFuente), para el mapa.
          lat: z.number().min(27).max(44).optional(),
          lon: z.number().min(-19).max(5).optional(),
          coordFuente: z.string().url().optional(),
          // aproximada: la fuente oficial describe el lugar sin coordenadas y lo situamos con OpenStreetMap.
          coordTipo: z.enum(["oficial", "aproximada"]).default("oficial"),
          // Áreas donde solo se puede vaciar y cargar agua, sin pernocta.
          soloServicios: z.boolean().default(false),
          // Estacionamiento para autocaravanas cuya fuente no dice si se puede pasar la noche (sin campo = área para pernoctar).
          pernocta: z.enum(["si", "sin-confirmar"]).optional(),
          // Quién creó el dato de ubicación en DATAtourisme (obligatorio si coordFuente es de data.datatourisme.fr).
          coordCreador: z.string().optional(),
        }).refine((a) => (a.lat === undefined) === (a.lon === undefined) && (a.lat === undefined || !!a.coordFuente), {
          message: "lat y lon van juntas y necesitan coordFuente",
        }),
      )
      .default([]),
    multa: z.string().optional(),
    fuentes: z.array(fuente).default([]),
    revisado: z.coerce.date().optional(),
    verificado: z.boolean().default(false),
  }),
});

// Rutas: cada noche enlaza, si existe, a la ficha verificada del municipio donde dormir.
// `pais` es "es" (ficha "comunidad/slug" de municipios) o "fr" (ficha "region/slug" de francia/municipios);
// en `comunidades` van los ids de comunidad (España) o de región (Francia).
const rutas = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/rutas" }),
  schema: z.object({
    pais: z.enum(["es", "fr", "pt"]).default("es"),
    titulo: z.string(),
    h1: z.string(),
    resumen: z.string(),
    dias: z.number(),
    comunidades: z.array(z.string()),
    cuando: z.string(),
    etapas: z.array(
      z.object({
        dia: z.string(),
        titulo: z.string(),
        texto: z.string(),
        dormir: z.string(),
        ficha: z.string().optional(),
      }),
    ),
    consejos: z.array(z.string()).default([]),
    revisado: z.coerce.date(),
    publicada: z.boolean().default(false),
  }),
});

// Fotos por destino (manifiesto src/data/fotos.json, imágenes en src/assets/fotos/).
// Solo imágenes de Wikimedia Commons con licencia libre y crédito completo.
const LICENCIAS = [
  "CC0 1.0", "Dominio público",
  "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
  "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 3.0 DE", "CC BY-SA 4.0",
] as const;
const fotos = defineCollection({
  loader: file("./src/data/fotos.json"),
  schema: z.object({
    // "comunidades/<id>", "municipios/<comunidad>/<slug>", "paises/<codigo>", "francia/<region>", "francia/<region>/<slug>", "portugal/<region>" o "portugal/<region>/<slug>"
    id: z.string().regex(/^(comunidades\/[a-z0-9-]+|municipios\/[a-z0-9-]+\/[a-z0-9-]+|paises\/[a-z]{2}|(francia|portugal)\/[a-z0-9-]+(\/[a-z0-9-]+)?)$/, "id debe ser comunidades/<id>, municipios/<comunidad>/<slug>, paises/<codigo>, francia/<region>, francia/<region>/<slug>, portugal/<region> o portugal/<region>/<slug>"),
    archivo: z.string().regex(/^[^/\\]+\.(jpe?g|png)$/i, "archivo debe ser un jpg o png sin carpetas"),
    alt: z.string().min(10),
    titulo: z.string().min(1),
    autor: z.string().min(1),
    licencia: z.enum(LICENCIAS),
    licenciaUrl: z.string().url().startsWith("https://"),
    origen: z.string().url().startsWith("https://commons.wikimedia.org/wiki/File:"),
    cambios: z.string().min(1),
    // Firma que pide el autor en Commons, si la pide (se muestra en lugar de «autor»).
    atribucion: z.string().min(1).optional(),
    consultado: z.coerce.date(),
    focal: z.string().regex(/^\d{1,3}% \d{1,3}%$/, 'focal debe ser como "50% 55%"').optional(),
  }),
});

// ---- Francia (colecciones propias: no tocan las de España) ----
const fuenteFr = fuente.extend({
  // Cláusula de reutilización de la fuente, copiada tal cual.
  reutilizacion: z.string().optional(),
  // Fuente que solo permite uso no comercial: no puede sostener una ficha verificada si el sitio se monetiza.
  noComercial: z.boolean().default(false),
});
const temporadaFr = z.array(
  z.object({
    texto: z.string(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    fuente: z.string().optional(),
  }),
);

const nacionalFr = defineCollection({
  loader: glob({ pattern: "nacional.json", base: "./src/data/francia" }),
  schema: z.object({
    nombre: z.string(),
    resumen: z.string(),
    secciones: z.array(z.object({ titulo: z.string(), puntos: z.array(z.string()).default([]) })).default([]),
    fuentes: z.array(fuenteFr).default([]),
    // Traducciones del texto nacional (mismo orden y mismo número de secciones y puntos que el original en español).
    i18n: z.record(z.enum(["en", "fr"]), z.object({
      resumen: z.string(),
      secciones: z.array(z.object({ titulo: z.string(), puntos: z.array(z.string()) })),
    })).optional(),
    revisado: z.coerce.date().optional(),
    verificado: z.boolean().default(false),
  }),
});

const regionesFr = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/francia/regiones" }),
  schema: z.object({
    nombre: z.string(),
    resumen: z.string(),
    normaAutonomica: z.string().optional(),
    claves: z.array(z.string()).default([]),
    pernoctaVia: z.string().optional(),
    estanciaAreas: z.string().optional(),
    temporada: temporadaFr.optional(),
    notaAyuntamiento: z.string().optional(),
    bloqueado: z.boolean().default(false),
    fuentes: z.array(fuenteFr).default([]),
    revisado: z.coerce.date().optional(),
    verificado: z.boolean().default(false),
  }),
});

const esquemaMunicipio = (b: { latMin: number; latMax: number; lonMin: number; lonMax: number }) =>
  z.object({
    nombre: z.string(),
    comunidad: z.string(),
    provincia: z.string(),
    estado: z.enum(["permitido", "restringido", "prohibido", "sin-datos"]),
    resumen: z.string(),
    reglas: z.array(z.string()).default([]),
    areas: z
      .array(
        z.object({
          nombre: z.string(),
          detalle: z.string().optional(),
          // lat y lon van juntas y con fuente; el rango depende del país.
          lat: z.number().min(b.latMin).max(b.latMax).optional(),
          lon: z.number().min(b.lonMin).max(b.lonMax).optional(),
          coordFuente: z.string().url().optional(),
          coordTipo: z.enum(["oficial", "aproximada"]).default("oficial"),
          soloServicios: z.boolean().default(false),
          // Estacionamiento para autocaravanas cuya fuente no dice si se puede pasar la noche (sin campo = área para pernoctar).
          pernocta: z.enum(["si", "sin-confirmar"]).optional(),
          // Quién creó el dato de ubicación en DATAtourisme (obligatorio si coordFuente es de data.datatourisme.fr).
          coordCreador: z.string().optional(),
        }).refine((a) => (a.lat === undefined) === (a.lon === undefined) && (a.lat === undefined || !!a.coordFuente), {
          message: "lat y lon van juntas y necesitan coordFuente",
        }),
      )
      .default([]),
    multa: z.string().optional(),
    temporada: temporadaFr.optional(),
    notaAyuntamiento: z.string().optional(),
    bloqueado: z.boolean().default(false),
    fuentes: z.array(fuenteFr).default([]),
    revisado: z.coerce.date().optional(),
    verificado: z.boolean().default(false),
  });

const municipiosFr = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/francia/municipios" }),
  // Francia metropolitana.
  schema: esquemaMunicipio({ latMin: 41, latMax: 51.2, lonMin: -5.2, lonMax: 9.6 }),
});

// ---- Portugal (mismo esquema que Francia; coordenadas: continente, Madeira y Azores) ----
const nacionalPt = defineCollection({
  loader: glob({ pattern: "nacional.json", base: "./src/data/portugal" }),
  schema: nacionalFr.schema,
});
const regionesPt = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/portugal/regiones" }),
  schema: regionesFr.schema,
});
const municipiosPt = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/portugal/municipios" }),
  schema: esquemaMunicipio({ latMin: 32, latMax: 42.3, lonMin: -31.5, lonMax: -6 }),
});

export const collections = { comunidades, municipios, rutas, fotos, nacionalFr, regionesFr, municipiosFr, nacionalPt, regionesPt, municipiosPt };
