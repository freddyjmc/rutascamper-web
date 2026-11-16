// Pruebas automáticas de la web. Uso:
//   npm run check            -> datos + páginas generadas (tras el build)
//   npm run check:external   -> además comprueba que las fuentes oficiales siguen respondiendo
// Sale con código 1 si hay errores; los avisos no bloquean.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dist = join(root, "dist");
const data = join(root, "src", "data");
const external = process.argv.includes("--external");
const errors = [];
const warnings = [];

const walk = (dir, ext) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const rel = (p) => relative(root, p).replaceAll("\\", "/");

// 1. Datos: lo verificado necesita fuente oficial y fecha de revisión.
const hoy = new Date();
const fichas = new Map(); // "comunidad/slug" -> verificado
const fichasFr = new Map(); // "region/slug" -> { verificado, bloqueado }
const fichasPt = new Map();
for (const [mapa, pais] of [[fichasFr, "francia"], [fichasPt, "portugal"]]) {
  const dir = join(data, pais, "municipios");
  if (!existsSync(dir)) continue;
  for (const f of walk(dir, ".json")) {
    mapa.set(rel(f).replace(`src/data/${pais}/municipios/`, "").replace(/\.json$/, ""), json(f));
  }
}
for (const tipo of ["comunidades", "municipios"]) {
  for (const f of walk(join(data, tipo), ".json")) {
    const d = json(f);
    if (tipo === "municipios") fichas.set(rel(f).replace(/^src\/data\/municipios\//, "").replace(/\.json$/, ""), !!d.verificado);
    if (!d.verificado) continue;
    if (!d.fuentes?.some((s) => s.tipo === "oficial")) errors.push(`${rel(f)}: verificado sin fuente oficial`);
    if (!d.revisado) errors.push(`${rel(f)}: verificado sin fecha de revisión`);
    else if ((hoy - new Date(d.revisado)) / 864e5 > 180) warnings.push(`${rel(f)}: revisado hace más de 6 meses (${d.revisado})`);
    for (const s of d.fuentes ?? []) if (!/^https?:\/\//.test(s.url)) errors.push(`${rel(f)}: URL de fuente no válida (${s.url})`);
    // Mapa: cada coordenada debe venir de una fuente oficial que figure en la ficha.
    for (const a of d.areas ?? []) {
      if (a.lat === undefined) continue;
      if (!d.fuentes?.some((s) => s.tipo === "oficial" && s.url === a.coordFuente)) errors.push(`${rel(f)}: las coordenadas de "${a.nombre}" no citan una fuente oficial de la ficha`);
      if (String(a.coordFuente).startsWith("https://data.datatourisme.fr/")) {
        if (!a.coordCreador) errors.push(`${rel(f)}: "${a.nombre}" usa DATAtourisme y no indica coordCreador (quién creó el dato)`);
        if (!d.fuentes?.some((s) => s.url === a.coordFuente && s.fecha)) errors.push(`${rel(f)}: la fuente DATAtourisme de "${a.nombre}" no tiene fecha`);
      }
    }
  }
}
// Rutas: cada ficha de etapa debe existir en el país de la ruta; una ruta publicada solo enlaza fichas visibles en producción.
for (const f of walk(join(data, "rutas"), ".json")) {
  const r = json(f);
  const pais = r.pais ?? "es";
  if (!["es", "fr", "pt"].includes(pais)) errors.push(`${rel(f)}: país no válido (${pais})`);
  for (const e of r.etapas) {
    if (!e.ficha) continue;
    if (pais === "fr" || pais === "pt") {
      const nombre = pais === "fr" ? "Francia" : "Portugal";
      const m = (pais === "fr" ? fichasFr : fichasPt).get(e.ficha);
      if (!m) errors.push(`${rel(f)}: la etapa "${e.dia}" apunta a una ficha de ${nombre} que no existe (${e.ficha})`);
      else if (r.publicada && (!m.verificado || m.bloqueado)) errors.push(`${rel(f)}: ruta publicada con la etapa "${e.dia}" enlazada a una ficha de ${nombre} no visible (${e.ficha})`);
    } else if (!fichas.has(e.ficha)) errors.push(`${rel(f)}: la etapa "${e.dia}" apunta a una ficha que no existe (${e.ficha})`);
    else if (r.publicada && !fichas.get(e.ficha)) errors.push(`${rel(f)}: ruta publicada con la etapa "${e.dia}" enlazada a una ficha de España no verificada (${e.ficha})`);
  }
}

// 1c. Francia (src/data/francia) y Portugal (src/data/portugal): mismas reglas que España, más las de reutilización y bloqueo.
// Cada país tiene su recuadro de coordenadas válidas (Portugal incluye Madeira y Azores).
const LIMITES = {
  francia: { lat: [41, 51.2], lon: [-5.2, 9.6], nombre: "Francia metropolitana" },
  portugal: { lat: [32, 42.3], lon: [-31.5, -6], nombre: "Portugal" },
};
for (const [pais, lim] of Object.entries(LIMITES)) {
  const monetizado = /monetized:\s*true/.test(readFileSync(join(root, "src", "site.ts"), "utf8"));
  const fr = join(data, pais);
  const archivos = existsSync(fr) ? walk(fr, ".json") : [];
  for (const f of archivos) {
    const d = json(f);
    if (d.bloqueado && d.verificado) errors.push(`${rel(f)}: ficha bloqueada con verificado: true (una ficha bloqueada no puede publicarse)`);
    for (const s of d.fuentes ?? []) if (!/^https?:\/\//.test(s.url)) errors.push(`${rel(f)}: URL de fuente no válida (${s.url})`);
    for (const a of d.areas ?? []) {
      if ((a.lat === undefined) !== (a.lon === undefined)) errors.push(`${rel(f)}: "${a.nombre}" tiene lat sin lon o al revés`);
      if (a.lat !== undefined && (a.lat < lim.lat[0] || a.lat > lim.lat[1] || a.lon < lim.lon[0] || a.lon > lim.lon[1])) errors.push(`${rel(f)}: las coordenadas de "${a.nombre}" están fuera de ${lim.nombre}`);
    }
    // Traducciones de la norma nacional: misma estructura que el original y las mismas cifras en cada punto.
    for (const [l, x] of Object.entries(d.i18n ?? {})) {
      const cifras = (t) => (t.replace(/(\d)[.,\s  ](?=\d{3}(?!\d))/g, "$1").match(/\d+(?:[.,]\d+)*/g) ?? []).sort().join("|");
      if (cifras(x.resumen) !== cifras(d.resumen)) errors.push(`${rel(f)}: i18n.${l}.resumen no tiene las mismas cifras que el original`);
      if (x.secciones.length !== d.secciones.length) { errors.push(`${rel(f)}: i18n.${l} tiene ${x.secciones.length} secciones y el original ${d.secciones.length}`); continue; }
      x.secciones.forEach((s, i) => {
        const o = d.secciones[i];
        if (s.puntos.length !== o.puntos.length) { errors.push(`${rel(f)}: i18n.${l} sección «${o.titulo}»: distinto número de puntos`); return; }
        s.puntos.forEach((p, j) => { if (cifras(p) !== cifras(o.puntos[j])) errors.push(`${rel(f)}: i18n.${l} «${o.titulo}», punto ${j + 1}: las cifras no coinciden con el original`); });
      });
    }
    if (!d.verificado) continue;
    if (!d.fuentes?.some((s) => s.tipo === "oficial")) errors.push(`${rel(f)}: verificado sin fuente oficial`);
    if (!d.revisado) errors.push(`${rel(f)}: verificado sin fecha de revisión`);
    else if ((hoy - new Date(d.revisado)) / 864e5 > 180) warnings.push(`${rel(f)}: revisado hace más de 6 meses (${d.revisado})`);
    if (monetizado && d.fuentes?.some((s) => s.noComercial)) errors.push(`${rel(f)}: verificado con una fuente noComercial y SITE.monetized es true`);
    for (const a of d.areas ?? []) {
      if (a.lat === undefined) continue;
      if (!d.fuentes?.some((s) => s.tipo === "oficial" && s.url === a.coordFuente)) errors.push(`${rel(f)}: las coordenadas de "${a.nombre}" no citan una fuente oficial de la ficha`);
      if (String(a.coordFuente).startsWith("https://data.datatourisme.fr/")) {
        if (!a.coordCreador) errors.push(`${rel(f)}: "${a.nombre}" usa DATAtourisme y no indica coordCreador (quién creó el dato)`);
        if (!d.fuentes?.some((s) => s.url === a.coordFuente && s.fecha)) errors.push(`${rel(f)}: la fuente DATAtourisme de "${a.nombre}" no tiene fecha`);
      }
    }
  }
}

// Países con foto de cabecera (paises/<código>); debe coincidir con src/lib/paises.ts.
const PAISES_FOTO = ["es", "fr", "pt"];
// 1b. Fotos: manifiesto src/data/fotos.json <-> archivos de src/assets/fotos.
{
  const manifiesto = join(data, "fotos.json");
  const carpeta = join(root, "src", "assets", "fotos");
  const fotos = existsSync(manifiesto) ? json(manifiesto) : [];
  const ids = new Set();
  const usados = new Set();
  const destinos = new Set([
    ...walk(join(data, "comunidades"), ".json").map((f) => "comunidades/" + rel(f).replace(/^src\/data\/comunidades\//, "").replace(/\.json$/, "")),
    ...[...fichas.keys()].map((f) => "municipios/" + f),
    ...PAISES_FOTO.map((p) => "paises/" + p),
    ...walk(join(data, "francia", "regiones"), ".json").map((f) => "francia/" + rel(f).replace(/^src\/data\/francia\/regiones\//, "").replace(/\.json$/, "")),
    ...walk(join(data, "francia", "municipios"), ".json").map((f) => "francia/" + rel(f).replace(/^src\/data\/francia\/municipios\//, "").replace(/\.json$/, "")),
    ...(existsSync(join(data, "portugal", "regiones")) ? walk(join(data, "portugal", "regiones"), ".json") : []).map((f) => "portugal/" + rel(f).replace(/^src\/data\/portugal\/regiones\//, "").replace(/\.json$/, "")),
    ...(existsSync(join(data, "portugal", "municipios")) ? walk(join(data, "portugal", "municipios"), ".json") : []).map((f) => "portugal/" + rel(f).replace(/^src\/data\/portugal\/municipios\//, "").replace(/\.json$/, "")),
  ]);
  for (const f of fotos) {
    const quien = `fotos.json (${f.id ?? "sin id"})`;
    if (ids.has(f.id)) errors.push(`${quien}: id repetido; cada destino solo puede tener una foto`);
    ids.add(f.id);
    if (!destinos.has(f.id)) errors.push(`${quien}: el id no corresponde a ningún país, comunidad, región ni municipio existente`);
    const archivo = join(carpeta, f.archivo ?? "");
    usados.add(f.archivo);
    if (!f.archivo || !existsSync(archivo)) errors.push(`${quien}: no existe el archivo src/assets/fotos/${f.archivo}`);
    else if (statSync(archivo).size > 4 * 1024 * 1024) errors.push(`${quien}: el original pesa ${(statSync(archivo).size / 1048576).toFixed(1)} MB; el máximo son 4 MB`);
  }
  if (existsSync(carpeta)) {
    for (const a of readdirSync(carpeta)) if (!usados.has(a) && !a.startsWith(".")) errors.push(`src/assets/fotos/${a}: archivo sin entrada en fotos.json (sin autor ni licencia no se puede usar)`);
  }
}

// 1d. «Útil para el viaje» (src/data/util.json): solo enlaces https a dominios oficiales, y cada país con su fuente de emergencias.
{
  const OFICIALES = [/\.gob\.es$/, /\.gouv\.fr$/, /\.europa\.eu$/, /(^|\.)aemet\.es$/, /(^|\.)dgt\.es$/, /(^|\.)ign\.es$/, /(^|\.)spain\.info$/, /(^|\.)geoportalgasolineras\.es$/, /(^|\.)meteofrance\.(com|fr)$/, /(^|\.)france\.fr$/, /\.gov\.pt$/, /(^|\.)ipma\.pt$/, /(^|\.)infraestruturasdeportugal\.pt$/, /(^|\.)icnf\.pt$/, /(^|\.)visitportugal\.com$/];
  const u = json(join(data, "util.json"));
  const oficial = (url) => { try { const x = new URL(url); return x.protocol === "https:" && OFICIALES.some((r) => r.test(x.hostname)); } catch { return false; } };
  for (const [pais, grupos] of Object.entries(u.paises)) {
    for (const g of grupos) for (const e of g.enlaces) if (!oficial(e.url)) errors.push(`src/data/util.json: «${e.nombre}» (${pais}) no enlaza a un dominio oficial de la lista (${e.url})`);
    const em = u.emergencias[pais];
    if (!em?.numeros?.length || !oficial(em.fuente?.url)) errors.push(`src/data/util.json: ${pais} no tiene teléfonos de emergencia con fuente oficial`);
  }
}

// 2. Páginas generadas: SEO básico y enlaces internos rotos.
if (!existsSync(dist)) errors.push("No existe dist/: ejecuta npm run build antes");
else {
  for (const f of walk(dist, ".html")) {
    const html = readFileSync(f, "utf8");
    const page = rel(f);
    const isNotFound = page.endsWith("404.html");
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    if (!title) errors.push(`${page}: sin <title>`);
    else if (title.length > 65) warnings.push(`${page}: título largo (${title.length} caracteres)`);
    if (!/<meta name="description" content="[^"]{50,}/.test(html)) warnings.push(`${page}: meta description ausente o muy corta`);
    if (!isNotFound && !html.includes('rel="canonical"')) errors.push(`${page}: sin canonical`);
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) errors.push(`${page}: ${h1} etiquetas <h1> (debe haber 1)`);
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const target = href.endsWith("/") ? join(dist, href, "index.html") : join(dist, href);
      if (!existsSync(target)) errors.push(`${page}: enlace interno roto -> ${href}`);
    }
  }
}

// 2b. Países: cada país del registro (los que lista /destinos/) tiene cabecera alcanzable, con selector,
// y una tarjeta en la portada. Así, añadir un país sin enlazarlo o sin generar su página da error.
if (existsSync(dist)) {
  const destinos = join(dist, "destinos", "index.html");
  const leer = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  if (!existsSync(destinos)) errors.push("Falta /destinos/ (portal de países)");
  else {
    const bases = [...leer(destinos).matchAll(/data-pais-hub="(\/[^"]+)"/g)].map((m) => m[1]);
    if (!bases.length) errors.push("/destinos/ no lista ningún país");
    const home = leer(join(dist, "index.html"));
    for (const base of bases) {
      const hub = join(dist, base, "index.html");
      if (!existsSync(hub)) { errors.push(`País del registro sin cabecera generada: ${base}`); continue; }
      const html = readFileSync(hub, "utf8");
      if (bases.length > 1) {
        for (const b of bases) if (!html.includes(`href="${b}"`)) errors.push(`${base}: el selector de país no enlaza a ${b}`);
      }
    }
    // La portada enlaza a cada país desde una tarjeta data-pais-hub.
    const tarjetas = [...home.matchAll(/<article[^>]*data-pais-hub="[^"]*"[\s\S]*?<\/article>/g)].map((m) => m[0]);
    for (const base of bases) {
      if (!tarjetas.some((tj) => tj.includes(`href="${base}"`))) errors.push(`La portada no tiene tarjeta de país que enlace a ${base}`);
    }
  }
}

// 2b-bis. Seguridad: la CSP no admite scripts en línea y ninguna página lleva scripts ejecutables dentro del HTML.
if (existsSync(dist)) {
  const cab = readFileSync(join(root, "public", "_headers"), "utf8");
  const scriptSrc = cab.match(/script-src([^;]*)/)?.[1] ?? "";
  if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) errors.push("public/_headers: script-src no debe llevar 'unsafe-inline' ni 'unsafe-eval'");
  const htmls = [];
  const recorre = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) recorre(p); else if (e.name.endsWith(".html")) htmls.push(p); } };
  recorre(dist);
  for (const f of htmls) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/src=/.test(m[1]) || /type="application\/(ld\+)?json"/.test(m[1])) continue;
      if (m[2].trim()) { errors.push(`${f.replace(dist, "dist")}: script en línea (la CSP lo bloquearía)`); break; }
    }
    if (/\son[a-z]+="/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) errors.push(`${f.replace(dist, "dist")}: atributo on…= en línea (la CSP lo bloquearía)`);
  }
}

// 2c. Idiomas (/en/, /fr/): hreflang recíproco, cifras iguales a las del original y enlaces internos existentes.
if (existsSync(dist)) {
  const idx = readFileSync(join(root, "src", "i18n", "index.ts"), "utf8");
  const completas = [...(idx.match(/COMPLETAS = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const site = "https://rutascamper.com";
  const aRuta = (url) => url.replace(site, "");
  const htmlDe = (ruta) => join(dist, ruta, "index.html");
  const alternos = (html) => {
    const out = {};
    for (const [tag] of html.matchAll(/<link rel="alternate"[^>]*>/g)) {
      const l = tag.match(/hreflang="([^"]+)"/)?.[1];
      const h = tag.match(/href="([^"]+)"/)?.[1];
      if (l && h) out[l] = h;
    }
    return out;
  };
  const numeros = (html) => {
    const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
    const texto = main.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ");
    // El separador de miles cambia según el idioma (3.000 / 3,000 / 3 000): se unifica antes de comparar.
    const unido = texto.replace(/(\d)[.,\s  ](?=\d{3}(?!\d))/g, "$1");
    return new Set([...unido.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/[.,]$/, "")));
  };
  for (const f of walk(dist, ".html")) {
    const page = rel(f);
    const html = readFileSync(f, "utf8");
    const url = aRuta(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "");
    const alt = alternos(html);
    if (Object.keys(alt).length) {
      // Cada versión declarada existe, se declara a sí misma y apunta de vuelta a esta página.
      if (alt[(url.match(/^\/(en|fr)\//) ?? [, "es"])[1]] !== site + url) errors.push(`${page}: el hreflang propio no coincide con el canonical`);
      if (alt["x-default"] !== alt.es) errors.push(`${page}: x-default debe apuntar a la versión en español`);
      for (const [l, h] of Object.entries(alt)) {
        if (l === "x-default") continue;
        const destino = htmlDe(aRuta(h));
        if (!existsSync(destino)) { errors.push(`${page}: hreflang ${l} apunta a una página que no existe (${h})`); continue; }
        const vuelta = alternos(readFileSync(destino, "utf8"));
        if (vuelta[(url.match(/^\/(en|fr)\//) ?? [, "es"])[1]] !== site + url) errors.push(`${page}: hreflang no recíproco con ${h}`);
      }
    }
    const m = url.match(/^\/(en|fr)(\/.*)$/);
    if (!m) continue;
    if (!/<html lang="(en|fr)"/.test(html) || !html.includes(`<html lang="${m[1]}"`)) errors.push(`${page}: <html lang> no es "${m[1]}"`);
    if (m[2] === "/no-disponible/") {
      if (!html.includes('name="robots" content="noindex"')) errors.push(`${page}: la página de «no disponible» debe ser noindex`);
      continue;
    }
    // Cifras: lo traducido no puede traer números que no estén en el original; en las páginas completas, tampoco faltar ninguno.
    const origen = htmlDe(m[2]);
    if (!existsSync(origen)) { errors.push(`${page}: no existe la versión española ${m[2]}`); continue; }
    const nT = numeros(html);
    const nO = numeros(readFileSync(origen, "utf8"));
    for (const x of nT) if (!nO.has(x)) errors.push(`${page}: la cifra «${x}» no está en el original español`);
    if (completas.includes(m[2])) for (const x of nO) if (!nT.has(x)) errors.push(`${page}: falta la cifra «${x}» del original español`);
    // Enlaces del selector a páginas «no disponible»: la página española de origen debe existir.
  }
  for (const f of walk(dist, ".html")) {
    const html = readFileSync(f, "utf8");
    for (const [, p] of html.matchAll(/href="\/(?:en|fr)\/no-disponible\/\?p=([^"]+)"/g)) {
      const ruta = decodeURIComponent(p.replaceAll("&#38;", "&"));
      if (!existsSync(htmlDe(ruta)) && !existsSync(join(dist, ruta))) errors.push(`${rel(f)}: el selector de idioma apunta a una página española que no existe (${ruta})`);
    }
  }
}

// 3. Fuentes externas (opcional, lento): avisos, porque las webs oficiales fallan a ratos.
if (external) {
  const urls = new Set();
  for (const tipo of ["comunidades", "municipios", "francia", "portugal"]) for (const f of (existsSync(join(data, tipo)) ? walk(join(data, tipo), ".json") : [])) for (const s of json(f).fuentes ?? []) urls.add(s.url);
  await Promise.all([...urls].map(async (u) => {
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "Mozilla/5.0 rutascamper-check" } });
      if (r.status >= 400) warnings.push(`Fuente responde ${r.status}: ${u}`);
    } catch (e) {
      warnings.push(`Fuente no accesible (${e.cause?.code ?? e.name}): ${u}`);
    }
  }));
}

for (const w of warnings) console.log(`AVISO  ${w}`);
for (const e of errors) console.log(`ERROR  ${e}`);
console.log(`\n${errors.length} errores, ${warnings.length} avisos`);
process.exit(errors.length ? 1 : 0);
