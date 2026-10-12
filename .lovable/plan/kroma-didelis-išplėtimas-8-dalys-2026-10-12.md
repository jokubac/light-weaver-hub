# KROMA: didelis išplėtimas (8 dalys)

Darbas didelis, todėl darysiu etapais. Po kiekvieno etapo galėsi išbandyti planšetėje.

## 1 etapas: gyvam darbui (svarbiausia aikštelėje)
1. **Playback / Fader bankas.** Nauja juosta apačioje su 6 virtualiais faderiais. Kiekvienam faderiui priskiri grupę, look'ą ar lempas (pvz. Key, Fill, Practical, Police). Faderis valdo tų lempų ryškumą arba įjungia look'ą. Matosi visada, nereikia perjunginėti langų. Turi Flash ir Solo mygtukus.
2. **Cue Stack (kino formatu).** Cue sąrašas: Cue 1 Setup → Cue 2 → Cue 3. Kiekvienas cue turi numerį, pavadinimą, pastabą („įeina aktorius“) ir fade laiką. Didelis **GO** mygtukas ir mygtukas Back. Galima įterpti cue 2.5. Naudoja tą patį išsaugojimą kaip looks.
3. **MIDI / Stream Deck.** Bank faderiai, GO, Back ir Blackout atsiranda MIDI LEARN sąraše. Pridedamas paruoštas Korg nanoKONTROL2 išdėstymas. Stream Deck / Loupedeck veikia, kai siunčia MIDI arba klaviatūros mygtukus (GO = tarpas).

## 2 etapas: gafferio dokumentai
4. **Call Sheet / Rental Order PDF** Patch puslapyje:
   - elektros apkrova kW ir A, lempos paskirstomos į 3 fazes, rodomas fazių balansas ir siūlomas generatorius (230 V / 400 V);
   - įrangos sąrašas pagal nuomos namus: lempos, kiekvienai lempai kabeliai, stovai, difuzija (redaguojami kiekiai);
   - baterijų krovimo planas pamainai (pagal esamą baterijų skaičiuoklę).
   Mygtukas „Print / PDF“.

## 3 etapas: Live Plot šviesos matuoklis
5. **Lux / T-Stop prognozė.** Lempoms pridedama fotometrija (lux 3 m atstumu; populiarioms lempoms užpildysiu pagal gamintojų duomenis, kitoms galėsi įvesti pats). Plote padedi „aktoriaus“ tašką (arba naudoji žmogaus objektą) ir matai lux bei footcandles. Pagal pasirinktos kameros ISO, kadrų greitį ir užraktą parodomas reikalingas T-stop. Skaičiuojama su atstumu, spindulio kampu, ryškumu ir sienų užstojimu.

## 4 etapas: lempų profiliai
6. **GDTF importas.** Įkeli .gdtf failą (iš GDTF Share ar gamintojo). KROMA perskaito DMX režimus ir kanalus ir sukuria naują lempą bibliotekoje. Ji išsaugoma įrenginyje ir sinchronizuojasi su paskyra. Dar bus paprastas „Fixture Builder“ kanalams surašyti ranka.
7. **RDM nuskaitymas** per tiltą: Art-Net RDM aptinka lempas (gamintoją, modelį, režimą, adresą) ir leidžia jas pridėti į patch. Veikia tik su siųstuvais, kurie palaiko RDM per Art-Net (LumenRadio, DMXking ir kt.).

## 5 etapas: be tilto
8. **Tiesioginis Art-Net / sACN iš programėlės.** Įdiegtoje Android APK ir iOS IPA programėlėje DMX siunčiamas tiesiai iš planšetės į siųstuvą per Wi-Fi/Ethernet, be kompiuterio. Naršyklėje / PWA tiltas vis dar reikalingas (to apeiti neįmanoma). CONNECT lange atsiranda pasirinkimas „Tiesiogiai (programėlė)“ / „Per tiltą“. Po šio etapo reikės iš naujo sukompiliuoti APK/IPA.

## Ko nedarysiu (ir kodėl)
- **LumenRadio CRMX Toolbox / RatPac signalo stiprumas ir baterija:** šie gamintojai neturi viešos sąsajos kitoms programoms. Vietoj to parodysiu tai, ką siųstuvas pats praneša per Art-Net (pavadinimą, būseną, prievadų skaičių) ir, jei yra RDM, prijungtų lempų skaičių.

## Technical details
- Bank/Cue: new `src/lib/playback.ts` + `src/lib/cues.ts`, project fields `Project.bank?`, `Project.cues?` (optional for backward compatibility), applied in the output merge as an HTP/scale layer over live state; cues reuse LookState snapshots and recordings blending.
- MIDI targets extended in midi.ts; nanoKONTROL2 preset CC map.
- Call sheet: `src/lib/callsheet.ts` (phase balancing greedy by watts, generator sizing with 80 % headroom), accessory rules per fixture class; printable view in PatchPage.
- Photometry: optional `lux3m` on fixture definitions + user override; inverse-square + cos falloff + beam-angle edge; T-stop = sqrt(lux · ISO · t / C), C≈250, shutter from fps/180°.
- GDTF: zip parsed with `fflate` in browser, description.xml → DMXModes/channels mapped to existing channel tokens; custom fixtures stored in console_user_data.
- RDM: bridge gains ArtTodRequest/ArtRdm (GET /rdm); native path later.
- Native UDP: Capacitor UDP plugin; `output.ts` gets a transport abstraction (bridge HTTP vs native socket) so packet building moves into a shared TS module used by both bridge and app.
