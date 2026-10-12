<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Web DMX output POSTs universes to the local Node bridge (public/crmx-bridge.mjs) because browsers cannot send UDP; the installed app can send directly via src/lib/artnet.ts and a Capacitor UDP plugin.
- Transmitter profiles (src/lib/transmitters.ts) drive optional universe/colour-order remapping in output.ts; the bridge stays protocol-only so mapping logic lives in one place.
- Battery runtime is estimated client-side (src/lib/power.ts) by integrating watts × intensity; no hardware readout exists for V-mount/Instagrid.
- Pixel and fixture speed inputs share logarithmic conversion helpers and a numeric/fine-adjustment control so their usable ranges remain consistent.
- Manufacturer mode identifiers must be verified against model-specific DMX charts; append new profiles rather than reorder saved mode indices.
- Astera profiles live in src/lib/astera.ts as a numbered table with per-pixel token layouts; output.ts writes channels from those tokens so every profile is exact.
- Rental-house stock (src/lib/rental-fixtures.ts) is appended to FIXTURE_LIBRARY and deduped by id; existing entries are tagged via aliases so patch search can filter by house.
- localStorage stays the working copy; when signed in, src/lib/cloud.ts merges cloud data once per sign-in and pushes changes (projects → console_projects rows, favourites + saved effects → console_user_data).
- The live plot is stored per scene (Scene.plot) in metres; floor-plan images are downscaled JPEG data URLs to keep project data small.
- Set-object presets and rotated footprint hit testing live in a browser-safe plot-objects module; objects and per-wall heights are optional scene fields so saved plots remain compatible.
- Fixture settings transfer uses an explicit whitelist in fixture-settings.ts, excluding identity, patch, grouping, position and power to prevent accidental repatching.
- Complete named setups are immutable Scene snapshots under Project.setups; restore replaces scene content but preserves scene identity so walls, fixture angles and all effects travel together.
- Number inputs use the shared NumberField (commit on blur/Enter) so fields can be cleared while typing without snapping to a value.
- Multi-fixture patch layout lives in src/lib/patch-plan.ts; universe overflow is only applied after the user confirms.
- Stage size remains a legacy framing/image reference, never a placement boundary; beam textures cover bounded fixture-local extents to keep unrestricted plots affordable.
- Connection health measures bridge HTTP responsiveness with a slow threshold and timeout, not wireless fixture reception.
- Console swaps and Patch number edits reorder whole fixture entries, never identity, DMX patch, settings or pixel layers.
- REC steps reuse LookState snapshots (Project.recordings); src/lib/recordings.ts blends them by fade/hold timing.
- Patch page is a console overlay, not a route, so it edits live fixture state.
- Playback bank and cues live in Project.bank/Project.cues; applyBank (src/lib/playback.ts) changes output only, never live fixture state, so faders can't overwrite programming.
- Imported fixtures (GDTF/builder/RDM) are stored in localStorage custom-fixtures and use FixtureMode.channelMap, so new lights need no code changes.
- Direct DMX from the installed app uses src/lib/artnet.ts packets via a Capacitor UDP plugin; the browser keeps the bridge because web pages cannot send UDP.- Installed Android/iOS apps bundle a crawl of the published site (scripts/offline-bundle.mjs → offline-app/) instead of loading a remote URL, so they open offline; rebuild APK/IPA after publishing to update them.
- Fixture FLASH and fader banks are output-only overlays in outFixtures, never mutating live fixture state; keypad numbers are console positions.
- console-command.ts applies per-fixture relative command values and inverse FLASH envelopes; keeping these pure makes normalized CCT and restored output testable.
- EffectsRail owns fixture/pixel effect saving and recall; ConsoleScreen shares the active pixel-layer ID with PixelPanel so the rail saves the layer being edited.
- Pixel preview framing stays local to PixelPanel and derives from the logical grid and measured viewport, keeping display changes independent of saved effects and output.
- The NOX brand mark has one source: src/components/NoxLogo.tsx draws it on screen and public/nox-logo.svg is rasterised into favicon/app icons with rsvg-convert; edit both together so the console header and the installed app icon stay identical.

- Plot geometry edits share a browser-session unlock gate in plot-edit-session.ts, keeping approval across plot mounts without storing it in scene data.
- Camera lens rendering and plotted view edges share the Z-up camera basis and tested screen projection helpers so camera tilt and orientation stay consistent.
