// Almacén local de RutasCamper. Todo se guarda SOLO en este navegador (localStorage) y SOLO cuando
// la persona pulsa un botón. Nada sale del dispositivo. Siempre con try/catch: el almacenamiento
// puede estar bloqueado (modo privado, ajustes del navegador).
export const KEYS = { ruta: "rc:ruta", guardados: "rc:guardados", visitados: "rc:visitados" } as const;

export type Ficha = { slug: string; nombre: string; comunidad: string; url: string };

export function leer(key: string): unknown[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function escribir(key: string, valor: unknown[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrar(keys: string[]): boolean {
  let ok = true;
  for (const k of keys) {
    try { localStorage.removeItem(k); } catch { ok = false; }
  }
  return ok;
}

// Un id de área es "<slug-del-municipio>-<n>", el mismo que usa el mapa como ancla.
export const idValido = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9-]{1,120}$/.test(s);

export const getRuta = (): string[] => [...new Set(leer(KEYS.ruta).filter(idValido))];

export function setRuta(ids: string[]): boolean {
  const ok = escribir(KEYS.ruta, ids);
  if (ok) dispatchEvent(new CustomEvent("rc:ruta"));
  return ok;
}

// Solo enlaces internos: lo guardado en el navegador podría haberse alterado.
export const urlInterna = (u: unknown): u is string => typeof u === "string" && /^\/(?!\/)[^\s\\]*$/.test(u);

export const getFichas = (key: string): Ficha[] =>
  leer(key).filter(
    (x): x is Ficha =>
      !!x && typeof x === "object" &&
      typeof (x as Ficha).slug === "string" && typeof (x as Ficha).nombre === "string" &&
      typeof (x as Ficha).comunidad === "string" && urlInterna((x as Ficha).url),
  );

// Distancia en línea recta (haversine), en km.
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const km = (d: number): string => (d < 1 ? "menos de 1 km" : `${Math.round(d).toLocaleString("es-ES")} km`);

export const paradas = (n: number): string => `${n} ${n === 1 ? "parada" : "paradas"}`;

// Avisa a otras pestañas y componentes de que la ruta ha cambiado.
export function alCambiarRuta(fn: () => void): void {
  addEventListener("rc:ruta", fn);
  addEventListener("storage", (e) => { if (e.key === KEYS.ruta || e.key === null) fn(); });
}

// Botón «Añadir a mi ruta» / «En tu ruta ✓» (aria-pressed). Devuelve false si no se pudo guardar.
export function pintaBotonRuta(b: HTMLElement, enRuta: boolean): void {
  b.setAttribute("aria-pressed", String(enRuta));
  const t = b.querySelector(".ruta-txt");
  if (t) t.textContent = enRuta ? "En tu ruta ✓" : "Añadir a mi ruta";
}

export function alternaRuta(id: string): { ok: boolean; enRuta: boolean; n: number } {
  const ruta = getRuta();
  const ya = ruta.includes(id);
  const nueva = ya ? ruta.filter((x) => x !== id) : [...ruta, id];
  const ok = setRuta(nueva);
  return { ok, enRuta: ok ? !ya : ya, n: ok ? nueva.length : ruta.length };
}
