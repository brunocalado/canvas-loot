/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  DEFAULT_PICKUP_SOUND, DEFAULT_THROW_SOUND, MODULE_ID, SETTING_PICKUP_SOUND, SETTING_PICKUP_VOLUME,
  SETTING_THROW_ENABLED, SETTING_THROW_RANGE, SETTING_THROW_SOUND, SETTING_THROW_VOLUME, TEMPLATE_THROW_CONFIG,
  THROW_RANGE_MIN, THROW_RANGE_MAX
} from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM window: whether players may throw items, how far, and the sounds a throw and a pickup make. */
export class ThrowConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-throw-config`,
    classes: [MODULE_ID],
    tag: "form",
    window: { title: "Throwing and sounds", icon: "fa-solid fa-person-basketball" },
    position: { width: 380 },
    form: { handler: ThrowConfig.#onSubmit, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: TEMPLATE_THROW_CONFIG }
  };

  async _prepareContext(options) {
    return {
      ...(await super._prepareContext(options)),
      throwEnabled: game.settings.get(MODULE_ID, SETTING_THROW_ENABLED),
      throwRange: game.settings.get(MODULE_ID, SETTING_THROW_RANGE),
      min: THROW_RANGE_MIN,
      max: THROW_RANGE_MAX,
      throwSound: game.settings.get(MODULE_ID, SETTING_THROW_SOUND),
      throwVolume: game.settings.get(MODULE_ID, SETTING_THROW_VOLUME),
      defaultSound: DEFAULT_THROW_SOUND,
      pickupSound: game.settings.get(MODULE_ID, SETTING_PICKUP_SOUND),
      pickupVolume: game.settings.get(MODULE_ID, SETTING_PICKUP_VOLUME),
      defaultPickupSound: DEFAULT_PICKUP_SOUND
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const enabled = this.element.querySelector("input[name=throwEnabled]");
    const range = this.element.querySelector("input[name=throwRange]");
    const sync = () => { range.disabled = !enabled.checked; };
    enabled.addEventListener("change", sync);
    sync();
  }

  static async #onSubmit(event, form, formData) {
    // Read the range from the element: FormData skips disabled fields, and the range is disabled
    // while throwing is off, yet it must still be saved.
    const raw = Math.round(Number(form.elements.throwRange.value));
    const range = Number.isFinite(raw) ? Math.clamp(raw, THROW_RANGE_MIN, THROW_RANGE_MAX) : THROW_RANGE_MIN;
    await game.settings.set(MODULE_ID, SETTING_THROW_ENABLED, form.elements.throwEnabled.checked);
    await game.settings.set(MODULE_ID, SETTING_THROW_RANGE, range);
    const volume = Number(formData.object.throwVolume);
    await game.settings.set(MODULE_ID, SETTING_THROW_SOUND, String(formData.object.throwSound ?? "").trim());
    await game.settings.set(MODULE_ID, SETTING_THROW_VOLUME, Number.isFinite(volume) ? Math.clamp(volume, 0, 1) : 0);
    const pickupVolume = Number(formData.object.pickupVolume);
    await game.settings.set(MODULE_ID, SETTING_PICKUP_SOUND, String(formData.object.pickupSound ?? "").trim());
    await game.settings.set(MODULE_ID, SETTING_PICKUP_VOLUME, Number.isFinite(pickupVolume) ? Math.clamp(pickupVolume, 0, 1) : 0);
  }
}
