# KROMA – didelis atnaujinimas (patch, grupės, efektai, plot, kamera)

Tavo žinutė nutrūko ties „dary…“. Jei norėjai dar kažką pridėti, parašyk prieš patvirtindamas planą.

## 1. Skaičių laukai
- Visus skaičių laukus galima visiškai ištrinti (tuščias laukas). Reikšmė pritaikoma tik išėjus iš lauko arba paspaudus Enter. Tuščias laukas grįžta į ankstesnę reikšmę.

## 2. Patch
- Paieškoje lieka tik „Search brand, model“. Užuomina apie Arclight/Cinevera dingsta.
- Režimo pasirinkime atsiranda paieška.
- Mėgstamiausi „lempa + režimas“: žvaigždute išsaugai porą, o ji rodoma sąrašo viršuje.
- Adreso tinklelis: paspaudus langelį, tas adresas tampa pradiniu.
- Kai patchini daug lempų ir jos netelpa į universą, pirmiausia programa paklausia: „Perkelti likusias į kitą universą?“ Jei sutinki, lempa, kuri nebetilptų, pradedama naujame universe nuo 1 adreso, o likę kanalai paliekami tušti. Jei atsisakai, nieko nepatchinama.
- Po patch kiekvienai lempai sąraše galima keisti pavadinimą, režimą, universą ir adresą. Taip pat yra „DMX map“ mygtukas, kuris parodo tos lempos kanalus.
- Unpatch sąraše bus mygtukai „Select all“ ir „Deselect all“.

## 3. Grupės šoninėje juostoje
- Dešinėje šoninėje juostoje, šalia dabartinių elementų (dar dešiniau, už jų), rodomos grupės.
- Valdymo lange paspaudus grupę, visos jos lempos pažymimos, o paspaudus dar kartą – atžymimos. Taip vienu ypu keiti visų pažymėtų lempų parametrus.

## 4. Efektai ir pixel – tik pažymėtoms lempoms
- Efektai ir pixel efektai programuojami ir paleidžiami tik konsolėje pažymėtoms lempoms.
- Paruoštus efektus galima išsaugoti ir perjungti iš vieno į kitą. Tai veikia ir pixel, ir paprastiems efektams.
- Paprastiems efektams atsiras peržiūra prieš paleidžiant, kaip pixel mappinge: efektą susikuri, jis rodomas peržiūroje ir tik tada spaudi „Play“.
- Pataisysiu parabolės / kreivės rėmelį: tempiant taškus efektas iš tikrųjų pasikeis.

## 5. Pixel map
- Lempų aukštis – iki 50 m.
- Tinklelis bus begalinis: jį galima stumdyti ir keisti mastelį, kraštų nėra.

## 6. Live Plot objektai
- Nauji objektai: automobilis su langais (šviesa praeina pro langus) ir medis.

## 7. Kamera Live Plot'e
- Kamerą galima pridėti ir pastatyti plane, nustatyti jos kryptį ir aukštį.
- Nustatymai: objektyvas (mm), diafragma (f/), ISO ir sensorius (Super35 / Full Frame).
- „Camera view“ langas parodo 3D vaizdą iš kameros. Ekspozicija skaičiuojama iš šviesos stiprumo, diafragmos ir ISO, todėl vaizdas šviesėja arba tamsėja kaip tikroje kameroje.

## Techninės detalės
- Bendras skaičių įvesties laukas pakeis dabartinius skaičių laukus.
- Patch perkėlimo logika bus atskira funkcija su testais.
- Mėgstamos lempos ir režimo poros bus saugomos favorites skiltyje ir sinchronizuosis su paskyra.
- Pažymėtų lempų sąrašas taps bendru filtru efektams ir pixel sluoksniams.
- Kamera bus išsaugota kaip nebūtinas plano laukas, kad seni projektai ir toliau atsidarytų.
- Darbas didelis, todėl jį atliksiu etapais. Po kiekvieno etapo patikrinsiu, ar programa veikia.
