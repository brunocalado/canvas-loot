/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID, SETTING_QUANTITY_PATH } from "./constants.js";
import { findLootSpaces } from "./helpers.js";
import { spawnLoot } from "./drop.js";

/**
 * Canvas Loot's public API, at game.modules.get(MODULE_ID).api and globalThis.CanvasLoot.
 * See docs/API.md.
 */
export const api = {
  /** The Item field that holds a stack's size ("system.quantity"), or "" when the world has none. */
  getQuantityPath: () => game.settings.get(MODULE_ID, SETTING_QUANTITY_PATH),
  findLootSpaces,
  spawnLoot
};
