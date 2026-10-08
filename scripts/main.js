/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  DEFAULT_PICKUP_SOUND, DEFAULT_THROW_SOUND, MODULE_ID, SETTING_DISABLED_TYPES, SETTING_HIGHLIGHT,
  SETTING_PICKUP_SOUND, SETTING_PICKUP_VOLUME, SETTING_QUANTITY_PATH, SETTING_THROW_ENABLED, SETTING_THROW_RANGE,
  SETTING_THROW_SOUND, SETTING_THROW_VOLUME, SYSTEM_PRESETS
} from "./constants.js";
import { presetDisabledTypes } from "./helpers.js";
import { refreshHighlights, registerLootControls } from "./loot-control.js";
import { registerDrop } from "./drop.js";
import { registerDropPreview } from "./drop-preview.js";
import { registerPickup } from "./pickup.js";
import { ItemTypesConfig } from "./item-types-config.js";
import { ThrowConfig } from "./throw-config.js";
import { api } from "./api.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerLootControls();
  registerDrop();
  registerDropPreview();
  registerPickup();

  // config: false keeps the raw values out of the plain settings list; the menus below edit them.
  // The disabled types are stored, not the enabled ones, so a type a later system version adds
  // starts enabled. A known system's preset fills both defaults, which apply only until the GM
  // saves; game.system and game.documentTypes already exist at init.
  game.settings.register(MODULE_ID, SETTING_DISABLED_TYPES, {
    scope: "world", config: false, type: Array, default: presetDisabledTypes()
  });
  game.settings.register(MODULE_ID, SETTING_QUANTITY_PATH, {
    scope: "world", config: false, type: String, default: SYSTEM_PRESETS[game.system.id]?.quantityPath ?? ""
  });
  game.settings.register(MODULE_ID, SETTING_THROW_ENABLED, {
    scope: "world", config: false, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, SETTING_THROW_RANGE, {
    scope: "world", config: false, type: Number, default: 30
  });
  game.settings.register(MODULE_ID, SETTING_THROW_SOUND, {
    scope: "world", config: false, type: String, default: DEFAULT_THROW_SOUND
  });
  // The slider's position, 0 to 1, as core's volume sliders store it; played through inputToVolume.
  game.settings.register(MODULE_ID, SETTING_THROW_VOLUME, {
    scope: "world", config: false, type: Number, default: 0.8
  });
  game.settings.register(MODULE_ID, SETTING_PICKUP_SOUND, {
    scope: "world", config: false, type: String, default: DEFAULT_PICKUP_SOUND
  });
  game.settings.register(MODULE_ID, SETTING_PICKUP_VOLUME, {
    scope: "world", config: false, type: Number, default: 0.8
  });
  game.settings.register(MODULE_ID, SETTING_HIGHLIGHT, {
    name: "Loot highlight", hint: "How loot on the canvas stands out. None leaves it for the players to find.",
    scope: "world", config: true, type: String, default: "sparkle",
    choices: { none: "None", sparkle: "Sparkle", shine: "Shine", jiggle: "Jiggle", hop: "Hop", ring: "Ring" },
    onChange: refreshHighlights
  });
  game.settings.registerMenu(MODULE_ID, "itemTypes", {
    name: "Droppable items", label: "Configure", icon: "fa-solid fa-list-check",
    type: ItemTypesConfig, restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "throw", {
    name: "Throwing and sounds", label: "Configure", icon: "fa-solid fa-person-basketball",
    type: ThrowConfig, restricted: true
  });

  game.modules.get(MODULE_ID).api = api;
  globalThis.CanvasLoot = api;
});

// Lets a module that loads before this one learn when the API can be used, whatever the load order.
Hooks.once("ready", () => Hooks.callAll(`${MODULE_ID}.ready`, api));
