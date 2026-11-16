# Mobile experience and asset brief

## Visual direction
Original expressive pixel art: gothic village meets absurd municipal office. Dark plum/charcoal outlines, muted moss/teal environments, warm parchment UI, bone ivory, restrained gold highlights and curse violet. These are III prototype choices, not earlier monochrome restrictions. Lighting from upper left. Avoid gradients on pixel sprites, blurred scaling and modern glossy card dashboards.

#404: ivory skeleton, visible skull and rib/bone language, ragged dark coat, dry expression; never a normal flesh-faced hero. Grib: small green goblin, pointed ears, rogue tools. Brugg: broad grey-green ogre, small tusks and kind eyes, visibly larger than others. Hexa: strict witch silhouette, pointed hat, dark robes. Do not redesign established species or personalities. No reference sheets are bundled; mark generated stand-ins provisional.

Recommended working art grid: 16px tiles; 24×32 humanoid world frames, 32×40 Brugg, 48×48 battle actors (Brugg up to 64×64). These are III production defaults, not old asset dimensions. Head/body/weapon layers must share per-character animation anchors; oversized hero uses its own offsets. Weapons drawn in front/behind appropriately. Draw idle and simple walk animation, one attack pose and hurt flash; do not block gameplay for elaborate frame counts.

Use renderer-generated textures or bundled original PNGs, with a manifest mapping stable IDs to assets. Avoid external asset fetching. Content JSON appearance keys must each resolve to actual layer visuals, including crafted headgear/coat/weapons. Silhouette changes should be visible at phone scale. Validate texture keys at boot. Include an asset inventory identifying provisional/final status.

## Portrait layout
Fit 360×640 CSS pixels as baseline and verify 390×844, 430×932 and desktop 1280×800. Respect safe areas and changing browser chrome. Portrait is preferred, rotation is supported without discarding state. Desktop centres a bounded game region; never stretch pixels non-uniformly.

Exploration: compact objective strip at top, mostly unobstructed world, contextual Interact button, compact Menu/Journal access. Tap a reachable ground tile to pathfind using simple grid A* or BFS; walls block traversal. Tapping NPC targets approaches adjacent reachable tile, then shows interaction prompt. Optional virtual movement buttons and WASD/arrows use the same grid rules. Tap targets must use actual canvas transform, not raw screen coordinates. Cancel movement on menu/dialogue.

Battle: top enemy intent, central stage with party left/enemies right, lower compact party HP/MP/DP summary, commands for current hero underneath. Pick command then target; explicitly confirm costly skills. Don't put large thumb controls over actors. Selected actor/target has a readable outline and label, not colour alone. No party members or enemy HP bars clipped by lower panels. Enemy phase can speed up but never auto-select player actions.

Workshop/inventory: dedicated full panel with return button, scrollable list and selected details. Native readable text rather than rasterized dialogue. Body text target 16 CSS px, touch buttons minimum 44×44 CSS px, clear contrast, no hover-only explanation. Long item names wrap, not shrink to illegibility. Focus and selection visible. Native page zoom must remain available for UI; prevent accidental gameplay gestures only on interactive playfield.

Shell: compact ornamental bone frame and selectable Classic Bone / Bureau Brass CSS themes. No mandatory giant D-pad or decorative bezels consuming half the phone. Shell collection/unlocks beyond these two are future work. Never import II's mandatory GBA framing without a new user instruction.

## Accessibility and audio
Dialogue advance, instant-text option, replayable journal recap. Keyboard confirm/cancel, focus restoration after modals, text labels alongside icons. Reduced-motion removes screen shake and major flashes. Separate music/SFX toggles; audio starts only after user gesture and pauses on background. Simple original procedural sounds are acceptable, and absence of commissioned music must be disclosed. No stolen soundtrack or external hotlinks. No vibration dependency.

## Recap and interruption
Continue shows a one-sentence last action, current objective and Resume. No compulsory tutorial replay. Backgrounding pauses movement/animations/audio and commits state. A player returning mid-battle sees the same active turn and available choices; resume animations may be skipped. No energy loss or enemy actions caused by elapsed clock time.
