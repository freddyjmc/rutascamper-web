// Acceso a las fotos por destino: manifiesto (colección "fotos") + imágenes de src/assets/fotos.
import { getCollection } from "astro:content";
import type { ImageMetadata } from "astro";

const imagenes = import.meta.glob<{ default: ImageMetadata }>("/src/assets/fotos/*.{jpg,jpeg,png,JPG,JPEG,PNG}", { eager: true });

export type Foto = {
  id: string;
  imagen: ImageMetadata;
  alt: string;
  titulo: string;
  autor: string;
  licencia: string;
  licenciaUrl: string;
  origen: string;
  cambios: string;
  atribucion?: string;
  focal?: string;
};

let cache: Map<string, Foto> | undefined;

export async function fotosPorId(): Promise<Map<string, Foto>> {
  if (cache) return cache;
  const mapa = new Map<string, Foto>();
  for (const e of await getCollection("fotos")) {
    const mod = imagenes[`/src/assets/fotos/${e.data.archivo}`];
    // Si falta el archivo, no se muestra nada (npm run check lo marca como error).
    if (!mod) continue;
    const { archivo, consultado, id, ...resto } = e.data;
    mapa.set(id, { id, imagen: mod.default, ...resto });
  }
  return (cache = mapa);
}

export async function getFoto(id: string): Promise<Foto | undefined> {
  return (await fotosPorId()).get(id);
}
