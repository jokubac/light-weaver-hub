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
- Real DMX output: the app POSTs universes to a local Node bridge (public/crmx-bridge.mjs) that sends Art-Net/sACN — browsers cannot send UDP.
- Transmitter profiles (src/lib/transmitters.ts) drive optional universe/colour-order remapping in output.ts; the bridge stays protocol-only so mapping logic lives in one place.
- Battery runtime is estimated client-side (src/lib/power.ts) by integrating watts × intensity; no hardware readout exists for V-mount/Instagrid.
- Pixel and fixture speed inputs share logarithmic conversion helpers and a numeric/fine-adjustment control so their usable ranges remain consistent.
- Manufacturer mode identifiers must be verified against model-specific DMX charts; append new profiles rather than reorder saved mode indices.
- Astera profiles live in src/lib/astera.ts as a numbered table with per-pixel token layouts; output.ts writes channels from those tokens so every profile is exact.
- Rental-house stock (src/lib/rental-fixtures.ts) is appended to FIXTURE_LIBRARY and deduped by id; existing entries are tagged via aliases so patch search can filter by house.
- localStorage stays the working copy; when signed in, src/lib/cloud.ts merges cloud data once per sign-in and pushes changes (projects → console_projects rows, favourites + saved effects → console_user_data).
- The live plot is stored per scene (Scene.plot) in metres; floor-plan images are downscaled JPEG data URLs to keep project data small.
- ColourControls is shared by fixture, effect and live-plot controls to keep the CCT/crossfade/HSI ordering consistent; HexColourControls edits step and pixel palette colours.
- Live-plot openings reference stroke/segment indices and use height-aware ray intersections; remap their indices whenever walls are removed so saved openings stay attached.
- Live-plot edit history stores plot and light-control snapshots, grouping pointer gestures as single edits so undo does not step through every drag frame.
