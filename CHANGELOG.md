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
