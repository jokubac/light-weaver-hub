// Arclight.lt rental catalogue (lighting + generators, distribution, cables, dimmers, batteries, DMX),
// scraped from arclight.lt/en/equipment-for-rent categories 36 and 5. Names as listed by the rental house.
export type ArclightCategory = "battery" | "cable" | "data" | "distro" | "fixture" | "power";
export interface ArclightItem { category: ArclightCategory; section: string; name: string }

const RAW: [ArclightCategory, string, string][] = [
[
"fixture",
"HMI",
"12x20'/3.6x6.0m Silk 1/4"
],
[
"fixture",
"HMI",
"20x20'/6.0x6.0m Silk Full"
],
[
"fixture",
"HMI",
"pipes al. d48  3mm 1,0m"
],
[
"fixture",
"HMI",
"12x12'/3.6x3.6m White"
],
[
"fixture",
"Tungsten",
"Arri 150"
],
[
"fixture",
"Tungsten",
"Arri 300"
],
[
"fixture",
"Tungsten",
"Arri 650"
],
[
"fixture",
"Tungsten",
"Arri 1000"
],
[
"fixture",
"Tungsten",
"Arri 2000"
],
[
"fixture",
"Tungsten",
"Arri 5000"
],
[
"fixture",
"Tungsten",
"Arri T12 10/12kW"
],
[
"fixture",
"Tungsten",
"Arri T24 20/24kW"
],
[
"fixture",
"Tungsten",
"Dedolight 4x100W"
],
[
"fixture",
"Tungsten",
"Dedolight 3x150W"
],
[
"fixture",
"Tungsten",
"Desisti 300/500"
],
[
"fixture",
"Tungsten",
"Desisti 1000"
],
[
"fixture",
"Tungsten",
"Desisti 2000"
],
[
"fixture",
"Tungsten",
"Dino 12kW"
],
[
"fixture",
"Tungsten",
"PAR 64"
],
[
"fixture",
"Tungsten",
"PAR 64 Short"
],
[
"fixture",
"Tungsten",
"Red Head 800W"
],
[
"fixture",
"Tungsten",
"Blondes 2000W"
],
[
"fixture",
"Tungsten",
"ArriLite 750"
],
[
"fixture",
"Tungsten",
"Desisti Giotto 1000W"
],
[
"fixture",
"Tungsten",
"Dedoflex Octodome 1000"
],
[
"fixture",
"Tungsten",
"Rifa55 500W"
],
[
"fixture",
"Tungsten",
"Rifa66 650W"
],
[
"fixture",
"Tungsten",
"Rifa88 1000W"
],
[
"fixture",
"Tungsten",
"Jem Lighting  19'' 500W"
],
[
"fixture",
"Tungsten",
"Jem Lighting  22'' 1000W"
],
[
"fixture",
"Tungsten",
"Jem Lighting  30'' 2000W"
],
[
"fixture",
"Tungsten",
"Jemball 2kW"
],
[
"fixture",
"Tungsten",
"Jemball 4kW"
],
[
"fixture",
"Tungsten",
"Jemball 6kW"
],
[
"fixture",
"Tungsten",
"Jemball 8kW"
],
[
"fixture",
"Tungsten",
"Space light6x1000W"
],
[
"fixture",
"Tungsten",
"China Ball 12\" E27 Bracket"
],
[
"fixture",
"Tungsten",
"CHINA BALL 18\" E27 BRACKET"
],
[
"fixture",
"Tungsten",
"Speedring - Mogul Socket E40/E27"
],
[
"fixture",
"Tungsten",
"Source four 575 baby"
],
[
"fixture",
"Tungsten",
"Source Four 750W ZOMM 25-50"
],
[
"fixture",
"Tungsten",
"Pacific 1000W"
],
[
"fixture",
"Tungsten",
"PAGANINI SET"
],
[
"fixture",
"Tungsten",
"HIGHT Stand Extension"
],
[
"fixture",
"Tungsten",
"Junior Plate"
],
[
"fixture",
"Tungsten",
"Desisti 2500"
],
[
"fixture",
"Fluorescent",
"Kino Flo 8x120cm"
],
[
"fixture",
"Fluorescent",
"Kino Flo 4x120cm"
],
[
"fixture",
"Fluorescent",
"Kino Flo 2x120cm"
],
[
"fixture",
"Fluorescent",
"Kino Flo 1x120cm"
],
[
"fixture",
"Fluorescent",
"Kino flo 4x60cm"
],
[
"fixture",
"Fluorescent",
"Kino flo 2x60cm"
],
[
"fixture",
"Fluorescent",
"Kino flo 1x60cm"
],
[
"fixture",
"Fluorescent",
"Kino Flo 1x240cm"
],
[
"fixture",
"Fluorescent",
"Mini flo"
],
[
"fixture",
"Fluorescent",
"Micro Flo"
],
[
"fixture",
"Fluorescent",
"Lithlight C-880"
],
[
"fixture",
"Fluorescent",
"Coupler With Spigot"
],
[
"fixture",
"Fluorescent",
"schuko Spliter"
],
[
"fixture",
"Fluorescent",
"Flags 0,6x1,2m"
],
[
"fixture",
"Fluorescent",
"LEE Filter Soft Gold Reflector"
],
[
"fixture",
"Led",
"ARRI Obiter"
],
[
"fixture",
"Led",
"Sky Panel X"
],
[
"fixture",
"Led",
"ARRI Obiter Docking Ring"
],
[
"fixture",
"Led",
"Sky Panel S-30"
],
[
"fixture",
"Led",
"Sky Panel S-60"
],
[
"fixture",
"Led",
"Sky Panel S-60 Rain Cover"
],
[
"fixture",
"Led",
"Sky Panel S-120"
],
[
"fixture",
"Led",
"Sky Panel S-360"
],
[
"fixture",
"Led",
"Sky Panel Remote"
],
[
"fixture",
"Led",
"NANLUX Dyno 1200"
],
[
"fixture",
"Led",
"Lupo RGB W"
],
[
"fixture",
"Led",
"Cream source Micro"
],
[
"fixture",
"Led",
"Cream source Vortex4"
],
[
"fixture",
"Led",
"Cream source Vortex8"
],
[
"fixture",
"Led",
"SUMO MAX"
],
[
"fixture",
"Led",
"LIGHSTAR LUXED P12 RGBW 1920W"
],
[
"fixture",
"Led",
"Velvet 1 Bi-color"
],
[
"fixture",
"Led",
"Kino Flo select 30 RGBW"
],
[
"fixture",
"Led",
"Kino Flo FreeStyle 41"
],
[
"fixture",
"Led",
"kino flo Celeb 200"
],
[
"fixture",
"Led",
"kino flo Celeb 400"
],
[
"fixture",
"Led",
"DMG Lumiere SL1"
],
[
"fixture",
"Led",
"DMG Lumiere Mini"
],
[
"fixture",
"Led",
"LiteMat 1 Plius"
],
[
"fixture",
"Led",
"LiteMat 2L Pius"
],
[
"fixture",
"Led",
"LiteMat 4 Pius"
],
[
"fixture",
"Led",
"LiteMat Spectrum 4"
],
[
"fixture",
"Led",
"Exalux 2x4 Punch"
],
[
"fixture",
"Led",
"NANLITE PavoSlim 60C"
],
[
"fixture",
"Led",
"NANLITE PavoSlim 120C"
],
[
"fixture",
"Led",
"NANLITE PavoSlim 240CL"
],
[
"fixture",
"Led",
"LS RGBW 150"
],
[
"fixture",
"Led",
"Fomex Flex 1''x1'' Bi-color"
],
[
"fixture",
"Led",
"Fomex Flex 2''x1'' Bi-color"
],
[
"fixture",
"Led",
"Fomex  RollLite RL33 Bi-color"
],
[
"fixture",
"Led",
"APUTURE Amaran F21C 2x1"
],
[
"fixture",
"Led",
"APUTURE Amaran F22C 2x2"
],
[
"fixture",
"Led",
"GODOX KNOWLED AM1600R"
],
[
"fixture",
"Led",
"Flex Led AIRLIGHT 40w Bi-Color"
],
[
"fixture",
"Led",
"Flex led AIRLIGHT 80W Bi-Color"
],
[
"fixture",
"Led",
"ikan CANVAS ROUND BI-COLOR"
],
[
"fixture",
"Led",
"CINEFlex Led 40 x 60 Bi-Color"
],
[
"fixture",
"Led",
"CINEFlex Led 20 X 120 Bi-color"
],
[
"fixture",
"Led",
"Alladdin A-Lite Bi-color"
],
[
"fixture",
"Led",
"Aputure Amaran Bi-color"
],
[
"fixture",
"Led",
"Rosco DMG Dash Pocket LED CRMX 4pcs."
],
[
"fixture",
"Led",
"Pockelite f7 RGBW"
],
[
"fixture",
"Led",
"Aputure MC RGBWW 4pcs set"
],
[
"fixture",
"Led",
"Aputure MC PRO RGBWW CRMX 8pcs set"
],
[
"fixture",
"Led",
"Litra led Cube"
],
[
"fixture",
"Led",
"Dedolight 4.1 3x40 Bicolor"
],
[
"fixture",
"Led",
"quasar science bi color led tube  2''"
],
[
"fixture",
"Led",
"quasar science bi color led tube  4''"
],
[
"fixture",
"Led",
"APUTURE LS 60X"
],
[
"fixture",
"Led",
"NANLITE PAVOTUBE 30C 2KIT  220V"
],
[
"fixture",
"Led",
"NANLITE PAVOTUBE 30C 2KIT With Battery"
],
[
"fixture",
"Led",
"NANLITE PAVOTUBE II 6C  With Battery"
],
[
"fixture",
"Led",
"NANLITE PAVOTUBE 1 Light Bracket"
],
[
"fixture",
"Led",
"NANLITE PAVOTUBE 4 Light Bracket"
],
[
"fixture",
"Led",
"Nanlite CN-W2 Wi-Fi Adapter"
],
[
"fixture",
"Led",
"Astera Hyperion tube kit"
],
[
"fixture",
"Led",
"Astera titan tube kit"
],
[
"fixture",
"Led",
"astera helios tube kit"
],
[
"fixture",
"Led",
"ASTERA AX3 8PCS. KIT"
],
[
"fixture",
"Led",
"ASTERA AX9 8PCS. KIT"
],
[
"fixture",
"Led",
"Astera NYX 8pcs set"
],
[
"fixture",
"Led",
"Astera charger"
],
[
"fixture",
"Led",
"Astera Extension Cable 15m"
],
[
"fixture",
"Led",
"FILLEX. G3 COLOR"
],
[
"fixture",
"Led",
"FILLEX. G6 COLOR"
],
[
"fixture",
"Led",
"NanLite Forza 60 LED 5600K"
],
[
"fixture",
"Led",
"NanLite Forza 60B LED 2700-6500K"
],
[
"fixture",
"Led",
"NanLite Forza 60C LED"
],
[
"fixture",
"Led",
"Forza 60 LED projection attachment"
],
[
"fixture",
"Led",
"NanLite Forza 300 LED 5600K"
],
[
"fixture",
"Led",
"NanLite Forza 300 LED 2700-6500K"
],
[
"fixture",
"Led",
"Forza 300 projection attachment  19"
],
[
"fixture",
"Led",
"Forza 300 projection attachment  36"
],
[
"fixture",
"Led",
"NANLUX Evoke 150 C"
],
[
"fixture",
"Led",
"NANLUX Evoke 1200"
],
[
"fixture",
"Led",
"NANLUX Evoke 1200B"
],
[
"fixture",
"Led",
"NANLUX Evoke 600 C"
],
[
"fixture",
"Led",
"NANLUX Evoke 900 C"
],
[
"fixture",
"Led",
"NANLUX Evoke 2400B"
],
[
"fixture",
"Led",
"NANLUX Evoke 5000B"
],
[
"fixture",
"Led",
"NANLUX FL-35E MOTORIZED FRESNEL LENS 15Â°-46Â° FOR EVOKE 2400B"
],
[
"fixture",
"Led",
"NANLUX FL-45E MOTORIZED FRESNEL LENS 16Â°-50Â° FOR EVOKE 5000B"
],
[
"fixture",
"Led",
"NANLUX NL70 6Â° PARALLEL BEAM REFLECTOR"
],
[
"fixture",
"Led",
"NANLUX NL MOUNT PROJECTION ATTACHMENT 15-30Â°"
],
[
"fixture",
"Led",
"CBL1 Bi COLOR"
],
[
"fixture",
"Led",
"RING LIGHT HALO18"
],
[
"fixture",
"Led",
"LiteGear LiteRibbon Kit"
],
[
"fixture",
"Led",
"LED DMX 512 Decodder12-24V  4x4A"
],
[
"fixture",
"Led",
"LiteStix Pro, Hybrid 4PCS. 15CM, 30CM, 60CM, 90CM"
],
[
"fixture",
"Led",
"Aputure Accent B7c 8-Light Kit"
],
[
"fixture",
"Led",
"PHILIPS HUE 5 PCS KIT"
],
[
"fixture",
"Led",
"LIGHSTAR AIRLITE 1000W  bicolor 2800-6500k"
],
[
"fixture",
"Led",
"Arcball 100w 30' bicolor 2300-6000k"
],
[
"fixture",
"Led",
"Arcball 50w 19' bicolor 2300-6000k"
],
[
"fixture",
"Led",
"ANNSO LEDPAD PRO GAFFER 5PCS KIT 5600"
],
[
"fixture",
"Led",
"CHINA BALL 18\" E27 BRACKET"
],
[
"fixture",
"Led",
"parabolic soft box Nanlite of Forza 60"
],
[
"fixture",
"Led",
"12x20'/3.6x6.0m Silk 1/4"
],
[
"fixture",
"Led",
"Kupo super viser clamp"
],
[
"distro",
"Power distribution boxes",
"Power Distributor 80kW 125A"
],
[
"distro",
"Power distribution boxes",
"Power Distribution Box  40kW 63A"
],
[
"distro",
"Power distribution boxes",
"Power Distribution Box  20kW 34A"
],
[
"distro",
"Power distribution boxes",
"Power Distribution Box  12kW 63A"
],
[
"distro",
"Power distribution boxes",
"Power Distribution Box  6kW 32A"
],
[
"distro",
"Power distribution boxes",
"Chimera s quartz"
],
[
"distro",
"Power distribution boxes",
"Flags 0,6x0,9m"
],
[
"distro",
"Power distribution boxes",
"20x20'/6.0x6.0m Silk 1/4"
],
[
"distro",
"Power distribution boxes",
"APUTURE Amaran F22C 2x2"
],
[
"cable",
"Cables",
"Cable 32A 400v 5m"
],
[
"cable",
"Cables",
"Cable 32A 400v 10m"
],
[
"cable",
"Cables",
"Cable 32A 400v 20m"
],
[
"cable",
"Cables",
"Cable 32A 400v 40m"
],
[
"cable",
"Cables",
"Cable 63A 400v 5m"
],
[
"cable",
"Cables",
"Cable 63A 400v10m"
],
[
"cable",
"Cables",
"Cable 63A 400v 20m"
],
[
"cable",
"Cables",
"Cable 125A 400v 10m"
],
[
"cable",
"Cables",
"Cable 125A 400v 20m"
],
[
"cable",
"Cables",
"extension  schuko  10-20m"
],
[
"cable",
"Cables",
"schuko Spliter"
],
[
"cable",
"Cables",
"schuko drum 50m"
],
[
"cable",
"Cables",
"schuko drum 25m"
],
[
"cable",
"Cables",
"Cable extension 32A 240v 10-20m"
],
[
"cable",
"Cables",
"Cable extension 63A 240v 10-20m"
],
[
"cable",
"Cables",
"Cable Extension 125A 240v 10-20m"
],
[
"cable",
"Cables",
"rocket 63a 400v to 2x32a 400v"
],
[
"cable",
"Cables",
"rocket 125a 400v to 4x32a 400v"
],
[
"cable",
"Cables",
"rocket 125A 400v to 2x 63a 400v"
],
[
"cable",
"Cables",
"rocket 32A 240v to 2x schuko"
],
[
"cable",
"Cables",
"rocket 63a 240v to 2x32a 240v"
],
[
"cable",
"Cables",
"spliter 32A 400v Ä¯ 3x32a 240v"
],
[
"cable",
"Cables",
"Adapter 16A 400v to 32a 400v"
],
[
"cable",
"Cables",
"Adapter 32A 400v to 63a 400v"
],
[
"cable",
"Cables",
"Adapter 63A 400v to 32a 400v"
],
[
"cable",
"Cables",
"Adapter 63A 400v to 125a 400v"
],
[
"cable",
"Cables",
"Adapter 125A 400v to 63a 400v"
],
[
"cable",
"Cables",
"Adapter 25A 400v to 32a 400v"
],
[
"cable",
"Cables",
"Adabter 16a 240v to schuko"
],
[
"cable",
"Cables",
"Adabter schuko to 32a 240v"
],
[
"cable",
"Cables",
"Adabter 125a 240 to 63a 240v"
],
[
"cable",
"Cables",
"Cable Protector"
],
[
"cable",
"Cables",
"C stand 40''"
],
[
"cable",
"Cables",
"LIGHTSOCK  20 â DOOPLO ASTERA  TITAN"
],
[
"power",
"Dimmers",
"Dimmer 1kW"
],
[
"power",
"Dimmers",
"Dimmer 2kW"
],
[
"power",
"Dimmers",
"Dimmer 2kW DMX"
],
[
"power",
"Dimmers",
"Dimmer 3kW DMX CRMX"
],
[
"power",
"Dimmers",
"Dimmer 3kW DMX 4 CH"
],
[
"power",
"Dimmers",
"Dimmer 5kW"
],
[
"power",
"Dimmers",
"Dimmer 6kW DMX CRMX"
],
[
"power",
"Dimmers",
"Dimmer 12kW DMX CRMX"
],
[
"power",
"Dimmers",
"Dimmer 6x2kW OKERO"
],
[
"power",
"Dimmers",
"Dimmer 6x3kW"
],
[
"power",
"Dimmers",
"Dimmer 6x5kW"
],
[
"power",
"Dimmers",
"Dimmer 3x12kW"
],
[
"power",
"Dimmers",
"Dimmer 12x2kW OKERO"
],
[
"power",
"Dimmers",
"Dimmer 36x3kW harting"
],
[
"power",
"Dimmers",
"harting cable with 6xschuko 20-30m"
],
[
"power",
"Dimmers",
"Flicker Box + Dimmer 2kW"
],
[
"power",
"Dimmers",
"LFX flikermaster DMX"
],
[
"power",
"Dimmers",
"6,0x10,0 m black"
],
[
"power",
"Dimmers",
"Fomex Flex 1''x1'' Bi-color"
],
[
"power",
"Dimmers",
"LEE Filter Grid Cloth"
],
[
"power",
"Dimmers",
"rocket 125a 400v to 4x32a 400v"
],
[
"power",
"Generators",
"Honda EU20i"
],
[
"power",
"Generators",
"Honda eu70i"
],
[
"power",
"Generators",
"Kipror 3kW"
],
[
"power",
"Generators",
"Kipor 6kW"
],
[
"power",
"Generators",
"Generator 80kW"
],
[
"power",
"Generators",
"Generator 100kW"
],
[
"power",
"Generators",
"Generator 120kW"
],
[
"power",
"Generators",
"8x8'/2.4x2.4m UltraBounce"
],
[
"power",
"Generators",
"Double Net 0,45x0,6m"
],
[
"power",
"Generators",
"chapman track curvet"
],
[
"power",
"Generators",
"Baby Plate"
],
[
"battery",
"Batteries",
"V-lock Batteries BLUESHAPE 140 GRANITE"
],
[
"battery",
"Batteries",
"Charger CDT-60"
],
[
"battery",
"Batteries",
"V-lock Batteries SWIT 180"
],
[
"battery",
"Batteries",
"Charger Swit S--3822S"
],
[
"battery",
"Batteries",
"VIGOROUS VXL500 Portable Power Station"
],
[
"battery",
"Batteries",
"VIGOROUS VXL3000 Portable Power Station"
],
[
"battery",
"Batteries",
"INSTAGRID ONE MAX Portable Power Station"
],
[
"battery",
"Batteries",
"Porta-Glide"
],
[
"battery",
"Batteries",
"Slider  Ranford baker 2'"
],
[
"battery",
"Batteries",
"Source four 575 baby"
],
[
"battery",
"Batteries",
"Dimmer 3kW DMX CRMX"
],
[
"data",
"DMX",
"DMX Cable 1-10m"
],
[
"data",
"DMX",
"DMX Cable 11-20m"
],
[
"data",
"DMX",
"DMX adapter 3 - 5"
],
[
"data",
"DMX",
"DMX adapter 5 - 3"
],
[
"data",
"DMX",
"DMX board 24 channel"
],
[
"data",
"DMX",
"DMX spliter"
],
[
"data",
"DMX",
"DMX 8-UNIVERSES ART-NET PRO RACK"
],
[
"data",
"DMX",
"SWIT LA-WR8 WIRELESS DMX CONTROLLER KIT"
],
[
"data",
"DMX",
"Miniature Two-Channel CRMX Wireless Dimmer"
],
[
"data",
"DMX",
"RatPac KIT Case (1)AKS+ (3)Cintenna RX-Battery"
],
[
"data",
"DMX",
"Liumenradio Monnlite"
],
[
"data",
"DMX",
"Exalux CONNECT+BASIC"
],
[
"data",
"DMX",
"Exalux CONNECT TX100N"
],
[
"data",
"DMX",
"Exalux CONNECT RX200N"
],
[
"data",
"DMX",
"Exalux CONNECT EXT4"
],
[
"data",
"DMX",
"Luminair/Blackout with ipad"
],
[
"data",
"DMX",
"Enttec Open DMX USB Interface"
],
[
"data",
"DMX",
"Cable extension 32A 240v 10-20m"
],
[
"data",
"DMX",
"AL Frame 0,4x0,6m"
],
[
"data",
"DMX",
"VIGOROUS VXL500 Portable Power Station"
],
[
"data",
"DMX",
"12x20'/3.6x6.0m bleached muslin"
]
];

export const ARCLIGHT_CATALOGUE: ArclightItem[] = RAW.map(([category, section, name]) => ({ category, section, name }));
