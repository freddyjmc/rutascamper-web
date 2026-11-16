// Índice del buscador (portada y /puedo-dormir-aqui/): municipios y regiones de todos los países publicados.
import { ESTADOS, fechaCorta } from "../site";
import { t, paisesEn, META, type Lang } from "../i18n";
import { getPaises } from "./paises";

export interface Sug {
  /** Nombre */ n: string;
  /** Dónde (provincia · región) */ d: string;
  /** Enlace */ h: string;
  /** Texto de estado */ e: string;
  /** Tono de estado */ t: string;
  /** Clave de estado (para filtrar) */ k: string;
  /** Fecha de revisión */ r: string;
  /** Nombre del país, solo si hay más de uno */ p: string;
  /** Código de país */ pc: string;
  /** Texto de búsqueda */ q: string;
}

export async function getBuscador(lang: Lang = "es"): Promise<Sug[]> {
  const T = t(lang);
  const loc = META[lang].fecha;
  const paises = paisesEn(await getPaises(), lang);
  const multi = paises.length > 1;
  const out: Sug[] = [];
  for (const p of paises) {
    const nomRegion = Object.fromEntries(p.regiones.map((r) => [r.id, r.nombre]));
    const claveRegion = Object.fromEntries(p.regiones.map((r) => [r.id, r.claves]));
    for (const m of p.municipios) {
      const reg = nomRegion[m.data.comunidad] ?? m.data.comunidad;
      const e = { label: T.estados[m.data.estado as keyof typeof ESTADOS], tone: ESTADOS[m.data.estado as keyof typeof ESTADOS].tone };
      out.push({
        n: m.data.nombre,
        d: [...new Set([m.data.provincia, reg])].join(" · "),
        h: `${p.baseEs}${m.data.comunidad}/${m.id.split("/").pop()}/`,
        e: e.label, t: e.tone, k: m.data.estado,
        r: m.data.revisado ? fechaCorta(m.data.revisado, loc) : "",
        p: multi ? p.nombre : "", pc: p.code,
        q: `${m.data.nombre} ${m.data.provincia} ${claveRegion[m.data.comunidad] ?? reg} ${multi ? p.nombre : ""}`,
      });
    }
    for (const r of p.regiones) {
      out.push({
        n: r.nombre,
        d: [r.nombreLocal, p.regionUno[0].toUpperCase() + p.regionUno.slice(1)].filter(Boolean).join(" · "),
        h: r.href,
        e: p.code === "es" ? T.buscador.comunidad : T.buscador.region, t: "idle", k: "region",
        r: r.entry.data.revisado ? fechaCorta(r.entry.data.revisado, loc) : "",
        p: multi ? p.nombre : "", pc: p.code,
        q: `${r.claves} ${multi ? p.nombre : ""}`,
      });
    }
  }
  return out.sort((a, b) => a.n.localeCompare(b.n, "es"));
}
