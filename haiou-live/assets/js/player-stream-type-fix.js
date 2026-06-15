/**
 * Deprecated compatibility shim.
 *
 * Stream type inference, playable-source selection, and TS/FLV/HLS guards have been
 * merged into player-switch-stability.js to avoid runtime patch stacking.
 *
 * This file is intentionally a no-op and is no longer imported by main.js.
 */
export function initPlayerStreamTypeFix() {}
