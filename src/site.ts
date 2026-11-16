export const SITE = {
  name: "Rutas Camper",
  url: "https://rutascamper.com",
  // Token de Cloudflare Web Analytics: se lee de la variable PUBLIC_CF_BEACON (ver .env.example).
  // Sin valor, la web se genera sin contador de visitas.
  cfBeacon: import.meta.env.PUBLIC_CF_BEACON ?? "",
  description:
    "Dónde se puede dormir con camper o autocaravana: normativa de pernocta por municipio, con fuente y fecha de revisión, y rutas por España y más allá.",
  locale: "es_ES",
  // Sin anuncios ni afiliados no hay actividad económica. Al monetizar: poner true y rellenar
  // los datos del titular (LSSI art. 10); el aviso legal pasa a mostrarlos.
  monetized: false,
  // Datos del titular para el aviso legal (LSSI art. 10). Los rellena el titular.
  owner: {
    name: "[PENDIENTE: nombre y apellidos]",
    nif: "[PENDIENTE: DNI/NIF]",
    email: "contacto@rutascamper.com",
    address: "[PENDIENTE: domicilio completo]",
  },
};

export const ESTADOS = {
  permitido: { label: "Se puede pernoctar", tone: "ok" },
  restringido: { label: "Con restricciones", tone: "warn" },
  prohibido: { label: "Prohibido salvo zonas autorizadas", tone: "bad" },
  "sin-datos": { label: "Sin ordenanza localizada", tone: "idle" },
} as const;

// En desarrollo se ven también los borradores sin verificar.
export const visible = (e: { data: { verificado: boolean } }) => e.data.verificado || import.meta.env.DEV;
// Francia: además de verificada, la ficha no puede estar bloqueada (pendiente de permiso de la fuente).
// En desarrollo se ven todas, con aviso.
export const visibleFr = (e: { data: { verificado: boolean; bloqueado?: boolean } }) =>
  import.meta.env.DEV || (e.data.verificado && e.data.bloqueado !== true);

// "Bretagne (Bretaña)" -> { fr: "Bretagne", es: "Bretaña" }. Sin paréntesis, es = fr = nombre.
export const nombreFr = (nombre: string) => {
  const m = nombre.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { fr: m[1], es: m[2] } : { fr: nombre, es: nombre };
};

export const publicada = (e: { data: { publicada: boolean } }) => e.data.publicada || import.meta.env.DEV;

export const fechaCorta = (d?: Date, loc = "es-ES") =>
  d ? d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" }) : "sin fecha";

// Primera fuente oficial de una ficha, para el enlace directo a la norma.
export const fuenteOficial = (d: { fuentes: { tipo: string; url: string; titulo: string }[] }) =>
  d.fuentes.find((f) => f.tipo === "oficial");

export const fecha = (d?: Date, loc = "es-ES") =>
  d ? d.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "sin fecha";
