import { PROSPECTOS_MAUI, FUENTE_MAUI } from "@/lib/prospectos-maui";
import {
  PROSPECTOS_HAWAII_ALTO_TICKET,
  FUENTE_HAWAII_ALTO_TICKET,
} from "@/lib/prospectos-hawaii-alto-ticket";

/**
 * Todas las listas investigadas, cada empresa con la fuente de su lote.
 * Para sumar un lote nuevo: crear su archivo en src/lib y agregarlo acá.
 */
export const LISTAS_INVESTIGADAS = [
  ...PROSPECTOS_MAUI.map((p) => ({ ...p, fuente: FUENTE_MAUI })),
  ...PROSPECTOS_HAWAII_ALTO_TICKET.map((p) => ({ ...p, fuente: FUENTE_HAWAII_ALTO_TICKET })),
];
