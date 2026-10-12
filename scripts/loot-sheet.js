/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID, FLAG_ITEM } from "./constants.js";

/** Open read-only sheets, keyed by tile document uuid. */
const sheets = new Map();

/**
 * Show the item a loot tile holds in its system's own sheet, read-only. The Item is built in memory
 * from the tile's snapshot: it has no id, no actor, and nothing to save into, so no permission
 * level unlocks it (OWNER is the highest a GM reaches).
 * @param {TileDocument} tileDoc
 */
export function showLootSheet(tileDoc) {
  // The state reads NONE until the first render has prepared its context, so `rendered` alone
  // would let a quick second click open a second window.
  const open = sheets.get(tileDoc.uuid);
  if ( open?.state >= foundry.applications.api.ApplicationV2.RENDER_STATES.NONE ) {
    if ( open.rendered ) open.bringToFront();
    return;
  }
  const item = new Item.implementation(tileDoc.getFlag(MODULE_ID, FLAG_ITEM));
  // item.sheet builds one unrendered sheet just to reach the class; _getSheetClass is internal.
  const SheetClass = item.sheet.constructor;
  const sheet = new SheetClass({
    document: item,
    editPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER + 1
  });
  sheets.set(tileDoc.uuid, sheet);
  sheet.render({ force: true });
}

/** Close the sheet of loot that no longer exists. */
export function closeLootSheet(tileDoc) {
  const sheet = sheets.get(tileDoc.uuid);
  sheets.delete(tileDoc.uuid);
  sheet?.close();
}
