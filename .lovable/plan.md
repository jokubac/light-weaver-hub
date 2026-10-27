# NOX – next batch (15 items)

Grouped by area. Bugs that aren't diagnosed yet (pixel effects disappearing, wrong Kelvin) start with an investigation step.

## 1. Programming keypad
- **Bigger keypad:** an "Extend" button opens a full keypad with THRU, +, −, AT, FULL, OUT, @ level, Odd/Even, Next/Prev, Clear, Enter. Commands work on lights, pixels and groups.
- **Every other light/pixel:** "Odd", "Even" and "Every Nth" buttons in the selection bar and on the keypad (for example `1 THRU 20 ODD`). They work on fixtures, and on pixels when a pixel light is expanded.

## 2. Pixel lights: expand and collapse
- A collapsed pixel light acts as one light: everything you change applies to all its pixels.
- Expanding it shows each pixel as its own tile you can select and adjust.
- Collapsing it again keeps each pixel's own values. Changes made while collapsed apply on top of those values.
- **REC with pixels:** recording works the same whether the light is collapsed or expanded. Each pixel's state is saved.

## 3. REC → TIMELINE → preset
- A "Send to Timeline" button on every REC step list adds it as a clip.
- A saved timeline can be used as a **Timeline preset**: on a fader or button, with loop on/off, its own intensity, speed and Play/Stop. It runs separately from the main timeline.
- **Record into timeline:** while playing, you can record a section of the timeline (or a selected range) into a new standalone effect. You can then edit, rename and reuse that effect.

## 4. TIMELINE usability
- When several clips are selected, dragging inside the lanes moves only the clips. The timeline view itself is moved only with the minimap, so clips never slide by accident.
- While the timeline is playing, you can still control lights by hand. Manual changes override the timeline for those lights until you press Release.

## 5. Fixture controls
- Position, Beam and Fan/Spread sections are hidden when none of the selected lights support them.
- **Lower intensity minimum:** intensity can be set in steps of 0.01% (for example 0.05%). The fine number field accepts two decimals, and 16-bit lights use the fine channel.
- **Green/Magenta:** quick buttons for Full, 1/2, 1/4, 1/8 and 1/16 in both the green and magenta directions.
- **Kelvin mismatch:** first compare what the console shows with the DMX value each light's profile gives across 2000–10000 K. Then fix the encoding (range limits, linear vs. stepped scales, 8/16-bit) so the shown Kelvin matches the light. Add tests for a few known lights.

## 6. PATCH
- **Easier row selection:** tap anywhere on a row to select it; Shift selects a range, Ctrl/Cmd adds or removes rows. Checkboxes stay.
- **Rename in bulk:** with several lights selected, rename them with a pattern, for example "Key {n}" giving Key 1, Key 2…, or a name list. Start number and step are adjustable.
- **Move preview:** while dragging or moving lights, the target rows and DMX map cells are highlighted before you drop. Clashes show in red.

## 7. Bug: pixel effects sometimes disappear
- First, reproduce it by switching Pages, scenes, reloading, adding and removing lights, and opening and closing PIXEL. Check how effects are saved and loaded (normalizeLayer, per-Page storage, the cloud merge).
- Then fix the cause and add a test that an effect survives save → load → page switch.

## 8. Multi-language
- Language picker in Settings: English and Lithuanian to start. More languages can be added later.
- Move all on-screen text into translation files. The chosen language is remembered on the device and in the user's account.

## Technical notes
- Pure helpers (selection patterns, rename patterns, Kelvin encoding, timeline-preset playback) go into src/lib with vitest tests.
- Timeline presets live under an optional Project field so older saves keep working. Preset output is applied output-only, like faders (applyBank).
- The manual override during playback is stored as a per-fixture "programmer" layer above timeline output.
- Pixel-expand state stays in the UI. Per-pixel values are stored in the existing per-pixel fixture data.
- i18n is a lightweight dictionary plus a `t()` hook, with no heavy library. Strings are migrated screen by screen.
- Suggested order: bugs (7, Kelvin) → controls (5) → PATCH (6) → selection/keypad (1) → pixels (2) → timeline (3, 4) → language (8).
