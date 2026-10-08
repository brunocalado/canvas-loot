/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

export const MODULE_ID = "canvas-loot";
export const FLAG_ITEM = "item";
export const FLAG_LIGHT = "light";
export const LIGHT_SOURCES_ID = "light-sources";
export const SETTING_DISABLED_TYPES = "disabledItemTypes";
export const SETTING_THROW_ENABLED = "throwEnabled";
export const SETTING_THROW_RANGE = "throwRange";
export const SETTING_THROW_SOUND = "throwSound";
export const SETTING_THROW_VOLUME = "throwVolume";
export const DEFAULT_THROW_SOUND = `modules/${MODULE_ID}/assets/sfx/whoosh.mp3`;
export const SETTING_PICKUP_SOUND = "pickupSound";
export const SETTING_PICKUP_VOLUME = "pickupVolume";
export const DEFAULT_PICKUP_SOUND = `modules/${MODULE_ID}/assets/sfx/pick-up.mp3`;
export const QUERY_DROP = `${MODULE_ID}.drop`;
export const QUERY_PICKUP = `${MODULE_ID}.pickup`;
export const TEMPLATE_CHAT = `modules/${MODULE_ID}/templates/chat/loot-event.hbs`;
export const TEMPLATE_ITEM_TYPES_CONFIG = `modules/${MODULE_ID}/templates/item-types-config.hbs`;
export const TEMPLATE_THROW_CONFIG = `modules/${MODULE_ID}/templates/throw-config.hbs`;
export const THROW_RANGE_MIN = 2;
export const THROW_RANGE_MAX = 60;
// A loot tile's side as a share of a grid space, so neighbouring items read as separate things.
export const LOOT_SCALE = 0.8;
export const SETTING_QUANTITY_PATH = "quantityPath";
export const SETTING_HIGHLIGHT = "highlight";

/** Range and default of each flight option a spawn may pass: seconds, grid spaces, and scales. */
export const FLIGHT_LIMITS = {
  delay: { min: 0, max: 5, default: 0 },
  arc: { min: 0, max: 10, default: 0 },
  startScale: { min: 0, max: 3, default: 1 },
  apexScale: { min: 0.1, max: 3, default: 1.4 }
};

/**
 * Defaults for known systems, keyed by system id: the Item types that start droppable, and the path
 * of an item's stack size ("" when the system has none). Only physical, non-container types are
 * listed: deleting a container through the API leaves its contents on the actor, and deleting a
 * class or feature skips the advancement a sheet would undo. A system not listed gets no quantity
 * field rather than a guess: the name is no convention (tormenta20 uses system.qtd, alienrpg
 * system.attributes.quantity.value), and a field called quantity could mean something else.
 */
export const SYSTEM_PRESETS = {
  "alienrpg": { itemTypes: ["item", "weapon", "armor"], quantityPath: "system.attributes.quantity.value" },
  "band-of-blades": { itemTypes: ["item"], quantityPath: "" },
  "blades-in-the-dark": { itemTypes: ["item"], quantityPath: "" },
  "cairn2e": { itemTypes: ["gear", "coin"], quantityPath: "system.value" },
  "crucible": { itemTypes: ["accessory", "armor", "consumable", "loot", "schematic", "tool", "weapon"], quantityPath: "system.quantity" },
  "daggerheart": { itemTypes: ["loot", "consumable", "weapon", "armor"], quantityPath: "system.quantity" },
  "dnd5e": { itemTypes: ["weapon", "equipment", "consumable", "tool", "loot"], quantityPath: "system.quantity" },
  "draw-steel": { itemTypes: ["treasure"], quantityPath: "system.quantity" },
  "dungeonworld": { itemTypes: ["equipment"], quantityPath: "system.quantity" },
  "household": { itemTypes: ["item", "gadget", "weapon"], quantityPath: "system.quantity" },
  "icrpgme": { itemTypes: ["loot"], quantityPath: "" },
  "pbta": { itemTypes: ["equipment"], quantityPath: "system.quantity" },
  "pf2e": { itemTypes: ["weapon", "armor", "shield", "equipment", "consumable", "ammo", "treasure", "book"], quantityPath: "system.quantity" },
  "scum-and-villainy": { itemTypes: ["item"], quantityPath: "" },
  "sf2e": { itemTypes: ["weapon", "armor", "shield", "equipment", "consumable", "ammo", "treasure", "book"], quantityPath: "system.quantity" },
  "swade": { itemTypes: ["weapon", "armor", "shield", "gear", "consumable"], quantityPath: "system.quantity" },
  "tormenta20": { itemTypes: ["arma", "equipamento", "consumivel", "tesouro"], quantityPath: "system.qtd" },
  "twodsix": { itemTypes: ["equipment", "weapon", "armor", "tool", "junk", "consumable", "computer"], quantityPath: "system.quantity" },
  "vagabond": { itemTypes: ["equipment"], quantityPath: "system.quantity" },
  "wod5e": { itemTypes: ["armor", "weapon", "gear", "talisman"], quantityPath: "system.quantity" },
  "worldbuilding": { itemTypes: ["item"], quantityPath: "system.quantity" }
};
