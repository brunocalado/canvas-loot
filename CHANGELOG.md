# Unreleased

- [Added] The GM can right-click loot on the canvas to open the item's sheet, read-only, without picking it up.
- [Fixed] Loot no longer shows where your tokens cannot see: behind walls, outside a limited vision cone, or in explored fog. The GM, and anyone without token vision, still sees it all.

# 0.3.0

- [Added] API: the `canvas-loot.preChatMessage` hook lets a system or module restyle or cancel every loot chat card before it is posted. See "Chat messages" in docs/API.md.
- [Added] Loot chat messages carry what happened as data in their flags: the event, who acted, the item with its quantity, the tile, and a throw's distance.
- [Added] Chat cards show how many items a stack held, such as "picked up 5 × Torch".
- [Changed] The "Show on the map" click follows a `data-canvas-loot-show` attribute, so a card that replaces ours chooses where it goes. Cards posted before this version no longer pan to their loot.
- [Fixed] A token standing next to loot could be told "Your token cannot reach that item" while the GM's window was in the background: reach was measured from where the token's move animation had got to on the GM's client, not from where the token stood.

# 0.2.0

- [Added] API: findLootSpaces takes an `avoid` list of rectangles, and skips any space where the loot would cover one of them.

# 0.1.1

- [Changed] API: findLootSpaces no longer returns a space where a token stands on that Level, whatever its size, elevation or visibility. spawnLoot still places loot wherever it is sent.

# 0.1.0

- [Added] An API for other modules: find free spaces for loot, spawn loot with a shaped flight, and react to pickups. See docs/API.md.

# 0.0.1

- [Added] First release.
- [Added] Drop items from a sheet onto the canvas as loot tiles, within the token's reach.
- [Added] Throw items farther away, up to a configurable range and never through walls.
- [Added] Pick loot back up by walking next to it and clicking; matching stacks merge.
- [Added] Loot highlight effects: Sparkle, Shine, Jiggle, Hop, Ring or None.
- [Added] Ready-made droppable item settings for many systems, and two settings for the rest.
- [Added] Light Sources support: a dropped or thrown lit light keeps burning where it lands.
