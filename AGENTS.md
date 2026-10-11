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
