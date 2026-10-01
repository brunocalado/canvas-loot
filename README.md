# 🎒 Canvas Loot

**Drop it, throw it, pick it up — right on the map!**

![A character throws a spear across the map to a friend](docs/throw.gif)

The rogue tosses the healing potion across the room to the fighter. The wizard drops a torch at
the cave entrance for whoever comes next. The goblin's rusty key lies on the floor, glinting,
waiting for someone brave enough to walk over and grab it.

With Canvas Loot, items stop being lines on a character sheet and become things you can **see on
the map**. Drag an item off a sheet and it lands on the canvas with its own picture. Anyone
standing next to it can pick it up with a single click. No more "wait, who has the rope?" — just
look at the map. Works in any system.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-Donate-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/mestredigital) [![More Modules](https://img.shields.io/badge/Foundry%20VTT-More%20Modules-red?style=for-the-badge&logo=gamepad)](https://mestredigital.online/pages/projetos-en)

---

# ✨ Why you'll love it

- 🧭 **Where you stand matters.** You can drop what your token can reach and throw what it can't,
  but not through walls. To pick something up, you have to walk over to it.
- 🔒 **Nothing duplicates, nothing vanishes.** An item is either on a sheet or on the map, never
  both and never neither. Not when two players grab it at once, and not after a Ctrl+Z.
- ✨ **Loot that catches the eye.** Dropped items sparkle, shine or hop so players spot them.
  Or turn that off and let them search the room.
- 🔦 **A dropped torch keeps burning.** With [Light Sources](https://github.com/brunocalado/light-sources),
  a lit lantern lights up the floor where it lands.
- 🎲 **Any system.** Ready-made settings for many systems, and two simple settings for the rest.
- 🧩 **Nothing new to learn for the GM.** Loot is an ordinary Foundry tile: move it, hide it or
  delete it on the Tiles layer like any other.

---

# 🎁 Features

### 🤲 Drop: leave it on the ground

Select your token and drag an item from its sheet onto the map, next to the token. The item leaves
the sheet, flies out of the token's hands and lands on that spot, snapped to the grid. One item per
space: a spot that already holds loot is refused. Dropping part of a stack (ten arrows, three
potions) asks how many, and only those leave the sheet.

![Dragging a spear from the character sheet and dropping it next to the token](docs/drop-item.gif)

No guessing while you drag: rings around your token shade where you can drop (green) and throw
(amber), bending around walls, and the space under the cursor shows the throw distance, or turns
red with the reason the item can't go there.

The GM can place items anywhere without a token: handy for hiding treasure before the session.
Only the GMs are told about it in chat, so the surprise stays a surprise.
With the token of the character carrying the item selected, the GM drops and throws by the same
rules as a player.

### 🏀 Throw: send it across the room

Drop farther than arm's reach and the item is thrown instead. It flies in an arc from the token
and lands where you pointed, as long as the spot is within throwing range and no wall is in the
way. Hand the healing potion to the friend on the other side of the room, or toss the rope to the
one stuck across the chasm. Every throw comes with a whoosh, and the chat tells the table how far
it went.

### ✋ Pick up: grab what's nearby

Select your token, walk it next to the loot and click it. The item goes back onto your character's
sheet and disappears from the map with a satisfying pickup sound. Hover over a piece of loot to see
its name.

![Hovering over the spear shows its name, and a click puts it back on the sheet](docs/pick-up.gif)

Picking up arrows when you already carry the same arrows? They join your existing stack instead of
showing up as a second entry (in systems that track quantities). And if two players go for the same
item, the first one gets it.

Players can only click loot their tokens can see, and loot the GM hides stays out of their reach.
Whenever someone drops, throws or picks something up, a short chat message tells the table. Lost
track of where it landed? Click the drop or throw message and the map pans to the item.

### 🔦 Light Sources: carry the light

Canvas Loot works with [Light Sources](https://github.com/brunocalado/light-sources). A lit
lantern you drop or throw keeps shining where it lands, lighting up the floor around it. Toss a
torch down a dark corridor to see what's waiting there.

![In the dark, the sparkle gives a torch away; the character walks over and picks it up](docs/pick-up-torch.gif)

### 🌟 Highlight: make loot stand out

Choose how loot draws the eye on the map:

- **Sparkle**: a twinkling star in the item's corner (the default).
- **Shine**: a band of light sweeps across the item.
- **Jiggle**: the item wiggles in place.
- **Hop**: the item bounces up and down.
- **Ring**: a circle pulses on the ground around it.
- **None**: loot sits still, and players have to find it themselves.

Anyone who turns on Foundry's photosensitive mode sees loot at rest, without the animation.

---

# ⚙️ Settings

All settings are in **Game Settings → Configure Settings → Canvas Loot**.

- **Loot highlight**: pick one of the effects above.
- **Droppable items**: choose which kinds of items can go on the map (a sword, yes; a class
  feature, no) and which field holds an item's quantity. **Restore system defaults** puts the
  ready-made choice back.
- **Throwing and sounds**: turn throwing off, or set how far a character can throw, from 2 to 60
  grid spaces (30 by default). You can also pick the sounds a throw and a pickup make, and their
  volumes. They play on the Environment volume channel, and leaving a sound empty silences it.

**Systems with ready-made settings:** Alien RPG, Band of Blades, Blades in the Dark, Cairn 2e,
Crucible, Daggerheart, D&D 5e, Draw Steel, Dungeon World, Household, ICRPG, Pathfinder 2e,
Powered by the Apocalypse, Savage Worlds (SWADE), Scum and Villainy, Simple Worldbuilding,
Starfinder 2e, Tormenta20, Twodsix, Vagabond and World of Darkness 5e.

Playing something else? It still works: every kind of item starts droppable, and items move
whole until you tell **Droppable items** which field holds the quantity.

---

# 🚀 Getting started

1. **Enable the module** in your world.
2. **Take a quick look at the settings.** Open **Droppable items** and make sure the item types
   and the quantity field fit your system. On a system from the list above, it's already done.
3. **Play.** A player selects their token and drags an item from the sheet onto the map. To pick
   it back up, they walk next to it and click.

> **Note:** a GM must be connected for loot to be dropped or picked up, because the GM's client is
> the one that places and removes the loot on the map.

---

# 📦 Installation

Requires Foundry VTT v14. Install via the Foundry VTT Module browser or use this manifest link:

```js
https://github.com/brunocalado/canvas-loot/releases/latest/download/module.json
```

Optional: install [Light Sources](https://github.com/brunocalado/light-sources) too, so dropped
torches and lanterns keep burning.

---

# 📜 License

* GNU General Public License version 3. See `LICENSE`.

* whoosh and pick-up https://pixabay.com/service/license-summary/
