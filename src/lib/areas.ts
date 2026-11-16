// Índice de áreas con coordenadas, generado en el build. Mismo criterio y mismo id que el mapa:
// id = `${slug}-${posición+1}`, con slug = id del municipio sin la comunidad.
// Los países distintos de España llevan su código como prefijo (`fr-`, `pt-`) para no chocar nunca con los de España.
// Para añadir un país con áreas en el mapa: una función como `cargaEspana` o `cargaFrancia` en CARGAS.
import { getCollection } from "astro:content";
import { visible, visibleFr, nombreFr } from "../site";
import type { PaisCode } from "../i18n/es";
import { getPaises, type Pais } from "./paises";

export type AreaIndice = {
  id: string; nombre: string; municipio: string; comunidad: string; url: string;
  lat: number; lon: number; aproximada: boolean; soloServicios: boolean;
  /** País al que pertenece (código del registro de países). */
  pais: PaisCode;
  /** Fuente oficial de las coordenadas (la misma que cita la ficha). */
  fuente: string;
  detalle: string;
  /** El estacionamiento existe, pero la fuente no dice si se puede pasar la noche. */
  sinConfirmar: boolean;
  /** Quién creó el dato de la ubicación (solo DATAtourisme) y fecha de la fuente (dd/mm/aaaa). */
  creador?: string;
  fechaFuente?: string;
  /** Solo Francia y Portugal: nombre original de la región (para en/fr). */
  comunidadLocal?: string;
};
const fechaCorta = (d?: Date) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : undefined);
const datosFuente = (a: { coordCreador?: string; pernocta?: string }, fuentes: { url: string; fecha?: Date }[], coordFuente: string) => ({
  sinConfirmar: a.pernocta === "sin-confirmar",
  creador: a.coordCreador,
  fechaFuente: fechaCorta(fuentes.find((f) => f.url === coordFuente)?.fecha),
});
export type AreaSinCoords = { nombre: string; municipio: string; ficha: string };
type Carga = { areas: AreaIndice[]; sinCoords: AreaSinCoords[] };

async function cargaEspana(): Promise<Carga> {
  const comunidades = Object.fromEntries((await getCollection("comunidades")).map((c) => [c.id, c.data.nombre]));
  const areas: AreaIndice[] = [];
  const sinCoords: AreaSinCoords[] = [];
  const municipios = (await getCollection("municipios")).filter(visible).sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, "es"));
  for (const m of municipios) {
    const slug = m.id.split("/").pop()!;
    const url = `/pernocta/${m.data.comunidad}/${slug}/`;
    m.data.areas.forEach((a, i) => {
      if (a.lat !== undefined && a.lon !== undefined && a.coordFuente) {
        areas.push({
          id: `${slug}-${i + 1}`, nombre: a.nombre, municipio: m.data.nombre,
          comunidad: comunidades[m.data.comunidad] ?? m.data.comunidad, url,
          lat: a.lat, lon: a.lon, aproximada: a.coordTipo === "aproximada", soloServicios: a.soloServicios,
          pais: "es", fuente: a.coordFuente, detalle: a.detalle ?? "", ...datosFuente(a, m.data.fuentes, a.coordFuente),
        });
      } else sinCoords.push({ nombre: a.nombre, municipio: m.data.nombre, ficha: url });
    });
  }
  return { areas, sinCoords };
}

async function cargaNacional(pais: "fr" | "pt", base: string, cols: { reg: "regionesFr" | "regionesPt"; mun: "municipiosFr" | "municipiosPt" }): Promise<Carga> {
  const regiones = Object.fromEntries((await getCollection(cols.reg)).map((r) => [r.id, nombreFr(r.data.nombre)]));
  const areas: AreaIndice[] = [];
  const sinCoords: AreaSinCoords[] = [];
  const municipios = (await getCollection(cols.mun)).filter(visibleFr).sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, "es"));
  for (const m of municipios) {
    const slug = m.id.split("/").pop()!;
    const reg = regiones[m.data.comunidad];
    const url = `${base}${m.data.comunidad}/${slug}/`;
    m.data.areas.forEach((a, i) => {
      if (a.lat !== undefined && a.lon !== undefined && a.coordFuente) {
        areas.push({
          id: `${pais}-${slug}-${i + 1}`, nombre: a.nombre, municipio: m.data.nombre,
          comunidad: reg?.es ?? m.data.comunidad, comunidadLocal: reg?.fr, url,
          lat: a.lat, lon: a.lon, aproximada: a.coordTipo === "aproximada", soloServicios: a.soloServicios,
          pais, fuente: a.coordFuente, detalle: a.detalle ?? "", ...datosFuente(a, m.data.fuentes, a.coordFuente),
        });
      } else sinCoords.push({ nombre: a.nombre, municipio: m.data.nombre, ficha: url });
    });
  }
  return { areas, sinCoords };
}

const cargaFrancia = () => cargaNacional("fr", "/francia/", { reg: "regionesFr", mun: "municipiosFr" });
const cargaPortugal = () => cargaNacional("pt", "/portugal/", { reg: "regionesPt", mun: "municipiosPt" });

const CARGAS: Record<PaisCode, () => Promise<Carga>> = { es: cargaEspana, fr: cargaFrancia, pt: cargaPortugal };
const cache = new Map<PaisCode, Promise<Carga>>();
const carga = (p: PaisCode) => cache.get(p) ?? (cache.set(p, CARGAS[p]()), cache.get(p)!);

export async function areasIndice(pais: PaisCode = "es"): Promise<AreaIndice[]> {
  return (await carga(pais)).areas;
}

/** Áreas del mapa agrupadas por país, en el orden del registro de países. Solo países con alguna área con ubicación. */
export async function areasPorPais(): Promise<{ pais: Pais; areas: AreaIndice[]; sinCoords: AreaSinCoords[] }[]> {
  const out = [];
  for (const pais of await getPaises()) {
    const c = await carga(pais.code);
    if (c.areas.length) out.push({ pais, ...c });
  }
  return out;
}

/** Todas las áreas con coordenadas de todos los países (para «Mi ruta»). Los ids no se repiten. */
export async function areasTodas(): Promise<AreaIndice[]> {
  const todas = (await areasPorPais()).flatMap((x) => x.areas);
  const vistos = new Set<string>();
  for (const a of todas) {
    if (vistos.has(a.id)) throw new Error(`Id de área repetido entre países: ${a.id}`);
    vistos.add(a.id);
  }
  return todas;
}
