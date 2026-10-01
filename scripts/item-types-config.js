/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  MODULE_ID, SETTING_DISABLED_TYPES, SETTING_QUANTITY_PATH, SYSTEM_PRESETS, TEMPLATE_ITEM_TYPES_CONFIG
} from "./constants.js";
import { presetDisabledTypes } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM window: which Item types of the active system may be dropped, and where a stack's size lives. */
export class ItemTypesConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-item-types-config`,
    classes: [MODULE_ID],
    tag: "form",
    window: { title: "Droppable items", icon: "fa-solid fa-list-check" },
    position: { width: 380 },
    form: { handler: ItemTypesConfig.#onSubmit, closeOnSubmit: true },
    actions: { restoreDefaults: ItemTypesConfig.#onRestoreDefaults }
  };

  static PARTS = {
    form: { template: TEMPLATE_ITEM_TYPES_CONFIG }
  };

  async _prepareContext(options) {
    const disabled = new Set(game.settings.get(MODULE_ID, SETTING_DISABLED_TYPES));
    const types = game.documentTypes.Item
      .filter(type => type !== CONST.BASE_DOCUMENT_TYPE)
      .map(type => ({
        type,
        // typeLabels holds i18n keys, and a system may not define one for every type.
        label: game.i18n.localize(CONFIG.Item.typeLabels[type] ?? type),
        enabled: !disabled.has(type)
      }));
    const preset = SYSTEM_PRESETS[game.system.id];
    return {
      ...(await super._prepareContext(options)),
      types,
      quantityPath: game.settings.get(MODULE_ID, SETTING_QUANTITY_PATH),
      hasPreset: !!preset,
      presetPath: preset?.quantityPath,
      systemTitle: game.system.title
    };
  }

  /** Put the preset back into the form. Nothing is saved until Save. */
  static #onRestoreDefaults(event, target) {
    const disabled = new Set(presetDisabledTypes());
    for ( const input of this.element.querySelectorAll("input[data-type]") ) {
      input.checked = !disabled.has(input.dataset.type);
    }
    this.element.querySelector("input[name=quantityPath]").value = SYSTEM_PRESETS[game.system.id]?.quantityPath ?? "";
  }

  /** Store the unchecked types rather than the checked ones, so a type a later system version adds starts enabled. */
  static async #onSubmit(event, form, formData) {
    const path = form.elements.quantityPath.value.trim();
    // A throwing handler makes ApplicationV2 show the error and keep the window open.
    if ( path && !/^system\.[\w.]+$/.test(path) ) {
      throw new Error("The quantity field must start with system., or be empty.");
    }
    const disabled = [...form.querySelectorAll("input[data-type]")]
      .filter(input => !input.checked)
      .map(input => input.dataset.type);
    await game.settings.set(MODULE_ID, SETTING_DISABLED_TYPES, disabled);
    await game.settings.set(MODULE_ID, SETTING_QUANTITY_PATH, path);
  }
}
