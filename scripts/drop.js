/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  MODULE_ID, FLAG_ITEM, FLAG_LIGHT, LOOT_SCALE, SETTING_DISABLED_TYPES, SETTING_QUANTITY_PATH, QUERY_DROP,
  TEMPLATE_CHAT
} from "./constants.js";
import { classifyDistance, forgetHistory, getLightSourcesApi, getQuantity, isLootAt, serial } from "./helpers.js";

export const LOOT_TAKEN = "There is already an item there.";

const CHAT = {
  place: { verb: "placed", icon: "fa-location-dot" },
  drop: { verb: "dropped", icon: "fa-hand-holding" },
  throw: { verb: "threw", icon: "fa-person-basketball" }
};

/**
 * Every rule a drop must pass. The dropping client runs it to preview a drag and to refuse early
 * with a notification, and the GM runs it again against the user the server identified, never
 * against the payload. Throws an Error whose message is shown to the user; names stay out of it,
 * since notifications render HTML.
 * @param {Item} item
 * @param {TokenDocument|null} token
 * @param {{x: number, y: number}} point
 * @param {User} user
 * @returns {{kind: "place"|"drop"|"throw", distance?: number}}   distance in scene units, for a throw
 */
export function checkDrop(item, token, point, user) {
  if ( game.settings.get(MODULE_ID, SETTING_DISABLED_TYPES).includes(item.type) ) {
    const label = game.i18n.localize(CONFIG.Item.typeLabels[item.type] ?? item.type);
    throw new Error(`${label} items cannot be dropped.`);
  }
  const actor = (item.parent?.documentName === "Actor") ? item.parent : null;
  const allowed = actor ? actor.testUserPermission(user, "OWNER") : item.testUserPermission(user, "OBSERVER");
  if ( !allowed ) throw new Error("You do not have permission to drop this item.");
  // A GM places loot anywhere, unless the controlled token's actor carries the item: then the GM
  // drops or throws it as that token, under the same rules as its player.
  if ( user.isGM && !(actor && token?.actor && (token.actor.uuid === actor.uuid)) ) return { kind: "place" };

  if ( !token?.actor?.testUserPermission(user, "OWNER") ) throw new Error("Select a token you own first.");
  if ( actor && (token.actor.uuid !== actor.uuid) ) {
    throw new Error("Select the token of the actor that carries this item.");
  }
  const { kind, distance } = classifyDistance(token, point);
  if ( kind === "out" ) throw new Error("Your token cannot reach that spot.");
  return (kind === "adjacent") ? { kind: "drop" } : { kind: "throw", distance };
}

/**
 * Ask how many of a stack to drop. The error carries only a number, since notifications render HTML.
 * @param {number} max
 * @returns {Promise<number|null>}   null when the dialog is dismissed
 */
async function askQuantity(max) {
  const result = await foundry.applications.api.DialogV2.input({
    classes: [MODULE_ID],
    window: { title: "Drop how many?", icon: "fa-solid fa-hand-holding" },
    content: `<label class="cl-settings-row">
      <span class="cl-settings-row-text"><h3>Quantity</h3><p>1 to ${max}</p></span>
      <input type="number" name="quantity" value="1" min="1" max="${max}" step="1" autofocus>
    </label>`,
    ok: { label: "Drop", icon: "fa-solid fa-hand-holding" }
  });
  if ( !result ) return null;
  const n = Number(result.quantity);
  if ( !Number.isInteger(n) || (n < 1) || (n > max) ) throw new Error(`Choose a number from 1 to ${max}.`);
  return n;
}

/**
 * Client side: refuse what can be refused here, then ask the active GM to do the rest.
 * Players cannot create or delete Tiles (both need ASSISTANT), so every mutation runs on the GM.
 */
async function handleDrop(data) {
  try {
    const gm = game.users.activeGM;
    if ( !gm ) throw new Error("A GM must be online to drop items.");
    const item = await fromUuid(data.uuid);
    if ( !item ) throw new Error("The item no longer exists.");
    const token = canvas.tokens.controlled[0]?.document ?? null;
    const point = { x: data.x, y: data.y };
    const { kind } = checkDrop(item, token, point, game.user);
    if ( (kind === "place") ? isLootAt(canvas.scene, canvas.level.id, point) : isLootAt(token.parent, token.level, point) ) {
      throw new Error(LOOT_TAKEN);
    }
    // Only an actor's item is split; a copy from the directory or a compendium takes it whole.
    const stack = (item.parent?.documentName === "Actor") ? getQuantity(item) : null;
    let quantity;
    if ( stack > 1 ) {
      quantity = await askQuantity(stack);
      if ( quantity === null ) return;
    }
    // A GM placing loot does it on the viewed level with no token; a drop or a throw starts from
    // the token's position.
    await gm.query(QUERY_DROP, {
      itemUuid: item.uuid,
      tokenUuid: (kind === "place") ? null : token.uuid,
      levelUuid: canvas.level.uuid,
      x: data.x,
      y: data.y,
      quantity
    });
  } catch(err) {
    ui.notifications.warn(err.message);
  }
}

/**
 * GM side: create the loot tile and, for an item carried by an actor, remove it from the actor.
 * An item must never end up in both places, nor in neither.
 */
async function gmDrop({ itemUuid, tokenUuid, levelUuid, x, y, quantity }, user) {
  // A player could address this query to anyone; only the active GM's queue serialises drops.
  if ( !game.user.isActiveGM ) throw new Error("Only the active GM can place loot.");
  const item = (typeof itemUuid === "string") ? await fromUuid(itemUuid) : null;
  if ( item?.documentName !== "Item" ) throw new Error("The item no longer exists.");

  // The dropping client's scene, which need not be the one this GM is viewing.
  let token = null;
  let level;
  if ( user.isGM && (tokenUuid === null) ) level = (typeof levelUuid === "string") ? await fromUuid(levelUuid) : null;
  else {
    token = (typeof tokenUuid === "string") ? await fromUuid(tokenUuid) : null;
    if ( token?.documentName !== "Token" ) throw new Error("Select a token you own first.");
    level = token.parent.levels.get(token.level);
  }
  if ( level?.documentName !== "Level" ) throw new Error("That level no longer exists.");
  const scene = level.parent;
  if ( !Number.isFinite(x) || !Number.isFinite(y) || !scene.dimensions.rect.contains(x, y) ) {
    throw new Error("That spot is outside the scene.");
  }
  const point = { x, y };
  const { kind, distance } = checkDrop(item, token, point, user);
  // Checked here, under the queue, so two drops racing for one space can't both land on it.
  if ( isLootAt(scene, level.id, point) ) throw new Error(LOOT_TAKEN);

  // An item without a number at the quantity path moves whole. A missing quantity also moves the
  // whole stack, which the dialog allows anyway. The stack is re-read here, under the queue, so a
  // request asking for more than an earlier one left behind is refused rather than shrunk.
  const onActor = item.parent?.documentName === "Actor";
  const path = game.settings.get(MODULE_ID, SETTING_QUANTITY_PATH);
  const stack = onActor ? getQuantity(item) : null;
  let moved = stack;
  if ( (stack !== null) && (quantity !== undefined) ) {
    if ( !Number.isInteger(quantity) || (quantity < 1) || (quantity > stack) ) {
      throw new Error("That quantity is not available.");
    }
    moved = quantity;
  }

  const grid = scene.grid;
  const centre = grid.isGridless ? point : grid.getCenterPoint(grid.getOffset(point));
  const [width, height] = (grid.isGridless ? [grid.size, grid.size] : [grid.sizeX, grid.sizeY]).map(s => s * LOOT_SCALE);
  // A snapshot rather than the item's uuid: a move deletes the source, and a directory item can be
  // edited or deleted after the drop.
  const snapshot = item.toObject();
  for ( const key of ["_id", "folder", "sort", "ownership"] ) delete snapshot[key];
  if ( moved < stack ) foundry.utils.setProperty(snapshot, path, moved);
  // x and y place the texture anchor, which is the centre by default. The schema wants integers,
  // and hex grids and gridless drops are fractional.
  const x0 = Math.round(centre.x);
  const y0 = Math.round(centre.y);
  const elevation = token?.elevation ?? level.elevation.base;

  // A lit lantern takes its light along. Light Sources decides whether the leaving item is the light
  // and reads that off the actor, so this runs while the item is still there, and before the tile,
  // whose flag keeps the light's id. Only when the whole item leaves: part of a stack leaves the
  // burning item behind. null < null is false, so an item without a quantity leaves whole.
  const lights = (onActor && !(moved < stack)) ? getLightSourcesApi() : null;
  let light = null;
  try {
    light = await lights?.dropLightWithItem(item, {
      scene, x: x0, y: y0, elevation, levels: [level.id], managedBy: MODULE_ID
    }) ?? null;
  } catch(err) {
    // The loot lands either way. Light Sources never leaves the flame in two places, and puts out
    // the token's light when the item is deleted below.
    console.error(`${MODULE_ID} | Could not carry the light with the dropped item`, err);
  }
  if ( light ) forgetHistory(light);
  // Undoes the light's move when the drop fails after it: the item is still on its actor.
  const returnLight = async () => {
    if ( !light ) return;
    await lights.pickupGroundLight(item, light);
    forgetHistory(light);
  };

  let tile;
  try {
    [tile] = await scene.createEmbeddedDocuments("Tile", [{
      texture: { src: item.img },
      x: x0,
      y: y0,
      width: Math.round(width),
      height: Math.round(height),
      elevation,
      levels: [level.id],
      flags: { [MODULE_ID]: light ? { [FLAG_ITEM]: snapshot, [FLAG_LIGHT]: light.id } : { [FLAG_ITEM]: snapshot } }
    }], {
      // Reaches every client's createTile hook without being stored, so each can fly the item in
      // from the token; see loot-control.js.
      [MODULE_ID]: (kind === "place") ? undefined : { from: token.getCenterPoint(), thrown: kind === "throw" }
    });
  } finally {
    if ( !tile ) await returnLight();
  }
  if ( !tile ) throw new Error("The loot tile could not be created.");
  forgetHistory(tile);

  if ( onActor ) {
    // update() and delete() both resolve to undefined when a pre-hook cancels them, and can throw.
    let done;
    try {
      done = (moved < stack) ? await item.update({ [path]: stack - moved }) : await item.delete();
    } finally {
      if ( !done ) {
        await returnLight();
        await tile.delete();
        forgetHistory(tile);
      }
    }
    if ( !done ) throw new Error("The item could not be removed from its actor.");
  }

  // Loot the GM places freely is told to the GMs alone, since announcing it would give away treasure
  // hidden before the session. It has no token to speak for it, and getSpeaker would fall back to
  // whatever this client controls, so the placing user speaks.
  const placed = kind === "place";
  const speaker = placed ? { scene: scene.id, alias: user.name } : ChatMessage.implementation.getSpeaker({ token });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_CHAT, {
    event: kind, ...CHAT[kind], actorName: speaker.alias, item: { name: item.name, img: item.img },
    tileUuid: tile.uuid,
    distance: (kind === "throw") ? `${Math.round(distance * 10) / 10} ${scene.grid.units}`.trim() : null
  });
  await ChatMessage.implementation.create({
    speaker, content, whisper: placed ? ChatMessage.implementation.getWhisperRecipients("GM").map(u => u.id) : []
  });
}

/**
 * Pan to the loot a drop or throw message points at, and ping it for this user alone. A player is
 * told the item is gone once the GM hides it, as for one already picked up.
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

export function registerDrop() {
  CONFIG.queries[QUERY_DROP] = (payload, { user }) => serial(() => gmDrop(payload, user));

  // Core has no case for an Item dropped on the canvas, so returning false takes nothing from it;
  // it does stop later listeners from acting on the same drop.
  Hooks.on("dropCanvasData", (canvas, data) => {
    if ( data.type !== "Item" ) return;
    handleDrop(data);
    return false;
  });

  // Messages created before cards carried the tile's uuid have nothing to show.
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const card = html.querySelector(`.${MODULE_ID}.cl-chat-card[data-tile-uuid]`);
    card?.addEventListener("click", () => showLoot(card.dataset.tileUuid));
  });
}
