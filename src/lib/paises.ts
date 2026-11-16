// Registro único de países. Un país aparece solo si tiene contenido publicado.
// Para añadir uno: una función como `espana` o `francia`, añadirla a PAISES,
// sus textos en src/i18n/es.ts y sus páginas.
import { getCollection, getEntry } from "astro:content";
import { ESTADOS, visible, visibleFr, nombreFr } from "../site";
import { T, type PaisCode } from "../i18n/es";

type Estado = keyof typeof ESTADOS;
export interface Region {
  id: string;
  nombre: string;
  /** Nombre en el idioma local si difiere (Bretagne). */
  nombreLocal?: string;
  href: string;
  /** Ficha de la región (colección). */
  entry: any;
  n: number;
  mix: Partial<Record<Estado, number>>;
  /** Texto para buscar. */
  claves: string;
}
export interface Pais {
  code: PaisCode;
  base: string;
  /** Dirección del hub en español (las fichas de municipio cuelgan de aquí en todos los idiomas). */
  baseEs: string;
  nombre: string;
  regionUno: string;
  regionVarias: string;
  regionTitulo: string;
  resumen: string;
  regiones: Region[];
  municipios: any[];
  nRegiones: number;
  nMunicipios: number;
  fuentes: string[];
  /** Hay fotos por región (manifiesto de fotos). */
  fotos: boolean;
  /** Id de la foto de una región en el manifiesto: comunidades/<id> en España, francia/<id> en Francia, portugal/<id> en Portugal. */
  fotoRegion: (id: string) => string;
  /** Cifras calculadas de los datos visibles. `clave` busca la etiqueta en T.paises[code].cifras. */
  cifras: { n: number; clave: "municipios" | "regiones" | "provincias" | "fuentes" }[];
  /** Fecha `revisado` más reciente entre las fichas visibles de municipio (o de región/guía si no hay ninguna). */
  ultimaRevision?: Date;
  /** Las fichas de municipio visibles revisadas más recientemente. */
  novedades: Novedad[];
  /** Municipios revisados agrupados por provincia (España), departamento (Francia) o distrito (Portugal). */
  provincias: { nombre: string; items: { nombre: string; href: string; estado: Estado }[] }[];
  nProvincias: number;
}
export interface Novedad { nombre: string; href: string; region: string; fecha: Date; provincia: string }

const ESTADOS_K = Object.keys(ESTADOS) as Estado[];
const mixDe = (munis: any[]) => Object.fromEntries(ESTADOS_K.map((k) => [k, munis.filter((m) => m.data.estado === k).length])) as Record<Estado, number>;
const NOVEDADES = 6;
const limpia = (s: string) => s.replace(/\s+/g, " ").trim();
const masReciente = (ds: (Date | undefined)[]) => ds.reduce<Date | undefined>((a, d) => (d && (!a || d > a) ? d : a), undefined);
/** Cifras y listas derivadas de los municipios visibles de un país: se recalculan solas al añadir fichas. */
function derivados(municipios: any[], regiones: Region[], base: string, extra: (Date | undefined)[]) {
  const nombreRegion = new Map(regiones.map((r) => [r.id, r.nombre]));
  const hrefDe = (m: any) => `${base}${m.data.comunidad}/${m.id.split("/").pop()}/`;
  const novedades: Novedad[] = [...municipios]
    .filter((m) => m.data.revisado)
    .sort((a, b) => b.data.revisado.getTime() - a.data.revisado.getTime() || a.data.nombre.localeCompare(b.data.nombre, "es"))
    .slice(0, NOVEDADES)
    .map((m) => ({ nombre: m.data.nombre, href: hrefDe(m), region: nombreRegion.get(m.data.comunidad) ?? m.data.comunidad, fecha: m.data.revisado, provincia: limpia(m.data.provincia ?? "") }));
  const porProv = new Map<string, { nombre: string; href: string; estado: Estado }[]>();
  for (const m of municipios) {
    const p = limpia(m.data.provincia ?? "");
    if (!p) continue;
    if (!porProv.has(p)) porProv.set(p, []);
    porProv.get(p)!.push({ nombre: m.data.nombre, href: hrefDe(m), estado: m.data.estado });
  }
  const provincias = [...porProv.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([nombre, items]) => ({ nombre, items: items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) }));
  const ultimaRevision = masReciente([...municipios.map((m) => m.data.revisado), ...extra]);
  return { novedades, provincias, nProvincias: provincias.length, ultimaRevision };
}
const urlsOficiales = (es: any[]) => es.flatMap((e) => e.data.fuentes.filter((f: any) => f.tipo === "oficial").map((f: any) => f.url));

async function espana(): Promise<Pais | null> {
  const comunidades = (await getCollection("comunidades")).filter(visible).sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, "es"));
  if (!comunidades.length) return null;
  const municipios = (await getCollection("municipios")).filter(visible);
  const t = T.paises.es;
  const regiones: Region[] = comunidades.map((c) => {
    const suyos = municipios.filter((m) => m.data.comunidad === c.id);
    return { id: c.id, nombre: c.data.nombre, href: `/pernocta/${c.id}/`, entry: c, n: suyos.length, mix: mixDe(suyos), claves: c.data.nombre };
  });
  const d = derivados(municipios, regiones, "/pernocta/", comunidades.map((c) => c.data.revisado));
  const fuentes = urlsOficiales([...comunidades, ...municipios]);
  return {
    code: "es", base: "/pernocta/", baseEs: "/pernocta/", nombre: t.nombre, regionUno: t.regionUno, regionVarias: t.regionVarias, regionTitulo: t.regionTitulo, resumen: t.resumen,
    regiones,
    municipios, nRegiones: comunidades.length, nMunicipios: municipios.length,
    fuentes, fotos: true, fotoRegion: (id) => `comunidades/${id}`,
    cifras: [
      { n: municipios.length, clave: "municipios" },
      { n: comunidades.length, clave: "regiones" },
      { n: d.nProvincias, clave: "provincias" },
      { n: new Set(fuentes).size, clave: "fuentes" },
    ],
    ...d,
  };
}

/** País con la estructura de Francia: guía nacional + regiones + municipios, todo con visibilidad `visibleFr` (verificado y sin bloquear). */
async function paisNacional(code: "fr" | "pt", base: string, cols: { nac: "nacionalFr" | "nacionalPt"; reg: "regionesFr" | "regionesPt"; mun: "municipiosFr" | "municipiosPt" }, fotoBase: string): Promise<Pais | null> {
  const nac = await getEntry(cols.nac, "nacional");
  if (!nac || !visibleFr(nac)) return null;
  const regiones = (await getCollection(cols.reg)).filter(visibleFr).sort((a, b) => nombreFr(a.data.nombre).es.localeCompare(nombreFr(b.data.nombre).es, "es"));
  const municipios = (await getCollection(cols.mun)).filter(visibleFr);
  const t = T.paises[code];
  const regs: Region[] = regiones.map((r) => {
    const suyos = municipios.filter((m) => m.data.comunidad === r.id);
    const nom = nombreFr(r.data.nombre);
    return { id: r.id, nombre: nom.es, nombreLocal: nom.es !== nom.fr ? nom.fr : undefined, href: `${base}${r.id}/`, entry: r, n: suyos.length, mix: mixDe(suyos), claves: `${nom.es} ${nom.fr}` };
  });
  const d = derivados(municipios, regs, base, [nac.data.revisado, ...regiones.map((r) => r.data.revisado)]);
  const fuentes = urlsOficiales([nac, ...regiones, ...municipios]);
  return {
    code, base, baseEs: base, nombre: t.nombre, regionUno: t.regionUno, regionVarias: t.regionVarias, regionTitulo: t.regionTitulo, resumen: t.resumen,
    regiones: regs,
    municipios, nRegiones: regiones.length, nMunicipios: municipios.length,
    fuentes, fotos: true, fotoRegion: (id) => `${fotoBase}/${id}`,
    cifras: [
      { n: municipios.length, clave: "municipios" },
      { n: regiones.length, clave: "regiones" },
      { n: d.nProvincias, clave: "provincias" },
      { n: new Set(fuentes).size, clave: "fuentes" },
    ],
    ...d,
  };
}
const francia = () => paisNacional("fr", "/francia/", { nac: "nacionalFr", reg: "regionesFr", mun: "municipiosFr" }, "francia");
const portugal = () => paisNacional("pt", "/portugal/", { nac: "nacionalPt", reg: "regionesPt", mun: "municipiosPt" }, "portugal");

// Orden de aparición. Para otro país, añadir su función aquí.
const PAISES: (() => Promise<Pais | null>)[] = [espana, francia, portugal];

let cache: Promise<Pais[]> | undefined;
export const getPaises = () => (cache ??= Promise.all(PAISES.map((f) => f())).then((l) => l.filter((p): p is Pais => p !== null)));
