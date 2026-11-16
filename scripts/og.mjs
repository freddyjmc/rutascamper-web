// Genera public/og.png (1200x630), la imagen que se ve al compartir un enlace.
// Uso: node scripts/og.mjs
import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd9b8"/><stop offset=".6" stop-color="#ffeedd"/><stop offset="1" stop-color="#e6f4f2"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4fb3b8"/><stop offset="1" stop-color="#0f7c86"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <circle cx="1010" cy="150" r="80" fill="#f08a4b"/>
  <path d="M0 400 L180 250 L300 340 L460 190 L640 350 L760 280 L920 400 L1200 300 V520 H0Z" fill="#8fc4b4"/>
  <path d="M0 450 L240 350 L420 430 L600 360 L840 450 L1200 380 V560 H0Z" fill="#5aa38f"/>
  <rect y="500" width="1200" height="130" fill="url(#sea)"/>
  <path d="M0 520 C300 495 640 505 1200 470 V510 C640 545 300 535 0 565Z" fill="#e9dcc6"/>
  <g transform="translate(760 392)">
    <rect x="0" y="24" width="184" height="88" rx="24" fill="#fff"/>
    <rect x="0" y="24" width="184" height="32" rx="20" fill="#f08a4b"/>
    <path d="M184 52 h40 l28 36 v24 h-68z" fill="#fff"/>
    <path d="M192 60 h28 l18 24 h-46z" fill="#bfe6e6"/>
    <rect x="20" y="64" width="44" height="26" rx="6" fill="#bfe6e6"/>
    <rect x="76" y="64" width="44" height="26" rx="6" fill="#bfe6e6"/>
    <rect x="28" y="4" width="112" height="20" rx="8" fill="#0f7c86"/>
    <circle cx="48" cy="116" r="20" fill="#1f2a2e"/><circle cx="208" cy="116" r="20" fill="#1f2a2e"/>
  </g>
  <rect x="60" y="60" width="640" height="300" rx="28" fill="#ffffff" opacity=".92"/>
  <text x="100" y="140" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="800" fill="#1f2a2e">Rutas<tspan fill="#0f7c86">Camper</tspan></text>
  <text x="100" y="215" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#1f2a2e">¿Puedo dormir aquí</text>
  <text x="100" y="265" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#1f2a2e">con mi camper?</text>
  <text x="100" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#5b6b70">Normativa de pernocta con fuentes oficiales</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(new URL("../public/og.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
console.log("public/og.png generado");
