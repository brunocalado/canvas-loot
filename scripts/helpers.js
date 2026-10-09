/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import {
  MODULE_ID, FLAG_ITEM, LIGHT_SOURCES_ID, LOOT_SCALE, SETTING_QUANTITY_PATH, SETTING_THROW_ENABLED,
  SETTING_THROW_RANGE, SYSTEM_PRESETS
} from "./constants.js";

let queue = Promise.resolve();

/**
 * An item's stack size under the configured quantity field, or null when it has none there. Read
 * from the source, since the source is what an update writes back.
 * @param {Item} item
 * @returns {number|null}
 */
export function getQuantity(item) {
  const path = game.settings.get(MODULE_ID, SETTING_QUANTITY_PATH);
  if ( !path ) return null;
  const n = foundry.utils.getProperty(item.toObject(), path);
  return Number.isInteger(n) ? n : null;
}

/** The Item types the active system starts with disabled: every type its preset leaves out. */
export function presetDisabledTypes() {
  const preset = SYSTEM_PRESETS[game.system.id];
  if ( !preset ) return [];
  return game.documentTypes.Item.filter(t => (t !== CONST.BASE_DOCUMENT_TYPE) && !preset.itemTypes.includes(t));
}

/**
 * Run GM-side mutations one at a time, in arrival order, so the first request wins when two
 * players race for the same item or tile.
 * @param {() => Promise<*>} fn
 * @returns {Promise<*>}
 */
export function serial(fn) {
  return (queue = queue.then(fn, fn));
}

/**
 * Take a loot tile, or the light it carries, out of its layer's undo history. The GM's client
 * records every change it makes to the scene it is viewing, including the ones made for a player's
 * query, so Ctrl+Z would otherwise delete a dropped item or bring back one already picked up: the
 * item would end up in neither place, or in both. A light brought back without its tile would
 * burn where nothing can claim it.
 * @param {TileDocument|AmbientLightDocument} doc
 */
export function forgetHistory(doc) {
  if ( !canvas.scene || (doc.parent !== canvas.scene) ) return;
  const layer = doc.layer;
  if ( !layer ) return;
  for ( const event of layer.history ) event.data = event.data.filter(d => d._id !== doc.id);
  layer.history = layer.history.filter(event => event.data.length);
}

/**
 * Whether loot already lies where a drop at this point would land: one item per grid space, or on a
 * gridless scene, no overlap with another item's tile. Loot on other levels doesn't count. Reads the
 * scene rather than the canvas, for the same reason as classifyDistance.
 * @param {Scene} scene
 * @param {string} levelId
 * @param {{x: number, y: number}} point
 * @returns {boolean}
 */
export function isLootAt(scene, levelId, point) {
  const grid = scene.grid;
  const target = grid.isGridless ? null : grid.getOffset(point);
  const size = grid.size * LOOT_SCALE;
  return scene.tiles.some(tile => {
    if ( !tile.getFlag(MODULE_ID, FLAG_ITEM) || !tile.includedInLevel(levelId) ) return false;
    const c = tile.shape.center;
    if ( !target ) {
      return (Math.abs(c.x - point.x) < ((tile.width + size) / 2)) && (Math.abs(c.y - point.y) < ((tile.height + size) / 2));
    }
    const o = grid.getOffset(c);
    return (o.i === target.i) && (o.j === target.j);
  });
}

/**
 * A test for whether a token on this Level stands where loot at a point would lie: on one of the
 * token's spaces on a grid, or overlapping its rectangle on a gridless scene. Neither elevation nor
 * hidden counts: a flying token still covers the item on the canvas, and a hidden one would cover it
 * once revealed. Only tokens reaching into `near` are read, since each one's spaces cost a sweep.
 * @param {Scene} scene
 * @param {string} levelId
 * @param {PIXI.Rectangle} near
 * @returns {(point: {x: number, y: number}) => boolean}
 */
function tokenOccupancy(scene, levelId, near) {
  const grid = scene.grid;
  // The token's own level, not includedInLevel: that also takes in tokens on Levels visible from this one.
  const tokens = scene.tokens.filter(t => {
    if ( t.level !== levelId ) return false;
    const { width, height } = t.getSize();
    return near.intersects(new PIXI.Rectangle(t.x, t.y, width, height));
  });
  if ( grid.isGridless ) {
    const size = grid.size * LOOT_SCALE;
    const rects = tokens.map(t => ({ ...t.getCenterPoint(), ...t.getSize() }));
    return p => rects.some(r => (Math.abs(r.x - p.x) < ((r.width + size) / 2)) && (Math.abs(r.y - p.y) < ((r.height + size) / 2)));
  }
  // Core's own footprint: half sizes, hex shapes and walls through the token are already handled.
  const spaces = new Set();
  for ( const t of tokens ) {
    for ( const { i, j } of t.getOccupiedGridSpaceOffsets() ) spaces.add(`${i},${j}`);
  }
  return p => {
    const { i, j } = grid.getOffset(p);
    return spaces.has(`${i},${j}`);
  };
}

/**
 * Free spaces for loot near a point: each one inside the scene (padding excluded), on the given
 * Level, with no loot or token on it, and not behind a wall as seen from `origin`. With `around`,
 * the search starts at the ring of spaces just outside that rectangle and never returns a space
 * whose centre is inside it; without it, the ring starts at the origin's own space. Spaces within
 * a ring come in random order, so repeated calls scatter loot instead of filling one side first.
 * With order "random", every free space up to maxRings is drawn from alike, so a few items spread
 * over the whole radius instead of crowding the first ring.
 * @param {object} args
 * @param {Scene} args.scene
 * @param {string} args.levelId
 * @param {{x: number, y: number}} args.origin       where walls are tested from
 * @param {{x: number, y: number, width: number, height: number}|null} [args.around]
 * @param {number} [args.count=1]
 * @param {number} [args.maxRings=3]
 * @param {"nearest"|"random"} [args.order="nearest"]
 * @returns {{x: number, y: number}[]}   space centres, at most `count`; nearest rings first, or
 *                                       shuffled across all rings with "random"
 */
export function findLootSpaces({ scene, levelId, origin, around = null, count = 1, maxRings = 3, order = "nearest" }) {
  const level = scene?.levels?.get(levelId);
  if ( !level ) throw new Error(`${MODULE_ID} | findLootSpaces: unknown level`);
  if ( !["nearest", "random"].includes(order) ) {
    throw new Error(`${MODULE_ID} | findLootSpaces: order must be "nearest" or "random"`);
  }
  const grid = scene.grid;
  const sceneRect = scene.dimensions.sceneRect;
  const area = around ? new PIXI.Rectangle(around.x, around.y, around.width, around.height) : null;
  // The polygon backend reads only x, y and elevation off the origin, so a plain point will do.
  const from = { x: origin.x, y: origin.y, elevation: level.elevation.base };
  // Everything the farthest ring can reach, with a space to spare for loot and grid rounding.
  const reach = (maxRings + 1) * Math.max(grid.sizeX, grid.sizeY);
  const near = (grid.isGridless || !area) ? new PIXI.Rectangle(origin.x, origin.y, 0, 0) : area.clone();
  near.pad(reach + ((grid.isGridless && area) ? Math.hypot(area.width, area.height) / 2 : 0));
  const isTokenAt = tokenOccupancy(scene, levelId, near);
  const isFree = p => sceneRect.contains(p.x, p.y) && !area?.contains(p.x, p.y) && !isLootAt(scene, levelId, p)
    && !isTokenAt(p) && !CONFIG.Canvas.polygonBackends.move.testCollision(from, p, { type: "move", mode: "any", level });

  const first = area ? 1 : 0;
  const found = [];
  for ( let r = first; r <= maxRings; r++ ) {
    const ring = shuffle(ringPoints(grid, origin, area, r)).filter(isFree);
    found.push(...ring);
    if ( (order === "nearest") && (found.length >= count) ) break;
  }
  return (order === "random" ? shuffle(found) : found).slice(0, count);
}

/**
 * The candidate points of one search ring. Gridded: the centres of every space at Chebyshev
 * distance exactly r from the block of spaces `area` covers (or the origin's own space), which is
 * the same scan the drag preview does. Gridless: points evenly spaced on a circle around the
 * origin, starting from a random angle.
 * @param {BaseGrid} grid
 * @param {{x: number, y: number}} origin
 * @param {PIXI.Rectangle|null} area
 * @param {number} r
 * @returns {{x: number, y: number}[]}
 */
function ringPoints(grid, origin, area, r) {
  if ( grid.isGridless ) {
    const radius = (area ? Math.hypot(area.width, area.height) / 2 : 0) + (r * grid.size);
    if ( radius === 0 ) return [{ x: origin.x, y: origin.y }];
    const n = Math.max(6, Math.round(2 * Math.PI * radius / grid.size));
    const start = Math.random() * 2 * Math.PI;
    return Array.fromRange(n).map(k => {
      const angle = start + (2 * Math.PI * k / n);
      return { x: origin.x + (radius * Math.cos(angle)), y: origin.y + (radius * Math.sin(angle)) };
    });
  }
  const a = grid.getOffset(area ? { x: area.x, y: area.y } : origin);
  const b = area ? grid.getOffset({ x: area.right - 1, y: area.bottom - 1 }) : a;
  const points = [];
  for ( let i = a.i - r; i <= b.i + r; i++ ) {
    for ( let j = a.j - r; j <= b.j + r; j++ ) {
      const d = Math.max(a.i - i, i - b.i, a.j - j, j - b.j);
      if ( d === r ) points.push(grid.getCenterPoint({ i, j }));
    }
  }
  return points;
}

/** Shuffle an array in place (Fisher–Yates) and return it. */
function shuffle(array) {
  for ( let i = array.length - 1; i > 0; i-- ) {
    const k = Math.floor(Math.random() * (i + 1));
    [array[i], array[k]] = [array[k], array[i]];
  }
  return array;
}

/**
 * The Light Sources API, when that module is active and new enough to carry a light with an item.
 * Without it, loot moves no light at all.
 * @returns {object|null}
 */
export function getLightSourcesApi() {
  const lightSources = game.modules.get(LIGHT_SOURCES_ID);
  const api = lightSources?.active ? lightSources.api : null;
  if ( (typeof api?.dropLightWithItem !== "function") || (typeof api?.pickupGroundLight !== "function") ) return null;
  return api;
}

/**
 * Classify a point by its distance from a token: within reach, within throwing range, or neither.
 * Reads only the token's own scene, never the canvas, because the GM's client that re-checks a
 * player's request may be viewing another scene.
 * The distance is in the scene's units, measured from the token's nearest edge (gridless) or nearest
 * occupied space; it is only computed for a throw.
 * @param {TokenDocument} tokenDoc
 * @param {{x: number, y: number}} point
 * @returns {{kind: "adjacent"|"throw"|"out", distance?: number}}
 */
export function classifyDistance(tokenDoc, point) {
  return distanceClassifier(tokenDoc)(point);
}

/**
 * classifyDistance for one token and many points: what depends only on the token and the settings is
 * read once, which the drag preview needs to classify every space around the token.
 * @param {TokenDocument} tokenDoc
 * @returns {(point: {x: number, y: number}) => {kind: "adjacent"|"throw"|"out", distance?: number}}
 */
export function distanceClassifier(tokenDoc) {
  const scene = tokenDoc.parent;
  const grid = scene.grid;
  const range = game.settings.get(MODULE_ID, SETTING_THROW_ENABLED)
    ? game.settings.get(MODULE_ID, SETTING_THROW_RANGE) : 0;
  const { width, height } = tokenDoc.getSize();
  // Occupied offsets are 3D, one per elevation step. testAdjacency returns false when only one
  // side has a k, so they are flattened to the 2D offsets the drop point has.
  const spaces = new Map();
  if ( !grid.isGridless ) {
    for ( const { i, j } of tokenDoc.getOccupiedGridSpaceOffsets() ) spaces.set(`${i}.${j}`, { i, j });
  }
  const offsets = [...spaces.values()];
  const centres = offsets.map(o => grid.getCenterPoint(o));
  // Token#checkCollision needs the placeable, which exists only on a client viewing the scene.
  // The polygon backend works from the Level's edges instead, which core builds on demand.
  const level = scene.levels.get(tokenDoc.level);
  const origin = tokenDoc.getMovementOrigin();

  return point => {
    let kind;
    let distance;
    let landing = point;
    if ( grid.isGridless ) {
      const dx = Math.max(tokenDoc.x - point.x, 0, point.x - (tokenDoc.x + width));
      const dy = Math.max(tokenDoc.y - point.y, 0, point.y - (tokenDoc.y + height));
      const gap = Math.hypot(dx, dy) / grid.size;
      kind = (gap <= 1) ? "adjacent" : ((gap <= range) ? "throw" : "out");
      distance = gap * grid.distance;
    } else {
      const target = grid.getOffset(point);
      landing = grid.getCenterPoint(target);
      if ( offsets.some(o => ((o.i === target.i) && (o.j === target.j)) || grid.testAdjacency(o, target)) ) {
        kind = "adjacent";
      }
      else {
        const paths = centres.map(c => grid.measurePath([c, landing]));
        // Spaces decide the range; among equals, the shortest distance is the one reported, since an
        // exact diagonal rule makes paths of the same spaces differ in length.
        const nearest = paths.reduce((a, b) => (((b.spaces < a.spaces)
          || ((b.spaces === a.spaces) && (b.distance < a.distance))) ? b : a));
        kind = (nearest.spaces <= range) ? "throw" : "out";
        distance = nearest.distance;
      }
    }
    if ( kind === "out" ) return { kind };
    const result = (kind === "throw") ? { kind, distance } : { kind };
    if ( !level ) return result;
    const blocked = CONFIG.Canvas.polygonBackends.move.testCollision(origin, landing, { type: "move", mode: "any", level });
    return blocked ? { kind: "out" } : result;
  };
}
