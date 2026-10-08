/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  MODULE_ID, FLAG_ITEM, FLAG_LIGHT, FLIGHT_LIMITS, SETTING_HIGHLIGHT, SETTING_PICKUP_SOUND,
  SETTING_PICKUP_VOLUME, SETTING_THROW_SOUND, SETTING_THROW_VOLUME
} from "./constants.js";
import { forgetHistory } from "./helpers.js";
import { requestPickup } from "./pickup.js";

/**
 * A clickable overlay for one loot tile, living in canvas.controls like core's DoorControl.
 * Tiles only receive pointer events while the Tiles layer is active, and a click on an
 * inactive layer reaches the stage, which releases the controlled tokens when the core
 * setting leftClickRelease is on. The controls layer is always interactive, and stopping
 * propagation here keeps the stage from ever seeing the click.
 */
export class LootControl extends PIXI.Container {
  constructor(tile) {
    super();
    this.tile = tile;
    this.phase = Math.random();
    this.flight = null;
  }

  draw() {
    const { width, height } = this.tile.bounds;
    const s = canvas.dimensions.uiScale;
    this.hitArea = new PIXI.Rectangle(0, 0, width, height);
    this.eventMode = "static";
    this.interactiveChildren = false;
    this.cursor = "pointer";

    // Same style source and size as the core token nameplate, so the label matches the canvas.
    const style = CONFIG.canvasTextStyle.clone();
    style.fontSize = 24;
    style.wordWrap = true;
    style.wordWrapWidth = width * 3 / s;
    this.label ??= this.addChild(new foundry.canvas.containers.PreciseText("", style));
    this.label.style = style;
    this.label.text = this.tile.document.getFlag(MODULE_ID, FLAG_ITEM)?.name ?? "";
    this.label.anchor.set(0.5, 0);
    this.label.scale.set(s, s);
    this.label.position.set(width / 2, height + (4 * s));
    this.label.visible = false;

    // A four-pointed star in the top-right corner, twinkled by animateHighlights.
    const r = Math.min(width, height) * 0.22;
    const points = [];
    for ( let i = 0; i < 8; i++ ) {
      const angle = (i * Math.PI / 4) - (Math.PI / 2);
      const d = (i % 2) ? r * 0.28 : r;
      points.push(Math.cos(angle) * d, Math.sin(angle) * d);
    }
    this.sparkle ??= this.addChild(new PIXI.Graphics());
    this.sparkle.clear()
      .lineStyle(r * 0.08, 0xd9a520)
      .beginFill(0xfff4b8)
      .drawPolygon(points)
      .endFill();
    this.sparkle.position.set(width - (r * 0.6), r * 0.6);

    // A ring on the ground around the item, expanding and fading. Drawn at full size and scaled
    // down, behind the other children.
    const ringRadius = Math.max(width, height) * 0.75;
    this.ring ??= this.addChildAt(new PIXI.Graphics(), 0);
    this.ring.clear()
      .lineStyle(ringRadius * 0.06, 0xffd966)
      .drawCircle(0, 0, ringRadius);
    this.ring.position.set(width / 2, height / 2);

    // A diagonal band of light swept across the item, clipped to its image by a copy of the tile's
    // texture used as a mask. Stripes of rising and falling alpha stand in for a gradient.
    this.shineMask ??= this.addChild(new PIXI.Sprite());
    this.shineMask.texture = this.tile.mesh?.texture ?? PIXI.Texture.EMPTY;
    this.shine ??= this.addChild(new PIXI.Graphics());
    const stripes = 9;
    const stripe = Math.max(width, height) * 0.035;
    const reach = width + height;
    this.shine.clear();
    for ( let i = 0; i < stripes; i++ ) {
      const alpha = 0.7 * Math.sin(Math.PI * (i + 0.5) / stripes);
      this.shine.beginFill(0xffffff, alpha).drawRect((i - (stripes / 2)) * stripe, -reach, stripe, 2 * reach).endFill();
    }
    this.shine.rotation = Math.PI / 6;
    this.shine.blendMode = PIXI.BLEND_MODES.ADD;
    this.shine.mask = this.shineMask;

    this.reposition();
    this.refreshHighlight();
    this.removeAllListeners();
    this.on("pointerover", this.#onPointerOver)
      .on("pointerout", this.#onPointerOut)
      .on("pointerdown", this.#onPointerDown);
    return this;
  }

  reposition() {
    const { x, y } = this.tile.bounds;
    this.position.set(x, y);
    this.visible = this.isVisible;

    // Lay the mask over the tile's image the way Tile#_refreshPosition, _refreshRotation and
    // _refreshSize lay out the mesh; the mesh has the same texture, so its scale carries the fit.
    const mesh = this.tile.mesh;
    if ( !mesh ) return;
    const shape = this.tile.document.shape;
    this.shineMask.position.set(shape.x - x, shape.y - y);
    this.shineMask.anchor.set(shape.anchorX, shape.anchorY);
    this.shineMask.scale.copyFrom(mesh.scale);
    this.shineMask.angle = shape.rotation;
  }

  /** Show the parts of the highlight setting's mode, at rest; animateHighlights moves them. */
  refreshHighlight() {
    this.mode = game.settings.get(MODULE_ID, SETTING_HIGHLIGHT);
    this.sparkle.visible = this.mode === "sparkle";
    this.sparkle.scale.set(1);
    this.sparkle.alpha = 1;
    this.sparkle.rotation = 0;
    this.ring.visible = this.mode === "ring";
    this.ring.scale.set(0.8);
    this.ring.alpha = 0.6;
    this.shine.visible = this.mode === "shine";
    this.shine.x = -this.hitArea.width; // Parked off the image, where the mask hides it
    this.restoreMesh();
  }

  /**
   * Fly the tile's image in from a point, hiding the overlay until it lands; animateFlight moves it.
   * @param {{from: {x: number, y: number}, delay: number, arc: number, startScale: number, apexScale: number}} flight
   */
  fly(flight) {
    this.flight = { ...flight, start: null };
    this.alpha = 0;
  }

  /** Put the tile's mesh back where core laid it out, after a jiggle or a hop moved it. */
  restoreMesh() {
    const mesh = this.tile.mesh;
    if ( !mesh || mesh.destroyed ) return;
    const { x, y, rotation } = this.tile.document.shape;
    mesh.position.set(x, y);
    mesh.angle = rotation;
  }

  get isVisible() {
    const doc = this.tile.document;
    if ( doc.hidden && !game.user.isGM ) return false;
    if ( !doc.viewed ) return false;
    if ( !canvas.visibility.tokenVision ) return true;
    return canvas.visibility.testVisibility(this.tile.center, { tolerance: 0 });
  }

  #onPointerOver(event) {
    // Ignore pointer events that land on HTML UI above the canvas, as DoorControl does.
    if ( event.nativeEvent && (event.nativeEvent.target.id !== canvas.app.view.id) ) return;
    event.stopPropagation();
    this.label.visible = true;
  }

  #onPointerOut(event) {
    if ( event.nativeEvent && (event.nativeEvent.target.id !== canvas.app.view.id) ) return;
    event.stopPropagation();
    this.label.visible = false;
  }

  #onPointerDown(event) {
    if ( event.button !== 0 ) return;
    event.stopPropagation(); // Keeps the stage from running leftClickRelease on the controlled tokens
    requestPickup(this.tile.document);
  }
}

/** The container of every LootControl, added to canvas.controls. */
let container = null;

/** LootControl instances keyed by tile document id. */
const controls = new Map();

/** Flights announced by createTile before the tile is drawn, keyed by tile document id. */
const pendingFlights = new Map();

function isLoot(tile) {
  return !!tile.document.getFlag(MODULE_ID, FLAG_ITEM);
}

function addControl(tile) {
  removeControl(tile.id);
  const control = new LootControl(tile);
  controls.set(tile.id, control);
  container.addChild(control.draw());
  const flight = pendingFlights.get(tile.id);
  if ( flight ) {
    pendingFlights.delete(tile.id);
    control.fly(flight);
  }
}

function removeControl(id) {
  const control = controls.get(id);
  if ( !control ) return;
  controls.delete(id);
  control.destroy({ children: true });
}

/** Re-apply the highlight setting to every loot tile on the canvas. */
export function refreshHighlights() {
  for ( const control of controls.values() ) control.refreshHighlight();
}

/**
 * Move a flying tile's mesh one frame along a parabola from its origin to where core laid it out.
 * Seen from above, a throw along the screen's vertical would show no arc, so the image also grows
 * toward the apex. The flight gets longer and higher with distance, and ends with the mesh and
 * overlay restored. A spawn can delay it, raise its apex, and set the image's size at take-off and
 * at the apex; it always lands at its fitted size. With the defaults this is the drop's flight.
 * @param {LootControl} control
 * @param {number} now   seconds
 */
function animateFlight(control, now) {
  const mesh = control.tile.mesh;
  if ( !mesh || mesh.destroyed ) return;
  const flight = control.flight;
  flight.start ??= now;
  // renderable rather than alpha or visible: core rewrites those whenever the tile refreshes, as a
  // hover does, but never touches renderable on a tile's mesh.
  const t = now - flight.start - flight.delay;
  mesh.renderable = t >= 0;
  if ( t < 0 ) return;
  // Core's fit, re-read whenever core has set the scale since the last frame: the first frames can
  // come before the texture is fitted.
  if ( mesh.scale.x !== flight.lastScale ) flight.scale = { x: mesh.scale.x, y: mesh.scale.y };
  const { x, y } = control.tile.document.shape;
  const dx = x - flight.from.x;
  const dy = y - flight.from.y;
  const length = Math.hypot(dx, dy);
  const duration = Math.min(0.3 + (0.06 * length / canvas.dimensions.size), 0.9);
  const u = Math.min(t / duration, 1);
  if ( u >= 1 ) {
    control.flight = null;
    control.alpha = 1;
    mesh.scale.set(flight.scale.x, flight.scale.y);
    control.restoreMesh();
    return;
  }
  const height = 4 * u * (1 - u);
  const lift = Math.max(0.2 * length, flight.arc * canvas.dimensions.size) * height;
  // startScale at take-off, apexScale at the top, 1 on landing. Each half eases on the same curve
  // as the lift, so the size peaks exactly at the apex; one parabola through all three would
  // overshoot apexScale whenever startScale isn't 1.
  const base = (u < 0.5) ? flight.startScale : 1;
  const s = base + ((flight.apexScale - base) * height);
  mesh.position.set(flight.from.x + (dx * u), flight.from.y + (dy * u) - lift);
  mesh.scale.set(flight.scale.x * s, flight.scale.y * s);
  flight.lastScale = mesh.scale.x;
}

/**
 * Animate every loot tile's highlight. Each mode runs a short burst on a repeating cycle, each tile
 * out of phase with the others so a pile of loot doesn't move in unison. Jiggle and hop move the
 * tile's own mesh: core resets it only when the tile refreshes, so it is set again every frame and
 * put back while the Tiles layer is active, where the GM edits the tile itself. Photosensitive
 * mode leaves everything at rest.
 */
function animateHighlights() {
  const now = canvas.app.ticker.lastTime / 1000;
  for ( const control of controls.values() ) {
    // A flight is one movement, not a flash, so it runs in photosensitive mode too.
    if ( control.flight ) {
      animateFlight(control, now);
      continue;
    }
    if ( canvas.photosensitiveMode ) continue;
    const { width, height } = control.hitArea;
    switch ( control.mode ) {
      case "sparkle": {
        if ( !control.visible ) break;
        const t = (now / 2 + control.phase) % 1;
        const k = Math.sin(t * Math.PI) ** 2;
        control.sparkle.scale.set(0.5 + (0.6 * k));
        control.sparkle.alpha = 0.4 + (0.6 * k);
        control.sparkle.rotation = t * Math.PI / 2;
        break;
      }
      case "ring": {
        if ( !control.visible ) break;
        const u = Math.min(((now / 2 + control.phase) % 1) / 0.7, 1);
        control.ring.scale.set(0.55 + (0.45 * u));
        control.ring.alpha = 1 - u;
        break;
      }
      case "shine": {
        if ( !control.visible ) break;
        const u = Math.min(((now / 3 + control.phase) % 1) / 0.25, 1);
        const eased = u * u * (3 - (2 * u));
        control.shine.position.set((-0.6 * width) + (2.2 * width * eased), height / 2);
        break;
      }
      case "jiggle": {
        const mesh = control.tile.mesh;
        if ( !mesh || mesh.destroyed ) break;
        if ( !container.visible ) {
          control.restoreMesh();
          break;
        }
        const u = Math.min(((now / 3 + control.phase) % 1) / 0.2, 1);
        mesh.angle = control.tile.document.shape.rotation + (10 * Math.sin(u * 6 * Math.PI) * (1 - u));
        break;
      }
      case "hop": {
        const mesh = control.tile.mesh;
        if ( !mesh || mesh.destroyed ) break;
        if ( !container.visible ) {
          control.restoreMesh();
          break;
        }
        // A hop and a smaller bounce: two parabolas over the first fifth of a 2.5 s cycle.
        const t = ((now / 2.5 + control.phase) % 1) / 0.2;
        let lift = 0;
        if ( t < 0.7 ) lift = 0.2 * 4 * (t / 0.7) * (1 - (t / 0.7));
        else if ( t < 1 ) lift = 0.06 * 4 * ((t - 0.7) / 0.3) * (1 - ((t - 0.7) / 0.3));
        const { x, y } = control.tile.document.shape;
        mesh.position.set(x, y - (lift * height));
        break;
      }
    }
  }
}

/**
 * Play a loot sound on this client, on the Environment channel. Each client viewing the scene plays
 * it locally, so the ones elsewhere never hear it.
 * @param {string} soundKey    setting holding the file; empty plays nothing
 * @param {string} volumeKey   setting holding the slider position, 0 to 1
 */
function playSound(soundKey, volumeKey) {
  const src = game.settings.get(MODULE_ID, soundKey);
  const volume = game.settings.get(MODULE_ID, volumeKey);
  if ( !src || (volume <= 0) ) return;
  const AudioHelper = foundry.audio.AudioHelper;
  AudioHelper.play({ src, volume: AudioHelper.inputToVolume(volume), channel: "environment" }, false);
}

/**
 * The light a loot tile carries, for the active GM alone, so a tile edit moves or removes it once
 * however many GMs are connected. null once it burned out.
 * @param {TileDocument} tileDoc
 * @returns {AmbientLightDocument|null}
 */
function lootLight(tileDoc) {
  if ( !game.user.isActiveGM ) return null;
  const id = tileDoc.getFlag(MODULE_ID, FLAG_LIGHT);
  return id ? (tileDoc.parent.lights.get(id) ?? null) : null;
}

function syncLayerState() {
  // On the Tiles layer the overlay steps aside, so the GM can select and delete the Tile itself.
  const off = !!canvas.tiles?.active;
  container.visible = !off;
  container.eventMode = off ? "none" : "passive";
}

export function registerLootControls() {
  Hooks.on("canvasReady", () => {
    // ControlsLayer#_tearDown only clears its own containers, so ours survives a scene change
    // and is emptied here instead.
    for ( const id of [...controls.keys()] ) removeControl(id);
    pendingFlights.clear();
    container ??= new PIXI.Container();
    container.eventMode = "passive";
    if ( container.parent !== canvas.controls ) canvas.controls.addChild(container);
    // canvas.app outlives scene changes, so the listener is re-added rather than stacked.
    canvas.app.ticker.remove(animateHighlights);
    canvas.app.ticker.add(animateHighlights);
    for ( const tile of canvas.tiles.placeables ) {
      if ( isLoot(tile) ) addControl(tile);
    }
    syncLayerState();
  });

  // Tiles drawn during the initial canvas draw are picked up by canvasReady. Drag previews share
  // the original's id and fire drawTile too, so they would replace the real tile's control.
  Hooks.on("drawTile", tile => {
    if ( canvas.ready && container && !tile.isPreview && isLoot(tile) ) addControl(tile);
  });
  // A drop or a throw passes its token's centre as a creation option, which every client receives;
  // a spawn may add the flight's shape. The tile is drawn after this hook, so its control usually
  // picks the flight up in addControl.
  Hooks.on("createTile", (tileDoc, options) => {
    const option = options[MODULE_ID];
    const from = option?.from;
    if ( (tileDoc.parent !== canvas.scene) || !Number.isFinite(from?.x) || !Number.isFinite(from?.y) ) return;
    // Clamped here too: any client allowed to create tiles can send creation options.
    const flight = { from: { x: from.x, y: from.y } };
    for ( const [key, { min, max, default: fallback }] of Object.entries(FLIGHT_LIMITS) ) {
      flight[key] = Number.isFinite(option[key]) ? Math.clamp(option[key], min, max) : fallback;
    }
    const control = controls.get(tileDoc.id);
    if ( control ) control.fly(flight);
    else pendingFlights.set(tileDoc.id, flight);
    if ( option.thrown ) playSound(SETTING_THROW_SOUND, SETTING_THROW_VOLUME);
  });
  // A pickup marks its deletion the same way; a GM deleting the tile on the Tiles layer plays nothing.
  Hooks.on("deleteTile", (tileDoc, options) => {
    if ( (tileDoc.parent === canvas.scene) && options[MODULE_ID]?.pickedUp ) {
      playSound(SETTING_PICKUP_SOUND, SETTING_PICKUP_VOLUME);
    }
    // A GM deleting the loot by hand takes its light too. A pickup hands the light back itself.
    const light = lootLight(tileDoc);
    if ( !light || options[MODULE_ID]?.pickedUp ) return;
    light.delete()
      .then(() => forgetHistory(light))
      .catch(err => console.error(`${MODULE_ID} | Could not remove the light of deleted loot`, err));
  });
  // The light a lit lantern carried stays on it while the GM moves or re-levels the tile.
  Hooks.on("updateTile", (tileDoc, changes) => {
    if ( !["x", "y", "elevation", "levels"].some(k => k in changes) ) return;
    const light = lootLight(tileDoc);
    if ( !light ) return;
    const { x, y } = tileDoc.shape.center;
    light.update({ x: Math.round(x), y: Math.round(y), elevation: tileDoc.elevation, levels: [...tileDoc.levels] })
      .then(() => forgetHistory(light))
      .catch(err => console.error(`${MODULE_ID} | Could not move the light with its loot`, err));
  });
  Hooks.on("refreshTile", tile => controls.get(tile.id)?.reposition());
  Hooks.on("destroyTile", tile => {
    if ( controls.get(tile.id)?.tile === tile ) removeControl(tile.id);
  });
  Hooks.on("sightRefresh", () => {
    for ( const control of controls.values() ) control.visible = control.isVisible;
  });
  Hooks.on("activateCanvasLayer", () => {
    if ( container ) syncLayerState();
  });
}
