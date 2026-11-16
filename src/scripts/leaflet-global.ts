// Leaflet.markercluster espera encontrar Leaflet como variable global `L`.
// Este módulo se importa antes que el plugin para que exista cuando se cargue.
import L from "leaflet";

(globalThis as unknown as { L: typeof L }).L = L;

export default L;
