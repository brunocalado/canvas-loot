/*!
 * Canvas Loot
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID, SETTING_THROW_ENABLED, SETTING_THROW_RANGE } from "./constants.js";
import { checkDrop, LOOT_TAKEN } from "./drop.js";
import { distanceClassifier, isLootAt } from "./helpers.js";

/**
 * While an item is dragged over the canvas, two rings around the token outline where it can be
 * dropped (green) and thrown (amber), and the space under the cursor shows what a drop there would
 * do: green for a drop, amber for a throw with its distance, red with the reason it would be
 * refused. The same rules that refuse the real drop decide both, so the preview never disagrees
 * with it. A GM placing loot freely gets no preview, since every spot is allowed.
 */

const LAYER = `${MODULE_ID}.drop-preview`;
const RINGS_LAYER = `${MODULE_ID}.drop-rings`;
const COLORS = { drop: 0x3fae49, throw: 0xe0a030, refused: 0xd04040 };

/** The Item being dragged, or null when the drag carries anything else. */
let dragged = null;

/** Whether this drag's rings were drawn, which happens once, on its first dragover. */
let ringsDrawn = false;

/** The grid space (or gridless point) last drawn, so a dragover that stays on it draws nothing. */
let lastKey = null;

let label = null;

/**
 * The drag data only exists during dragstart, and core's DragDrop stops that event's propagation
 * once a sheet has set it, so a listener on the document never sees it filled in. A capturing
 * listener runs first and wraps this one event's setData to read the payload as the sheet writes it.
 * @param {DragEvent} event
 */
function onDragStart(event) {
  endDrag();
  const transfer = event.dataTransfer;
  if ( !transfer ) return;
  const setData = transfer.setData;
  transfer.setData = function(format, value) {
    if ( format === "text/plain" ) readPayload(value);
    return setData.call(this, format, value);
  };
}

function readPayload(value) {
  let data;
  try {
    data = JSON.parse(value);
  } catch {
    return;
  }
  if ( (data?.type !== "Item") || (typeof data.uuid !== "string") ) return;
  // A compendium entry resolves to an index entry, not an Item; only a GM drops those, anywhere.
  const item = fromUuidSync(data.uuid);
  dragged = (item?.documentName === "Item") ? item : null;
}

/** @param {DragEvent} event */
function onDragOver(event) {
  if ( !dragged || !canvas.ready ) return;
  if ( !ringsDrawn ) {
    ringsDrawn = true;
    drawRings();
  }
  const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  const grid = canvas.grid;
  let key;
  if ( grid.isGridless ) key = `${Math.round(point.x)}.${Math.round(point.y)}`;
  else {
    const { i, j } = grid.getOffset(point);
    key = `${i}.${j}`;
  }
  if ( key === lastKey ) return;
  lastKey = key;
  draw(point);
}

/**
 * Shade and outline the spaces the controlled token can drop on and throw to. Every space near the
 * token is classified by the same rule a drop runs, walls included, so the rings follow the scene's
 * diagonal rule and bend around walls. The outline is every cell edge the region does not share
 * with itself, which works for square and hex grids alike. On a gridless scene the reach is a
 * distance from the token's edges, so the rings are its rectangle grown by that distance.
 */
function drawRings() {
  const token = canvas.tokens.controlled[0]?.document ?? null;
  // Checked at the token's own centre, which is always in reach: a refusal there is about the item
  // or the token, and the label under the cursor gives its reason instead.
  try {
    if ( checkDrop(dragged, token, token?.getCenterPoint() ?? { x: 0, y: 0 }, game.user).kind === "place" ) return;
  } catch {
    return;
  }

  const grid = canvas.grid;
  const layer = canvas.interface.grid.addHighlightLayer(RINGS_LAYER);
  layer.clear();
  const s = canvas.dimensions.uiScale;

  if ( grid.isGridless ) {
    const { width, height } = token.getSize();
    const range = throwRange();
    const grow = r => new PIXI.RoundedRectangle(token.x - r, token.y - r, width + (2 * r), height + (2 * r), r);
    const throwArea = grow(range * grid.size);
    const dropArea = grow(grid.size);
    if ( range > 1 ) {
      layer.beginFill(COLORS.throw, 0.06).drawShape(throwArea).endFill();
      strokeRing(layer, COLORS.throw, s, l => l.drawShape(throwArea));
    }
    layer.beginFill(COLORS.drop, 0.1).drawShape(dropArea).endFill();
    strokeRing(layer, COLORS.drop, s, l => l.drawShape(dropArea));
    return;
  }

  const reach = throwRange() + 1;
  const occupied = token.getOccupiedGridSpaceOffsets();
  const is = occupied.map(o => o.i);
  const js = occupied.map(o => o.j);
  const rect = canvas.dimensions.rect;
  const classify = distanceClassifier(token);
  const near = [];
  const far = [];
  for ( let i = Math.min(...is) - reach; i <= Math.max(...is) + reach; i++ ) {
    for ( let j = Math.min(...js) - reach; j <= Math.max(...js) + reach; j++ ) {
      const centre = grid.getCenterPoint({ i, j });
      if ( !rect.contains(centre.x, centre.y) ) continue;
      const { kind } = classify(centre);
      if ( kind === "out" ) continue;
      (kind === "adjacent" ? near : far).push(centre);
    }
  }
  const shape = grid.getShape();
  const fill = (centres, color, alpha) => {
    layer.beginFill(color, alpha);
    for ( const c of centres ) layer.drawPolygon(shape.flatMap(p => [c.x + p.x, c.y + p.y]));
    layer.endFill();
  };
  const traceEdges = edges => l => {
    for ( const [a, b] of edges ) l.moveTo(a.x, a.y).lineTo(b.x, b.y);
  };
  if ( far.length ) {
    fill(far, COLORS.throw, 0.06);
    strokeRing(layer, COLORS.throw, s, traceEdges(outline([...near, ...far])));
  }
  fill(near, COLORS.drop, 0.1);
  strokeRing(layer, COLORS.drop, s, traceEdges(outline(near)));
}

/** The throwing range in grid spaces, 0 when throwing is off: how far from the token to scan. */
function throwRange() {
  return game.settings.get(MODULE_ID, SETTING_THROW_ENABLED) ? game.settings.get(MODULE_ID, SETTING_THROW_RANGE) : 0;
}

/**
 * The edges of a region of grid spaces that no two of its spaces share: its outline.
 * @param {{x: number, y: number}[]} centres   the region's space centres
 * @returns {Array<[{x: number, y: number}, {x: number, y: number}]>}
 */
function outline(centres) {
  const shape = canvas.grid.getShape();
  // Neighbouring spaces compute a shared vertex from different centres, so keys are rounded.
  const key = p => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  const edges = new Map();
  for ( const c of centres ) {
    const points = shape.map(p => ({ x: c.x + p.x, y: c.y + p.y }));
    for ( let k = 0; k < points.length; k++ ) {
      const a = points[k];
      const b = points[(k + 1) % points.length];
      const id = [key(a), key(b)].sort().join("|");
      edges.set(id, edges.has(id) ? null : [a, b]);
    }
  }
  return [...edges.values()].filter(Boolean);
}

/**
 * Stroke a ring as a soft glow under a crisp line.
 * @param {PIXI.Graphics} layer
 * @param {number} color
 * @param {number} s                           the canvas UI scale
 * @param {(layer: PIXI.Graphics) => void} trace   draws the ring's path with the current line style
 */
function strokeRing(layer, color, s, trace) {
  for ( const [width, alpha] of [[16 * s, 0.2], [4 * s, 0.95]] ) {
    layer.lineStyle(width, color, alpha);
    trace(layer);
  }
  layer.lineStyle(0);
}

/** @param {{x: number, y: number}} point */
function draw(point) {
  const token = canvas.tokens.controlled[0]?.document ?? null;
  let kind;
  let text;
  try {
    if ( !canvas.dimensions.rect.contains(point.x, point.y) ) throw new Error("That spot is outside the scene.");
    const result = checkDrop(dragged, token, point, game.user);
    kind = result.kind;
    if ( (kind !== "place") && isLootAt(token.parent, token.level, point) ) throw new Error(LOOT_TAKEN);
    if ( kind === "drop" ) text = "Drop";
    else if ( kind === "throw" ) text = `Throw ${Math.round(result.distance * 10) / 10} ${canvas.grid.units}`.trim();
  } catch(err) {
    kind = "refused";
    text = err.message;
  }
  if ( kind === "place" ) {
    clear();
    return;
  }

  const grid = canvas.grid;
  const highlight = canvas.interface.grid;
  highlight.addHighlightLayer(LAYER);
  highlight.clearHighlightLayer(LAYER);
  const color = COLORS[kind];
  let centre;
  if ( grid.isGridless ) {
    centre = point;
    const shape = new PIXI.Circle(point.x, point.y, grid.size / 2);
    highlight.highlightPosition(LAYER, { x: point.x, y: point.y, color, border: color, alpha: 0.35, shape });
  } else {
    centre = grid.getCenterPoint(point);
    const { x, y } = grid.getTopLeftPoint(point);
    highlight.highlightPosition(LAYER, { x, y, color, border: color, alpha: 0.35 });
  }

  // Same style source and size as the loot tiles' labels. The wrap width is in the text's own units,
  // not the grid's, so a short label stays on one line on a small grid and a refusal takes two.
  const s = canvas.dimensions.uiScale;
  if ( !label || label.destroyed ) {
    const style = CONFIG.canvasTextStyle.clone();
    style.fontSize = 24;
    style.wordWrap = true;
    style.wordWrapWidth = 320;
    style.align = "center";
    label = new foundry.canvas.containers.PreciseText("", style);
    label.anchor.set(0.5, 0);
  }
  if ( label.parent !== canvas.controls ) canvas.controls.addChild(label);
  label.text = text;
  label.scale.set(s, s);
  label.position.set(centre.x, centre.y + (grid.size / 2) + (4 * s));
  label.visible = true;
}

/** Remove the highlight and the label, keeping the dragged item for a later dragover. */
function clear() {
  lastKey = null;
  if ( !canvas.ready ) return;
  canvas.interface.grid.clearHighlightLayer(LAYER);
  if ( label && !label.destroyed ) label.visible = false;
}

function endDrag() {
  dragged = null;
  ringsDrawn = false;
  clear();
  if ( canvas.ready ) canvas.interface.grid.clearHighlightLayer(RINGS_LAYER);
}

export function registerDropPreview() {
  document.addEventListener("dragstart", onDragStart, { capture: true });
  document.addEventListener("dragend", endDrag);
  Hooks.on("canvasReady", () => {
    // canvas.app outlives scene changes, and adding the same listener twice keeps one.
    const view = canvas.app.view;
    view.addEventListener("dragover", onDragOver);
    view.addEventListener("dragleave", clear);
    view.addEventListener("drop", endDrag);
    lastKey = null;
  });
}
