/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID, FLAG_ITEM, FLAG_LIGHT, QUERY_PICKUP, SETTING_QUANTITY_PATH, TEMPLATE_CHAT } from "./constants.js";
import { classifyDistance, forgetHistory, getLightSourcesApi, getQuantity, serial } from "./helpers.js";

/**
 * Why a lantern picked up lit arrived dark, by the reason Light Sources returns. A light that is
 * simply gone (it burned out and Light Sources already said so in chat) needs no word here.
 */
const LIGHT_NOTICES = {
  occupied: "It arrives unlit: your token already has a light burning.",
  burnedOut: "Its light went out while it lay on the ground.",
  sourceRemoved: "Its light can no longer be lit."
};

/**
 * Every rule a pickup must pass. The clicking client runs it to refuse early with a notification,
 * and the GM runs it again against the user the server identified, never against the payload.
 * Throws an Error whose message is shown to the user; names stay out of it, since notifications
 * render HTML.
 * @param {TileDocument} tile
 * @param {TokenDocument|null} token
 * @param {User} user
 */
function checkPickup(tile, token, user) {
  if ( !tile.getFlag(MODULE_ID, FLAG_ITEM) ) throw new Error("That tile holds no loot.");
  if ( tile.hidden && !user.isGM ) throw new Error("That item cannot be picked up.");
  // A token without an actor reports OWNER for everyone, so the actor is what gets tested.
  if ( !token?.actor?.testUserPermission(user, "OWNER") ) throw new Error("Select a token you own first.");
  // shape.center rather than the placeable's centre: the GM's client may not be viewing this scene.
  if ( (tile.parent !== token.parent) || !tile.includedInLevel(token.level)
    || (classifyDistance(token, tile.shape.center).kind !== "adjacent") ) {
    throw new Error("Your token cannot reach that item.");
  }
}

/**
 * Client side: refuse what can be refused here, then ask the active GM to do the rest.
 * @param {TileDocument} tile
 */
export async function requestPickup(tile) {
  try {
    const gm = game.users.activeGM;
    if ( !gm ) throw new Error("A GM must be online to pick up items.");
    const token = canvas.tokens.controlled[0]?.document ?? null;
    checkPickup(tile, token, game.user);
    const result = await gm.query(QUERY_PICKUP, { tileUuid: tile.uuid, tokenUuid: token.uuid });
    // Told here rather than on the GM's client, which ran the pickup but is not the one picking up.
    const notice = LIGHT_NOTICES[result?.light];
    if ( notice ) ui.notifications.info(notice);
  } catch(err) {
    ui.notifications.warn(err.message);
  }
}

/**
 * GM side: create the item on the token's actor and remove the tile.
 * An item must never end up in both places, nor in neither.
 * @returns {Promise<{light: string|null}>}   why a light the loot carried was not relit, if it wasn't
 */
async function gmPickup({ tileUuid, tokenUuid }, user) {
  // A player could address this query to anyone; only the active GM's queue serialises pickups.
  if ( !game.user.isActiveGM ) throw new Error("Only the active GM can hand out loot.");
  // When two players race for one tile, the queue gives the second a tile the first already took.
  const tile = (typeof tileUuid === "string") ? await fromUuid(tileUuid) : null;
  if ( tile?.documentName !== "Tile" ) throw new Error("That item is no longer there.");
  const token = (typeof tokenUuid === "string") ? await fromUuid(tokenUuid) : null;
  if ( token?.documentName !== "Token" ) throw new Error("Select a token you own first.");
  checkPickup(tile, token, user);

  // What the actor already carries grows by the amount picked up rather than arriving as a second
  // item: some systems refuse the duplicate outright (cairn2e allows one sack of coin per place).
  // "The same" is judged by content, not origin: world items and items made on a sheet have no
  // source to compare, and two copies of one compendium entry can differ later (one enchanted).
  // Same type, name and system data apart from the quantity field. State counts too (equipped,
  // inside a container), so a doubtful match arrives as a new item rather than merging into the
  // wrong one. A system's preCreate or preUpdate returns false for what the actor refuses, and
  // the write resolves empty.
  const snapshot = foundry.utils.deepClone(tile.getFlag(MODULE_ID, FLAG_ITEM));
  const path = game.settings.get(MODULE_ID, SETTING_QUANTITY_PATH);
  const picked = path ? foundry.utils.getProperty(snapshot, path) : null;
  const key = data => {
    const { type, name, system } = foundry.utils.deepClone(data);
    foundry.utils.setProperty({ system }, path, 0);
    return { type, name, system };
  };
  const wanted = key(snapshot);
  const stack = (Number.isInteger(picked) && (picked > 0))
    ? token.actor.items.find(i => (getQuantity(i) !== null) && foundry.utils.objectsEqual(key(i.toObject()), wanted))
    : null;
  let item;
  let undo;
  if ( stack ) {
    const before = getQuantity(stack);
    item = await stack.update({ [path]: before + picked });
    undo = () => stack.update({ [path]: before });
  } else {
    [item] = await token.actor.createEmbeddedDocuments("Item", [snapshot]);
    undo = () => item.delete();
  }
  if ( !item ) throw new Error("That item cannot be given to this actor.");

  // delete() resolves to undefined when a preDelete hook cancels it, and it can also throw.
  let deleted;
  try {
    // Reaches every client's deleteTile hook, which plays the pickup sound; see loot-control.js.
    deleted = await tile.delete({ [MODULE_ID]: { pickedUp: true } });
  } finally {
    if ( !deleted ) await undo();
  }
  if ( !deleted ) throw new Error("The loot tile could not be removed.");
  forgetHistory(tile);

  // The light a lit lantern carried to the ground comes back with it, burning on the item as it
  // arrived: new, or the stack it merged into. Once it burned out there is no light left to find.
  const lightId = tile.getFlag(MODULE_ID, FLAG_LIGHT);
  const light = lightId ? tile.parent.lights.get(lightId) : null;
  let lightReason = null;
  if ( light ) {
    const lights = getLightSourcesApi();
    if ( lights ) ({ reason: lightReason } = await lights.pickupGroundLight(item, light));
    // Light Sources was disabled meanwhile: nothing can relight it, and it belongs to nothing now.
    else await light.delete();
    forgetHistory(light);
  }

  const speaker = ChatMessage.implementation.getSpeaker({ token });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE_CHAT, {
    event: "pickup", verb: "picked up", icon: "fa-hand-back-fist",
    actorName: speaker.alias, item: { name: item.name, img: item.img }
  });
  await ChatMessage.implementation.create({ speaker, content });
  return { light: lightReason };
}

export function registerPickup() {
  CONFIG.queries[QUERY_PICKUP] = (payload, { user }) => serial(() => gmPickup(payload, user));
}
