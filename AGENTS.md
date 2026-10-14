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
- Pixel/fixture speed uses shared logarithmic helpers and numeric fine adjustment for consistent ranges.
- Manufacturer mode identifiers must be verified against model-specific DMX charts; append new profiles rather than reorder saved mode indices.
- Astera profiles live in src/lib/astera.ts as a numbered table with per-pixel token layouts; output.ts writes channels from those tokens so every profile is exact.
- Rental-house stock (src/lib/rental-fixtures.ts) is appended to FIXTURE_LIBRARY and deduped by id; existing entries are tagged via aliases so patch search can filter by house.
- localStorage stays the working copy; when signed in, src/lib/cloud.ts merges cloud data once per sign-in and pushes changes (projects → console_projects rows, favourites + saved effects → console_user_data).
- The live plot is stored per scene (Scene.plot) in metres; floor-plan images are downscaled JPEG data URLs to keep project data small.
- Set-object presets and rotated footprint hit testing live in a browser-safe plot-objects module; objects and per-wall heights are optional scene fields so saved plots remain compatible.
- Fixture settings transfer uses an explicit whitelist in fixture-settings.ts, excluding identity, patch, grouping, position and power to prevent accidental repatching.
- Complete named setups are immutable Scene snapshots under Project.setups; restore replaces scene content but preserves scene identity so walls, fixture angles and all effects travel together.
- Multi-fixture patch layout lives in src/lib/patch-plan.ts; universe overflow is only applied after the user confirms.
- Stage size remains a legacy framing/image reference, never a placement boundary; beam textures cover bounded fixture-local extents to keep unrestricted plots affordable.
- Connection health measures bridge HTTP responsiveness with a slow threshold and timeout, not wireless fixture reception.
- Console swaps and Patch drag insertion move whole fixtures without changing identity or settings. Patch displays canonical positions as read-only numbers; drag insertion changes keypad/PDF positions.
- REC steps reuse LookState snapshots (Project.recordings); src/lib/recordings.ts blends them by fade/hold timing.
- Playback bank and cues live in Project.bank/Project.cues; applyBank (src/lib/playback.ts) changes output only, never live fixture state, so faders can't overwrite programming.
- Imported fixtures (GDTF/builder/RDM) are stored in localStorage custom-fixtures and use FixtureMode.channelMap, so new lights need no code changes.
- Installed apps crawl the published site into offline-app and reject release mismatches; public/app-release.json is the shared UI/native version source. iOS icon catalogs are rendered from the brand SVG by scripts/ios-icons.mjs so stale PNGs cannot ship.
- Fixture FLASH and fader banks are output-only overlays in outFixtures, never mutating live fixture state; keypad numbers are console positions.
- console-command.ts applies per-fixture relative command values and inverse FLASH envelopes; keeping these pure makes normalized CCT and restored output testable.
- EffectsRail owns fixture/pixel effect saving and recall; ConsoleScreen shares the active pixel-layer ID with PixelPanel so the rail saves the layer being edited.
- Keep NoxLogo.tsx and public/nox-logo.svg identical; rasterise the SVG for favicon/app icons so all NOX marks match.

- Plot edits share a browser-session unlock gate in plot-edit-session.ts; camera lens rendering and plotted view edges share the Z-up camera basis and tested projection helpers.


- Fixture setting history uses the transfer whitelist and groups pointer gestures; playback/battery updates bypass history so Undo never repatches fixtures or records output frames.
- Read src/components/console/AGENTS.md for console UI and output-integration rules before changes.
- Windows app (electron/) loads the crawled offline bundle via app:// and exposes window.noxDesktop for UDP; native-udp.ts prefers it so DMX code stays shared across web, Capacitor and desktop.
- iPad MIDI uses NOX's own CoreMIDI plugin in ios-native/, installed into the generated iOS project by ios-native/install.rb in CI; iOS builds need Xcode 16+ (macos-15) because Capacitor 8 plugins fail on older Swift.
- offline-bundle.mjs strips the hosting "Edit with Lovable" badge so installed apps stay standalone.
- Pixel map uses pixel-preview with the shared live frame and all active fixture IDs so REC overlap stays visible without changing output.
- Built-in GDTF library is generated offline (scripts/gdtf-library.ts) into public/gdtf-library, fetched only on search, and copied into custom fixtures on pick so patches stay offline-safe.
