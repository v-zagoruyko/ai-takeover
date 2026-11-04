# Living purchases on the world map

## Intent

Make global purchases visibly inhabit the world. Viktor rejected the schematic icon prototype and asked for a detailed implementation directly in the game, with the visual choices delegated to the implementer. No new regional deployment, resources or balance rules.

## Approach

Considered one-shot purchase effects, persistent scenery and changes to the network. Use persistent miniature scenes with activity: buildings, display screens, taxi depots and vehicles, robotic manufacturing, laboratories, homes and replicated server clusters. Reuse the existing map, camera and adoption network; no new dependencies or external assets.

Products and capabilities map to twelve visual families. Scenery is illustrative: there is no per-product regional adoption metric. All available products and capabilities are represented by the mapping. Bought capabilities remain visible but lose active animation and brightness when throttled or starved of compute. Closed or banned regions hide their scenery.

## Readability and lifecycle

- At most three sites per region; regions below 0.4% adoption show none (the starting region already qualifies).
- The repertoire varies across regions, with a place for the latest purchase in developed regions. Small regions can hold fewer scenes.
- Placement is stable, checks the full scene footprint inside land geometry and stays separate from the simulation RNG. Narrow islands use smaller scenes; the layout prefers mainland geometry near the region anchor over remote overseas territory.
- Miniatures grow more slowly than map zoom. Existing labels and power markers take priority; nearby scenery fades out.
- Sites are decorative and do not receive pointer events. Map selection, dragging and bubbles keep their current behavior.
- Textures are generated once and reused. Site objects are reused across purchases and restarts, with a bounded object count.
- Reduced-motion mode renders static activity. As with the existing map ambience, normal cosmetic animation is independent of simulation speed.

## Validation

Typecheck, production build, the existing test suite, and browser checks on the actual game: populated and empty regions, purchase changes, throttled/compute-starved capabilities, bans, restart, zoom, reduced motion and region selection through scenery. One final independent review before commit and push. Simulation and replay code are unchanged, so no balance version bump is needed.

## Scope of publication

Publish the new scenery together with the previously unpushed `343ca75` UI fixes. The standalone exploration mockup remains outside the repository. Investor goals, event-window behavior and mobile panel redesign remain separate tasks.
