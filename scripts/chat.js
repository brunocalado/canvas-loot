/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID, TEMPLATE_CHAT } from "./constants.js";

// Whole sentences rather than a verb between two names, so a translation can reorder the words or
// add its own ("jogou a Tocha a 12 m"). The placeholders take the same shape game.i18n.format does.
const EVENTS = {
  place: { icon: "fa-location-dot", text: "{actor} placed {item}" },
  drop: { icon: "fa-hand-holding", text: "{actor} dropped {item}" },
  throw: { icon: "fa-person-basketball", text: "{actor} threw {item} {distance}" },
  pickup: { icon: "fa-hand-back-fist", text: "{actor} picked up {item}" }
};

// Marks the element a click on pans to the loot. An attribute rather than our card's class, so a
// card that replaces ours chooses where the click goes, and its own buttons stay its own.
const SHOW_ATTR = `data-${MODULE_ID}-show`;

/**
 * Tell the chat about a loot event, on the active GM. The message carries the event as data in its
 * flags, and canvas-loot.preChatMessage lets a system or module restyle or cancel it first.
 * @param {object} args
 * @param {"place"|"drop"|"throw"|"pickup"} args.event
 * @param {object} args.speaker              ChatMessage speaker data; its alias names the actor
 * @param {object} args.snapshot             the item data the tile holds, or held
 * @param {TileDocument} args.tile           the loot tile; already deleted for a pickup
 * @param {User} args.user                   who acted
 * @param {TokenDocument|null} [args.token]
 * @param {Item|null} [args.item]            the Item it left (a drop) or reached (a pickup)
 * @param {number|null} [args.distance]      a throw's distance, in scene units
 */
export async function postLootMessage({ event, speaker, snapshot, tile, user, token = null, item = null, distance = null }) {
  const data = { event, actorName: speaker.alias, item: { name: snapshot.name, img: snapshot.img } };
  // A picked-up tile is gone, so there is nothing to show.
  if ( event !== "pickup" ) data.tileUuid = tile.uuid;
  if ( distance !== null ) {
    data.distance = Math.round(distance * 10) / 10;
    data.units = tile.parent.grid.units;
  }

  const { escapeHTML } = foundry.utils;
  const parts = {
    actor: `<strong>${escapeHTML(data.actorName)}</strong>`,
    item: `<strong>${escapeHTML(data.item.name)}</strong>`,
    distance: escapeHTML(`${data.distance} ${data.units}`.trim())
  };
  const { icon, text } = EVENTS[event];
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_CHAT, {
    event, icon, img: data.item.img, show: !!data.tileUuid,
    text: text.replace(/\{(\w+)\}/g, (_, key) => parts[key])
  });

  // Loot a GM places is told to the GMs alone, since announcing it would give away treasure hidden
  // before the session.
  const messageData = {
    speaker, content,
    whisper: (event === "place") ? ChatMessage.implementation.getWhisperRecipients("GM").map(u => u.id) : [],
    flags: { [MODULE_ID]: foundry.utils.deepClone(data) }
  };
  if ( Hooks.call(`${MODULE_ID}.preChatMessage`, messageData, { event, token, item, snapshot, tile, user }) === false ) return;
  // Written again after the hook: a listener that rebuilt the flags would otherwise take the click
  // and the data away from every other listener.
  foundry.utils.setProperty(messageData, `flags.${MODULE_ID}`, data);
  await ChatMessage.implementation.create(messageData);
}

/**
 * Pan to the loot a message points at, and ping it for this user alone. A player is told the item
 * is gone once the GM hides it, as for one already picked up.
 * @param {string} uuid
 */
function showLoot(uuid) {
  const tile = fromUuidSync(uuid);
  if ( !tile || (tile.hidden && !game.user.isGM) ) {
    ui.notifications.warn("That item is no longer there.");
    return;
  }
  if ( tile.parent !== canvas.scene ) {
    ui.notifications.warn("That item is on another scene.");
    return;
  }
  if ( canvas.level && !tile.includedInLevel(canvas.level.id) ) {
    ui.notifications.warn("That item is on another level.");
    return;
  }
  const { x, y } = tile.shape.center;
  canvas.animatePan({ x, y });
  canvas.controls.drawPing({ x, y }, { user: game.user });
}

export function registerChat() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const uuid = message.getFlag(MODULE_ID, "tileUuid");
    const target = uuid && html.querySelector(`[${SHOW_ATTR}]`);
    target?.addEventListener("click", () => showLoot(uuid));
  });
}
