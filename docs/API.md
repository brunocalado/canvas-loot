# Canvas Loot API

Put loot on the ground from your own module, system or macro. The items you spawn are ordinary
Canvas Loot: they sparkle, a player picks them up with a click, and stacks merge on the sheet.
Canvas Loot keeps its rule of one item per space and finds free spaces for you, so your loot never
lands on top of a player's drop or under a token.

The API is available as `CanvasLoot` and as `game.modules.get("canvas-loot").api`.

- [Quick start](#quick-start)
- [When to call](#when-to-call)
- [Reference](#reference)
- [The flight](#the-flight)
- [Races](#races)
- [Hooks](#hooks)
- [Chat messages](#chat-messages)
- [Depending on Canvas Loot](#depending-on-canvas-loot)

## Quick start

A GM macro (type **Script**) that drops a world Item called "Gold" next to the selected token,
popping out of it. A macro's body runs inside a function, which is what lets it `return`; to try it
in the browser console instead, wrap it in `(async () => { ... })();`.

```js
const token = canvas.tokens.controlled[0]?.document;
const item = game.items.getName("Gold");
if ( !token || !item ) return ui.notifications.warn("Select a token, and make an Item called Gold.");

const origin = token.getCenterPoint();
const [point] = CanvasLoot.findLootSpaces({
  scene: token.parent, levelId: token.level, origin, around: token.object.bounds
});
if ( !point ) return ui.notifications.warn("No free space next to the token.");

await CanvasLoot.spawnLoot({
  scene: token.parent, levelId: token.level, point, itemData: item.toObject(),
  from: origin, flight: { startScale: 0.2, apexScale: 1.3, arc: 1 }
});
```

## When to call

The API exists from Canvas Loot's `init`. Call it from a **`ready`** hook or later, or wait for
Canvas Loot's own hook, which passes the API:

```js
// At the top level of your script (or in "init"), so the listener exists before the hook fires.
Hooks.once("canvas-loot.ready", api => {
  // ...
});
```

The hook only fires when Canvas Loot is active, so you don't need to check.

`findLootSpaces` and `getQuantityPath` work on every client. **`spawnLoot` runs on the active GM
only** (`game.user.isActiveGM`); anywhere else it rejects. Players can't create tiles, and the queue
that keeps two items off one space lives on that client. When a player's action should make loot,
send it to the GM yourself, with a query or a socket, check it there, and call `spawnLoot` on the
GM's side.

## Reference

### `getQuantityPath()` → `string`

The Item field that holds a stack's size, such as `"system.quantity"`, or `""` when the world has
none. It is the GM's setting, filled in for many systems. Use it to put several units in one tile:

```js
const data = item.toObject();
const path = CanvasLoot.getQuantityPath();
if ( path ) foundry.utils.setProperty(data, path, 5);   // one tile of 5
```

Without a path, every unit is a tile of its own.

### `findLootSpaces(args)` → `{x, y}[]`

Free spaces for loot near a point. A space is free when its centre is inside the scene (the padding
doesn't count), no loot lies on it on that Level, no token stands on it on that Level, and no wall
stands between it and `origin`. Any part of a token counts, whatever its size, and so do hidden
tokens and tokens at another elevation, since they still cover the item on the canvas.

| Argument | Type | Default | |
|---|---|---|---|
| `scene` | `Scene` | | |
| `levelId` | `string` | | The Level to search, such as `token.level`. |
| `origin` | `{x, y}` | | Where walls are tested from. |
| `around` | `{x, y, width, height}` | `null` | Search the spaces around this rectangle, never inside it. A token's `object.bounds` or a region's `bounds` works. Without it, the search starts at the origin's own space. |
| `count` | `number` | `1` | How many spaces to return, at most. |
| `maxRings` | `number` | `3` | How far to look, in rings of spaces. |
| `order` | `"nearest"` or `"random"` | `"nearest"` | `"nearest"` fills the closest ring first. `"random"` draws from every ring up to `maxRings` alike, so a few items spread over the whole area instead of crowding the first ring. |
| `avoid` | `{x, y, width, height}[]` | `[]` | Areas of the canvas the loot must not cover, such as a marker your module draws. A space is skipped when the loot tile on it would overlap one of them; only touching an edge doesn't count. Pad a rectangle to keep a gap around it. |

Returns the centres of the free spaces, at most `count` of them, or `[]` when none fits. Within a
ring the order is random, so two calls don't fill the same side first. On a gridless scene the rings
are circles one grid size apart.

Keep loot off a button you draw in the middle of a region, while still letting it land inside the
region:

```js
const size = 60;   // the button's size on the canvas, in pixels
const { x, y } = region.bounds.center;
const points = CanvasLoot.findLootSpaces({
  scene, levelId, origin, around: token.object.bounds, count: 3,
  avoid: [{ x: x - (size / 2), y: y - (size / 2), width: size, height: size }]
});
```

The rectangles are in canvas coordinates. A marker drawn at a fixed size on screen changes size on
the canvas with the zoom, so pass the size it has on the canvas, the same for every client.

Throws when the Level doesn't exist, for an unknown `order`, or when `avoid` isn't an array of
rectangles with finite numbers and no negative size.

### `spawnLoot(args)` → `Promise<TileDocument|null>` *(active GM only)*

Creates one loot tile from item data.

| Argument | Type | Default | |
|---|---|---|---|
| `scene` | `Scene` | | |
| `levelId` | `string` | | |
| `point` | `{x, y}` | | Inside the scene. On a grid the tile snaps to the centre of that space. |
| `itemData` | `object` | | Item data, such as `item.toObject()`. It is copied; the tile keeps the copy, never a link to the Item. |
| `from` | `{x, y}` | `null` | Where the item flies in from, on every client. Without it, the tile just appears. |
| `thrown` | `boolean` | `false` | Play the GM's throw sound with the flight. Leave it off to play your own. |
| `flight` | `object` | `{}` | The flight's shape. See [The flight](#the-flight). Ignored without `from`. |
| `chat` | `boolean` | `true` | Whisper the GMs a "placed" card that pans to the tile. |

It places the item at `point` even when a token stands there: only `findLootSpaces` keeps loot
off tokens, so a point you choose yourself is yours to choose.

Returns the new tile, or **`null` when that space already holds loot**. See [Races](#races).
Rejects for wrong arguments, a `flight` value out of range, or a client that isn't the active GM.

## The flight

With `from`, the item leaves that point and lands on its space in an arc, the same flight a dropped
or thrown item makes. `flight` shapes it:

| Option | Range | Default | |
|---|---|---|---|
| `delay` | 0 to 5 | `0` | Seconds the item stays hidden before it leaves `from`. |
| `arc` | 0 to 10 | `0` | The least height of the arc, in grid spaces. The arc is never lower than a fifth of the flight's length. |
| `startScale` | 0 to 3 | `1` | The image's size as it leaves `from`, against its size on the ground. |
| `apexScale` | 0.1 to 3 | `1.4` | The image's size at the top of the arc. |

The item always lands at its own size. The defaults are the flight of a dropped item. A flight's
length sets its duration, from 0.3 s for a short hop to 0.9 s at most.

Something popping out of the ground starts small, rises well above a short hop, and grows on the way:

```js
flight: { startScale: 0.2, apexScale: 1.3, arc: 1 }
```

`delay` staggers a burst. Each spawn waits for the GM's database anyway, so items already come out
one after another; a delay spaces them more:

```js
for ( const [i, point] of points.entries() ) {
  await CanvasLoot.spawnLoot({ scene, levelId, point, itemData, from, flight: { delay: i * 0.15 }, chat: false });
}
```

## Races

A player can drop an item on the space you are about to fill. `spawnLoot` runs in the same queue as
drops and pickups and checks the space again inside it, so the two never end up on one space.
Instead of throwing, it returns `null`, and you move on to the next space:

```js
const spaces = CanvasLoot.findLootSpaces({ scene, levelId, origin, around, count: units.length + 4 });
for ( const itemData of units ) {
  let tile = null;
  while ( !tile && spaces.length ) {
    tile = await CanvasLoot.spawnLoot({ scene, levelId, point: spaces.shift(), itemData, from: origin, chat: false });
  }
  if ( !tile ) break;   // no room left: give the rest some other way
}
```

Ask for a few more spaces than you need, so a taken one doesn't leave an item without a place.

Tokens are not checked again. `findLootSpaces` sees where tokens stand when you call it, and
`spawnLoot` places the item wherever you send it. To keep loot off tokens, call `findLootSpaces`
right before `spawnLoot`, with no roll, dialog or other `await` between them, so a token has no
time to move into the space.

## Hooks

| Hook | Where | Args | Notes |
|---|---|---|---|
| `canvas-loot.ready` | every client | `api` | Fired once, on `ready`. |
| `canvas-loot.preChatMessage` | active GM | `messageData`, `{ event, token, item, snapshot, tile, user }` | Fired before each chat message Canvas Loot posts. Return `false` to post nothing. See [Chat messages](#chat-messages). |
| `canvas-loot.pickup` | active GM | `token`, `item`, `{ tile, snapshot, user, merged }` | Fired after a pickup, once the item reached the actor and the tile is gone. Not fired for a pickup that failed. Can't be cancelled. |

For `canvas-loot.pickup`: `token` is the `TokenDocument` that picked it up and `item` the `Item`
that received it. That is a new item, or the stack it merged into when `merged` is `true`. `tile` is
the deleted `TileDocument`, `snapshot` the item data the tile held, and `user` the `User` who
clicked.

It fires on the GM's client only, the one place that knows which item it became, so a listener that
writes documents runs once:

```js
Hooks.on("canvas-loot.pickup", (token, item, { snapshot }) => {
  if ( snapshot.flags?.["my-module"]?.questItem ) ChatMessage.create({ content: `${foundry.utils.escapeHTML(token.name)} found it!` });
});
```

## Chat messages

Every drop, throw, pickup and placed item posts a small card in chat. A system or module can give
it its own look, or drop it, with `canvas-loot.preChatMessage`. It fires on the active GM, the
client that posts the message, with the data the message is about to be created from:

```js
Hooks.on("canvas-loot.preChatMessage", (messageData, { event, snapshot }) => {
  if ( event === "pickup" ) return false;   // no pickup cards
  const { actorName, item } = messageData.flags["canvas-loot"];
  messageData.content = `<div class="my-system-card">
    <img src="${foundry.utils.escapeHTML(item.img)}">
    <p>${foundry.utils.escapeHTML(actorName)}: ${foundry.utils.escapeHTML(item.name)}</p>
    <a data-canvas-loot-show>Show</a>
  </div>`;
});
```

Change `messageData` in place, any field `ChatMessage.create` takes: `content`, `flavor`,
`speaker`, `whisper`, or a `type` and `system` of your own message subtype.

The hook is not awaited: Canvas Loot creates the message as soon as the listener returns, so
`messageData` must be finished by then. A listener that is `async`, or that waits on
`renderTemplate`, changes nothing, and the message goes out with Canvas Loot's own card. Compile
your template beforehand and call it inside the hook:

```js
Hooks.once("canvas-loot.ready", async () => {
  const template = await foundry.applications.handlebars.getTemplate("systems/my-system/templates/loot.hbs");
  Hooks.on("canvas-loot.preChatMessage", messageData => {
    messageData.content = template(messageData.flags["canvas-loot"]);
  });
});
``` Every message carries what happened in `flags["canvas-loot"]`, as data and
not as text, so a card can be built in any language without reading Canvas Loot's HTML:

| Flag | | |
|---|---|---|
| `event` | `"place"`, `"drop"`, `"throw"` or `"pickup"` | |
| `actorName` | `string` | Who did it: the token's name, or the GM's for a placed item. |
| `item` | `{ name, img, quantity }` | `quantity` is how many the tile holds or held: what was dropped, thrown or picked up, not the size of the actor's stack after a pickup merged into it. Left out when the world has no quantity field (see [`getQuantityPath`](#getquantitypath--string)) or the item has no number there. |
| `tileUuid` | `string` | The loot tile. Not on a pickup, whose tile is gone. |
| `distance` | `number` | A throw's distance, rounded to one decimal. Throws only. |
| `units` | `string` | The scene's grid units, such as `"m"`. Throws only. |

Canvas Loot writes these flags again after the hook, so they stay as they are whatever a listener
does to them.

The second argument: `event` again, `token` the `TokenDocument` that acted (`null` for a placed
item), `item` the `Item` the loot left (a drop or throw, and it may be deleted by now) or reached
(a pickup), `null` for `spawnLoot`, `snapshot` the item data the tile holds, `tile` the loot
`TileDocument` (deleted, for a pickup), and `user` the `User` who acted.

A click on the element that carries `data-canvas-loot-show` pans to the loot and pings it, as on
Canvas Loot's own card. Put it on whatever should do that in yours, or leave it out. A message
without `tileUuid` has nothing to show.

A placed item is whispered to the GMs. `spawnLoot` with `chat: false` posts no message and fires
no hook.

## Depending on Canvas Loot

In your `module.json`:

```json
"relationships": {
  "requires": [
    {
      "id": "canvas-loot",
      "type": "module",
      "manifest": "https://github.com/brunocalado/canvas-loot/releases/latest/download/module.json",
      "reason": "Drops what this module makes as loot on the map."
    }
  ]
}
```

Use `recommends` instead of `requires` if your module also works without it.
