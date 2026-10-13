import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pullAndMerge, pushProjects, pushUserData, useUser } from "@/lib/cloud";
import { LogIn, LogOut, Cloud, Map as MapIcon, PanelRightClose, PanelRightOpen, ArrowLeftRight, Keyboard, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupLibrary } from "@/components/console/SetupLibrary";
import { NoxLogo } from "@/components/NoxLogo";
import { APP_VERSION } from "@/lib/app-version";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Lightbulb,
  LightbulbOff,
  Check,
  Folder,
  Clapperboard,
  Radio,
  Power,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { PlotPanel, emptyPlot, type Plot } from "@/components/console/PlotPanel";
import { cctFromKelvin, fixtureColor, fixtureState, getDef, getMode, type PatchedFixture, type TriggerKind } from "@/lib/dmx";
import { ItemMenu, ColorSwatches } from "@/components/console/ItemMenu";
import { PatchPanel } from "@/components/console/PatchPanel";
import { FixtureControls } from "@/components/console/FixtureControls";
import { FixtureGlyph } from "@/components/console/FixtureGlyph";
import { copyFixtureSettings, type FixtureSettings } from "@/lib/fixture-settings";
import { PixelPanel } from "@/components/console/PixelPanel";
import { GroupsPanel } from "@/components/console/GroupsPanel";
import { buildUniverses, createSender, type BridgeStatus } from "@/lib/output";
import { ConnectDialog } from "@/components/console/ConnectDialog";
import { FixtureMenu } from "@/components/console/FixtureMenu";
import { SettingsDialog, type BtDevice } from "@/components/console/SettingsDialog";
import { batteryStatus, drawFactor, fmtHours } from "@/lib/power";
import { listenMidi, loadMidi, saveMidi, type MidiMsg } from "@/lib/midi";
import { DOUBLE_TAP_MS, defaultMacros, keyName, loadMacros, macroCommand, saveMacros, type Macro } from "@/lib/macros";
import { Settings as SettingsIcon, BatteryMedium, Pencil } from "lucide-react";
import { applyLook } from "@/components/console/LooksPanel";
import { LooksRail } from "@/components/console/LooksRail";
import { RecRail, RecDialog, RecEditor } from "@/components/console/RecRail";
import { PatchPage } from "@/components/console/PatchPage";
import { statesAt, stepLength } from "@/lib/recordings";
import { snapshot } from "@/components/console/LooksPanel";
import type { Recording, LookState, Cue, BankFader, CallSheetData } from "@/lib/store";
import { applyBank, cueBlend, lookStateOf, nextCueNumber, sortCues, NANOKONTROL2 } from "@/lib/playback";
import { PlaybackBar } from "@/components/console/PlaybackBar";
import { EffectsRail } from "@/components/console/EffectsRail";
import { NumberField } from "@/components/console/NumberField";
import { commandPatch, inverseFlash } from "@/lib/console-command";
import { Keypad } from "@/components/console/Keypad";
import { useFixtureHistory } from "@/hooks/use-fixture-history";
import { CallSheet } from "@/components/console/CallSheet";
import { layerHeight, migrateLayers, pixelCount, pixelGrid, renderLayers, textMask, type PixelLayer } from "@/lib/pixels";
import {
  PROJECT_COLORS,
  loadProjects,
  saveProjects,
  loadConnection,
  saveConnection,
  type Connection,
  uid,
  type Project,
  type Scene,
  type Look,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOX — DMX lighting control for film sets" },
      {
        name: "description",
        content: "Control ARRI, Aputure, Nanlite and Astera lights with scenes, effects and auto-save.",
      },
      { property: "og:title", content: "NOX — DMX lighting control" },
      {
        property: "og:description",
        content: "A tablet-friendly lighting console with scenes, effects and a film-industry fixture library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type View =
  | { name: "projects" }
  | { name: "scenes"; projectId: string }
  | { name: "console"; projectId: string; sceneId: string };

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ name: "projects" });

  const { user } = useUser();
  const [sync, setSync] = useState<"off" | "syncing" | "ok" | "error">("off");
  const merged = useRef<string | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
    setLoaded(true);
  }, []);

  // Immediate save on structural changes
  useEffect(() => {
    if (loaded) saveProjects(projects);
  }, [projects, loaded]);

  // Signed in: merge cloud projects/favourites/effects once, then keep the cloud updated
  useEffect(() => {
    if (!loaded || !user || merged.current === user.id) return;
    merged.current = user.id;
    setSync("syncing");
    pullAndMerge(loadProjects()).then((ps) => { setProjects(ps); setSync("ok"); }).catch(() => setSync("error"));
  }, [user, loaded]);
  useEffect(() => {
    if (!user || merged.current !== user.id || sync === "syncing") return;
    const id = setTimeout(() => { pushProjects(user.id, projects).then(() => setSync("ok")).catch(() => setSync("error")); }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, user]);
  useEffect(() => {
    if (!user) { merged.current = null; setSync("off"); return; }
    let id: ReturnType<typeof setTimeout>;
    const push = (e: Event) => { if ((e as CustomEvent).detail?.silent) return; clearTimeout(id); id = setTimeout(() => void pushUserData(user.id).catch(() => setSync("error")), 1000); };
    window.addEventListener("crmx-favorites", push);
    window.addEventListener("crmx-effects", push);
    return () => { clearTimeout(id); window.removeEventListener("crmx-favorites", push); window.removeEventListener("crmx-effects", push); };
  }, [user]);

  const updateProject = (id: string, fn: (p: Project) => Project) =>
    setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  if (!loaded) return <div className="min-h-screen bg-background" />;

  if (view.name === "projects") {
    return (
      <ProjectsScreen
        projects={projects}
        account={<AccountButton email={user?.email ?? null} sync={sync} />}
        onOpen={(id) => setView({ name: "scenes", projectId: id })}
        onCreate={(name, color) => {
          const p: Project = {
            id: uid(),
            name,
            color,
            createdAt: Date.now(),
            scenes: [],
          };
          setProjects((ps) => [p, ...ps]);
        }}
        onDelete={(id) => setProjects((ps) => ps.filter((p) => p.id !== id))}
        onUpdate={updateProject}
        onDuplicate={(id) => setProjects((ps) => { const src = ps.find((p) => p.id === id); return src ? [{ ...structuredClone(src), id: uid(), name: `${src.name} copy`, createdAt: Date.now() }, ...ps] : ps; })}
      />
    );
  }

  const projectId = "projectId" in view ? view.projectId : null;
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    setView({ name: "projects" });
    return null;
  }

  if (view.name === "scenes") {
    return (
      <ScenesScreen
        project={project}
        onBack={() => setView({ name: "projects" })}
        onOpen={(sceneId) => setView({ name: "console", projectId: project.id, sceneId })}
        onCreate={(name) => {
          const prev = project.scenes[0];
          const s: Scene = {
            id: uid(),
            name,
            createdAt: Date.now(),
            // new scenes inherit the patch from the latest scene
            fixtures: prev ? prev.fixtures.map((f) => ({ ...f, intensity: 0, fx: { ...f.fx, kind: "none" as const }, trigger: null })) : [],
            master: 1,
          };
          updateProject(project.id, (p) => ({ ...p, scenes: [s, ...p.scenes] }));
          setView({ name: "console", projectId: project.id, sceneId: s.id });
        }}
        onDuplicate={(sceneId) =>
          updateProject(project.id, (p) => {
            const src = p.scenes.find((s) => s.id === sceneId);
            if (!src) return p;
            const copy: Scene = { ...structuredClone(src), id: uid(), name: `${src.name} copy`, createdAt: Date.now() };
            return { ...p, scenes: [copy, ...p.scenes] };
          })
        }
        onDelete={(sceneId) =>
          updateProject(project.id, (p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== sceneId) }))
        }
        onRename={(sceneId, name) =>
          updateProject(project.id, (p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, name } : s)) }))
        }
      />
    );
  }

  const scene = project.scenes.find((s) => s.id === view.sceneId);
  if (!scene) {
    setView({ name: "scenes", projectId: project.id });
    return null;
  }

  return (
    <ConsoleScreen
      key={scene.id}
      project={project}
      scene={scene}
      onSave={(next) =>
        updateProject(project.id, (p) => ({
          ...p,
          scenes: p.scenes.map((s) => (s.id === next.id ? next : s)),
        }))
      }
      onExit={() => setView({ name: "scenes", projectId: project.id })}
      onLooks={(looks) => updateProject(project.id, (p) => ({ ...p, looks }))}
      onSetups={(setups) => updateProject(project.id, (p) => ({ ...p, setups }))}
      onRecordings={(recordings) => updateProject(project.id, (p) => ({ ...p, recordings }))}
      onBank={(bank) => updateProject(project.id, (p) => ({ ...p, bank }))}
      onCues={(cues) => updateProject(project.id, (p) => ({ ...p, cues }))}
      onCallSheet={(callSheet) => updateProject(project.id, (p) => ({ ...p, callSheet }))}
    />
  );
}

/* ---------------- Shared bits ---------------- */

function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-surface/95 px-5 py-2 backdrop-blur">
      {onBack && (
        <button onClick={onBack} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title === "NOX" ? (
          <div className="flex items-center gap-4">
            <NoxLogo className="h-12 w-12 shrink-0" title="NOX" />
            <h1 className="truncate font-display text-lg font-bold text-primary">{subtitle ?? "NOX"}</h1>
          </div>
        ) : (
          <>
            <h1 className="truncate font-display font-bold text-xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-primary">{subtitle}</p>}
          </>
        )}
      </div>
      {right}
    </header>
  );
}

function NewItemForm({ placeholder, onCreate }: { placeholder: string; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim());
        setName("");
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary"
      />
      <button type="submit" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:scale-95">
        <Plus className="h-4 w-4" /> Create
      </button>
    </form>
  );
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/* ---------------- Projects ---------------- */

function AccountButton({ email, sync }: { email: string | null; sync: "off" | "syncing" | "ok" | "error" }) {
  if (!email) return <div className="flex items-center gap-3"><span className="font-mono text-[10px] text-muted-foreground">v{APP_VERSION}</span><Button asChild size="sm"><Link to="/auth"><LogIn className="h-4 w-4" />Sign in</Link></Button></div>;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="max-w-40 truncate text-xs">{email}</p>
        <p className="text-[10px] text-muted-foreground">{sync === "syncing" ? "Syncing…" : sync === "error" ? "Sync failed — saved on this device" : "Synced to account"}</p>
      </div>
      <Cloud className={`h-4 w-4 ${sync === "error" ? "text-destructive" : "text-primary"}`} />
      <button onClick={() => void supabase.auth.signOut()} className="rounded-lg bg-surface-elevated p-2.5" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
    </div>
  );
}

function ProjectsScreen({ projects, account, onOpen, onCreate, onDelete, onUpdate, onDuplicate }: {
  projects: Project[]; account: React.ReactNode; onOpen: (id: string) => void; onCreate: (n: string, color: string) => void; onDelete: (id: string) => void;
  onUpdate: (id: string, fn: (p: Project) => Project) => void; onDuplicate: (id: string) => void;
}) {
  const [color, setColor] = useState(PROJECT_COLORS[0]!);
  return (
    <div className="min-h-screen">
      <Header title="NOX" subtitle="Projects" right={account} />
      <main className="mx-auto max-w-5xl space-y-6 p-5">
        <div className="space-y-3">
          <NewItemForm placeholder="New project name (e.g. Commercial Day 1)" onCreate={(n) => onCreate(n, color)} />
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        {projects.length === 0 ? (
          <Empty icon={<Folder className="h-10 w-10" />} text="No projects yet. Create one to start patching lights." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} color={p.color} title={p.name} meta={`${p.scenes.length} scenes · ${fmtDate(p.createdAt)}`} onClick={() => onOpen(p.id)}
                menu={<ItemMenu name={p.name} color={p.color} onDuplicate={() => onDuplicate(p.id)} onDelete={() => onDelete(p.id)}
                  onRename={(name) => onUpdate(p.id, (x) => ({ ...x, name }))} onColor={(c) => onUpdate(p.id, (x) => ({ ...x, color: c }))} />} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- Scenes ---------------- */

function ScenesScreen({ project, onBack, onOpen, onCreate, onDuplicate, onDelete, onRename }: {
  project: Project; onBack: () => void; onOpen: (id: string) => void; onCreate: (n: string) => void;
  onDuplicate: (id: string) => void; onDelete: (id: string) => void; onRename: (id: string, n: string) => void;
}) {
  return (
    <div className="min-h-screen">
      <Header title={project.name} subtitle="Scenes" onBack={onBack} />
      <main className="mx-auto max-w-5xl space-y-6 p-5">
        <NewItemForm placeholder="New scene name (e.g. Interview, Night, Fire)" onCreate={onCreate} />
        {project.scenes.length === 0 ? (
          <Empty icon={<Clapperboard className="h-10 w-10" />} text="No scenes yet. Create your first scene." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.scenes.map((s) => (
              <Card key={s.id} color={project.color} title={s.name} meta={`${s.fixtures.length} fixtures · ${fmtDate(s.createdAt)}`} onClick={() => onOpen(s.id)}
                menu={<ItemMenu name={s.name} onDuplicate={() => onDuplicate(s.id)} onDelete={() => onDelete(s.id)} onRename={(n) => onRename(s.id, n)} />} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ color, title, meta, onClick, menu }: { color: string; title: string; meta: string; onClick: () => void; menu: React.ReactNode }) {
  return (
    <div onClick={onClick} className="relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 transition active:scale-[0.98] hover:border-primary/40">
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
        {menu}
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ---------------- Console ---------------- */

type Panel = "patch" | "control" | "pixels";
type RGB = [number, number, number];
const FADE = 2; // blackout fade time in seconds

function ConsoleScreen({ project, scene, onSave, onExit, onLooks, onSetups, onRecordings, onBank, onCues, onCallSheet }: {
  project: Project; scene: Scene; onSave: (s: Scene) => void; onExit: () => void; onLooks: (l: Look[]) => void; onSetups: (setups: Scene[]) => void; onRecordings: (r: Recording[]) => void; onBank: (b: BankFader[]) => void; onCues: (c: Cue[]) => void; onCallSheet: (c: CallSheetData) => void;
}) {
  const { fixtures, setFixtures, setUntrackedFixtures, begin: beginFixtureEdit, end: endFixtureEdit, undo, redo, canUndo, canRedo } = useFixtureHistory(scene.fixtures);
  const [master, setMaster] = useState(scene.master);
  const [bo, setBo] = useState<{ target: 0 | 1; at: number; from: number }>({ target: 0, at: -10, from: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState<{ name: string; settings: FixtureSettings } | null>(null);
  const lastPick = useRef<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const [panel, setPanel] = useState<Panel>("control");
  const [panelOpen, setPanelOpen] = useState(true);
  const [layers, setLayers] = useState<PixelLayer[]>(() => migrateLayers(scene));
  const [locked, setLocked] = useState(true);
  const [plot, setPlot] = useState<Plot>(() => scene.plot ?? emptyPlot());
  const [plotOpen, setPlotOpen] = useState(false);
  const [lastLook, setLastLook] = useState<string | null>(null);
  const [conn, setConnState] = useState<Connection>(() => loadConnection());
  const [connOpen, setConnOpen] = useState(false);
  const setConn = (c: Connection) => { setConnState(c); saveConnection(c); };
  const [savedFlash, setSavedFlash] = useState(false);
  const [setupsOpen, setSetupsOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [fadersOpen, setFadersOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [railTab, setRailTab] = useState<"looks" | "effects" | "rec">("looks");
  const [gearOpen, setGearOpen] = useState(false);
  const [pulses, setPulses] = useState<Record<string, { at: number; base: number; target: number }>>({});
  const [activePixelId, setActivePixelId] = useState(scene.pixelLayers?.[0]?.id ?? "");
  const activePixel = layers.find((l) => l.id === activePixelId) ?? layers[0];
  const [t, setT] = useState(0);
  const clock = useRef(0);

  useEffect(() => {
    let raf = 0;
    const start = 0; // shared absolute clock so effect previews match output
    const loop = () => {
      clock.current = (performance.now() - start) / 1000;
      setT(clock.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const latest = useRef({ fixtures, master, layers, plot });
  latest.current = { fixtures, master, layers, plot };
  const currentScene = (): Scene => {
    const { pixelMap: _legacy, ...rest } = scene;
    return { ...rest, fixtures: latest.current.fixtures.map((f) => ({ ...f, trigger: null })), master: latest.current.master, pixelLayers: latest.current.layers, plot: latest.current.plot };
  };
  const save = () => onSave(currentScene());
  const restoreSetup = (setup: Scene) => {
    const restored = structuredClone(setup);
    setPlotOpen(false);
    setFixtures(restored.fixtures);
    setMaster(restored.master);
    setLayers(migrateLayers(restored));
    setPlot(restored.plot ?? emptyPlot());
    setSelected([]);
    setLastLook(null);
    setBo({ target: 0, at: -10, from: 0 });
    onSave({ ...restored, id: scene.id, name: scene.name, createdAt: scene.createdAt });
  };

  // Blackout fades smoothly out / in over FADE seconds
  const boK = Math.min(1, Math.max(0, (t - bo.at) / FADE));
  const boLevel = bo.from + (bo.target - bo.from) * boK;
  const toggleBlackout = () => setBo({ target: bo.target ? 0 : 1, at: clock.current, from: boLevel });
  const outLevel = master * (1 - boLevel);

  const maskKey = layers.map((l) => (l.kind === "text" ? `${l.id}:${l.text}:${layerHeight(l, fixtures)}` : "")).join("|");
  const masks = useMemo(() => {
    const m = new Map<string, ReturnType<typeof textMask>>();
    for (const l of layers) if (l.kind === "text") m.set(l.id, textMask(l.text.toUpperCase(), layerHeight(l, fixtures)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskKey]);
  const frame = layers.some((l) => l.playing) ? renderLayers(layers, fixtures, t, masks) : new Map<string, RGB[]>();

  // Stream real DMX to the bridge (Art-Net / sACN → CRMX transmitter)
  const [bridge, setBridge] = useState<BridgeStatus>("off");
  const sender = useMemo(() => createSender(setBridge), []);
  useEffect(() => {
    void sender(conn, buildUniverses(outFixtures, t, outLevel, frame, conn));
  });

  // Battery drain: integrate each light's draw every 5 s
  const outRef = useRef(outLevel);
  outRef.current = outLevel;
  useEffect(() => {
    const id = setInterval(() => {
      setUntrackedFixtures((fs) => fs.some((f) => f.power) ? fs.map((f) => (f.power ? { ...f, power: { ...f.power, usedWh: f.power.usedWh + (f.power.watts * drawFactor(f, outRef.current) * 5) / 3600 } } : f)) : fs);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Settings: Bluetooth + MIDI
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bt, setBt] = useState<BtDevice[]>([]);
  const connectBt = async () => {
    try {
      const { connectBluetoothBattery } = await import("@/lib/native-ble");
      await connectBluetoothBattery(
        (d) => setBt((b) => [...b.filter((x) => x.id !== d.id), { ...d, battery: null }]),
        (id, v) => setBt((b) => b.map((x) => (x.id === id ? { ...x, battery: v } : x))),
      );
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (!/cancel/i.test(msg)) alert(`Bluetooth: ${msg || "could not connect"}. Turn on Bluetooth and allow Nearby devices for NOX.`);
    }
  };

  const [midi, setMidiState] = useState(() => ({ enabled: false, maps: [] as ReturnType<typeof loadMidi>["maps"] }));
  useEffect(() => { setMidiState(loadMidi()); }, []);
  const setMidi = (m: typeof midi) => { setMidiState(m); saveMidi(m); };
  const [macros, setMacrosState] = useState<Macro[]>(defaultMacros);
  useEffect(() => { setMacrosState(loadMacros()); }, []);
  const setMacros = (m: Macro[]) => { setMacrosState(m); saveMacros(m); };
  const [macroLearn, setMacroLearn] = useState<string | null>(null);
  const lastDeselect = useRef(0);
  const macroRef = useRef({ macros, learn: macroLearn, setMacros, setLearn: setMacroLearn, run: (_m: Macro) => {} });
  Object.assign(macroRef.current, { macros, learn: macroLearn, setMacros });
  const [learning, setLearning] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [midiDevices, setMidiDevices] = useState<string[]>([]);
  const [midiError, setMidiError] = useState<string | null>(null);
  const midiRef = useRef({ midi, learning, handle: (_m: MidiMsg) => {} });
  midiRef.current.midi = midi;
  midiRef.current.learning = learning;
  midiRef.current.handle = (m: MidiMsg) => {
    for (const map of midi.maps.filter((x) => x.key === m.key)) {
      const [kind, id] = [map.target.split(":")[0], map.target.slice(map.target.indexOf(":") + 1)];
      if (kind === "master") setMaster(m.value);
      else if (kind === "blackout") { if (!m.isNote || m.on) toggleBlackout(); }
      else if (kind === "int") updateOne(id, { intensity: m.value });
      else if (kind === "on" && (!m.isNote || m.on)) setFixtures((fs) => fs.map((f) => (f.uid === id ? { ...f, on: m.isNote ? f.on === false : m.value > 0.5 } : f)));
      else if (kind === "fx" && (!m.isNote || m.on)) setFixtures((fs) => fs.map((f) => (f.uid === id ? { ...f, fxPlaying: f.fxPlaying === false } : f)));
      else if (kind === "group") setFixtures((fs) => fs.map((f) => (f.group === id ? { ...f, intensity: m.value } : f)));
      else if (kind === "look" && (!m.isNote || m.on)) { const l = project.looks?.find((x) => x.id === id); if (l) recallLook(l); }
      else if (kind === "trig" && (!m.isNote || m.on)) fire(id as TriggerKind);
      else if (kind === "bank") onBank((project.bank ?? []).map((b, i) => (String(i) === id ? { ...b, level: m.value } : b)));
      else if (kind === "cue" && (!m.isNote || m.on) && m.value > 0) goRef.current(id === "back" ? -1 : 1);
      else if (kind === "macro" && (!m.isNote || m.on) && m.value > 0) { const mc = macroRef.current.macros.find((x) => x.id === id); if (mc) macroRef.current.run(mc); }
    }
  };
  useEffect(() => {
    if (!midi.enabled) return;
    let off: (() => void) | undefined;
    listenMidi((m) => {
      setLastMsg(`${m.key} = ${Math.round(m.value * 127)}`);
      const r = midiRef.current;
      if (r.learning) {
        if (m.isNote && !m.on) return;
        const t = r.learning;
        setMidi({ ...r.midi, maps: [...r.midi.maps.filter((x) => x.key !== m.key), { key: m.key, target: t, label: t }] });
        setLearning(null);
        return;
      }
      r.handle(m);
    }, setMidiDevices).then((u) => { off = u; setMidiError(null); }).catch((e: Error) => setMidiError(e.message));
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midi.enabled]);

  useEffect(() => {
    const id = setTimeout(() => {
      save();
      setSavedFlash(true);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures, master, layers, plot]);
  useEffect(() => {
    if (!savedFlash) return;
    const id = setTimeout(() => setSavedFlash(false), 1500);
    return () => clearTimeout(id);
  }, [savedFlash]);

  const exit = () => { save(); onExit(); };

  const updateSelected = (patch: Partial<PatchedFixture>) =>
    setFixtures((fs) => fs.map((f) => (selected.includes(f.uid) ? { ...f, ...patch } : f)));
  const updateEach = (fn: (f: PatchedFixture) => Partial<PatchedFixture>) =>
    setFixtures((fs) => fs.map((f) => (selected.includes(f.uid) ? { ...f, ...fn(f) } : f)));
  const updateOne = (id: string, patch: Partial<PatchedFixture>) => setFixtures((fs) => fs.map((f) => (f.uid === id ? { ...f, ...patch } : f)));

  const fire = (kind: TriggerKind) => {
    const targets = selected.length ? selected : fixtures.map((f) => f.uid);
    const now = clock.current;
    setFixtures((fs) => fs.map((f) => (targets.includes(f.uid) ? { ...f, trigger: { kind, at: now + (kind === "lightning" ? Math.random() * 0.25 : 0) } } : f)));
  };

  const splitPixels = (f: PatchedFixture) => {
    const n = pixelCount(f);
    const cpp = Math.max(1, Math.floor(getMode(f).channels / n));
    const cells: PatchedFixture[] = Array.from({ length: n }, (_, i) => ({
      ...structuredClone(f), uid: uid(), name: `${f.name} px${i + 1}`, address: f.address + i * cpp, group: f.name,
      split: { from: f.uid, name: f.name, index: i, of: n, cpp },
    }));
    setFixtures((fs) => fs.flatMap((x) => (x.uid === f.uid ? cells : [x])));
    setLayers((ls) => ls.map((l) => ({ ...l, order: l.order.filter((u) => u !== f.uid) })));
    setSelected(cells.map((c) => c.uid));
  };
  const joinPixels = (cell: PatchedFixture) => {
    const sp = cell.split!;
    setFixtures((fs) => {
      const cells = fs.filter((x) => x.split?.from === sp.from).sort((a, b) => a.split!.index - b.split!.index);
      const first = cells[0]!;
      const { split: _s, ...base } = first;
      const joined: PatchedFixture = { ...base, uid: sp.from, name: sp.name, address: first.address };
      let placed = false;
      return fs.flatMap((x) => {
        if (x.split?.from !== sp.from) return [x];
        if (placed) return [];
        placed = true;
        return [joined];
      });
    });
    setSelected([]);
  };

  const groups = Array.from(new Set(fixtures.map((f) => f.group).filter((g): g is string => !!g)));
  const setGroup = (f: PatchedFixture, g: string | null) => {
    const targets = selected.includes(f.uid) ? selected : [f.uid];
    setFixtures((fs) => fs.map((x) => {
      if (!targets.includes(x.uid)) return x;
      if (g) return { ...x, group: g };
      const { group: _g, ...rest } = x;
      return rest;
    }));
  };
  const renameGroup = (from: string, to: string) => setFixtures((fs) => fs.map((x) => (x.group === from ? { ...x, group: to } : x)));
  const updateGroup = (g: string, p: Partial<PatchedFixture>) => setFixtures((fs) => fs.map((x) => (x.group === g ? { ...x, ...p } : x)));
  const ungroup = (g: string) => setFixtures((fs) => fs.map((x) => { if (x.group !== g) return x; const { group: _g, ...rest } = x; return rest; }));

  const recallLook = (l: Look) => {
    setFixtures((fs) => applyLook(l, fs));
    setLastLook(l.id);
  };

  const sel = fixtures.filter((f) => selected.includes(f.uid));
  // REC sequences
  const recordings = project.recordings ?? [];
  const recRef = useRef(recordings);
  recRef.current = recordings;
  const [recOpen, setRecOpen] = useState(false);
  const [patchOpen, setPatchOpen] = useState(false);
  const [play, setPlay] = useState<{ id: string; start: number; origin: Map<string, LookState>; pausedAt?: number | undefined; released?: number; waiting?: number | undefined } | null>(null);
  const [recEditor, setRecEditor] = useState(false);
  const recHold = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const [recProg, setRecProg] = useState<{ t: number; step: number } | null>(null);
  const fixturesRef = useRef(fixtures);
  fixturesRef.current = fixtures;
  useEffect(() => {
    if (!play || play.pausedAt != null) return;
    const id = setInterval(() => {
      const rec = recRef.current.find((r) => r.id === play.id);
      let t = (performance.now() - play.start) / 1000;
      if (rec) {
        // manual cues hold the sequence at their start until GO
        let acc = 0;
        for (let i = 0; i < rec.steps.length; i++) {
          const st = rec.steps[i]!;
          if (i > 0 && st.manual && i > (play.released ?? 0) && t >= acc) {
            t = Math.max(0, acc - 0.001);
            setPlay({ ...play, pausedAt: t, waiting: i });
            break;
          }
          acc += stepLength(st);
        }
      }
      const res = rec ? statesAt(rec, fixturesRef.current, play.origin, t) : null;
      if (!res) { setPlay(null); setRecProg(null); return; }
      setRecProg({ t, step: res.step });
      setUntrackedFixtures((fs) => fs.map((f) => { const st = res.states.get(f.uid); return st ? { ...f, ...st, trigger: null } : f; }));
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);
  const playRec = (id: string) => {
    if (play?.id === id && play.pausedAt != null) { setPlay({ ...play, start: performance.now() - play.pausedAt * 1000, pausedAt: undefined }); return; }
    setPlay({ id, start: performance.now(), origin: new Map(fixtures.map((f) => [f.uid, snapshot(f)])) });
  };
  const goRec = () => { if (play?.waiting != null && play.pausedAt != null) setPlay({ ...play, start: performance.now() - (play.pausedAt + 0.002) * 1000, pausedAt: undefined, released: play.waiting, waiting: undefined }); };
  const pauseRec = () => { if (play && play.pausedAt == null) setPlay({ ...play, pausedAt: (performance.now() - play.start) / 1000 }); };
  const stopRec = () => { setPlay(null); setRecProg(null); };

  // Playback bank + cue stack
  const bank = project.bank ?? [];
  const cues = project.cues ?? [];
  const [flash, setFlash] = useState<string | null>(null);
  const [solo, setSolo] = useState<string | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [cueFade, setCueFade] = useState<{ id: string; start: number; from: Map<string, LookState> } | null>(null);
  const [fadeK, setFadeK] = useState<number | null>(null);
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  useEffect(() => {
    if (!cueFade) return;
    const id = setInterval(() => {
      const cue = cuesRef.current.find((c) => c.id === cueFade.id);
      if (!cue) { setCueFade(null); return; }
      const k = cue.fade > 0 ? Math.min(1, (performance.now() - cueFade.start) / 1000 / cue.fade) : 1;
      setFadeK(k);
      const st = cueBlend(cue, fixturesRef.current, cueFade.from, k);
      setUntrackedFixtures((fs) => fs.map((f) => { const s = st.get(f.uid); return s ? { ...f, ...s, trigger: null } : f; }));
      if (k >= 1) { setCueFade(null); setFadeK(null); }
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueFade]);
  const gotoCue = (id: string) => { setActiveCue(id); setCueFade({ id, start: performance.now(), from: new Map(fixtures.map((f) => [f.uid, lookStateOf(f)])) }); };
  const cueStep = (d: 1 | -1) => {
    const s = sortCues(cuesRef.current);
    if (!s.length) return;
    const i = s.findIndex((c) => c.id === activeCue);
    const n = s[i < 0 ? (d > 0 ? 0 : -1) : i + d];
    if (n) gotoCue(n.id);
  };
  const recordCue = (name: string, after?: number) => {
    const src = sel.length ? sel : fixtures;
    const number = nextCueNumber(cues, after);
    const cue: Cue = { id: uid(), number, name: name || `Cue ${number}`, fade: 3, states: src.map((f) => ({ uid: f.uid, name: f.name, state: lookStateOf(f) })) };
    onCues([...cues, cue]);
    setActiveCue(cue.id);
  };
  const updateCueStates = (id: string) => onCues(cues.map((c) => (c.id === id ? { ...c, states: (sel.length ? sel : fixtures).map((f) => ({ uid: f.uid, name: f.name, state: lookStateOf(f) })) } : c)));
  const goRef = useRef(cueStep);
  goRef.current = cueStep;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const name = keyName(e);
      const r = macroRef.current;
      if (name && r.learn) { e.preventDefault(); r.setMacros(r.macros.map((m) => (m.id === r.learn ? { ...m, key: name } : m))); r.setLearn(null); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const hit = name ? r.macros.filter((m) => m.key === name) : [];
      if (hit.length) { e.preventDefault(); hit.forEach((m) => r.run(m)); return; }
      if (e.code === "Space") { e.preventDefault(); goRef.current(1); }
      else if (e.key === "b" || e.key === "B") goRef.current(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const outFixtures = useMemo(() => {
    const out = applyBank(fixtures, bank, project.looks ?? [], flash, solo);
    const ids = Object.keys(pulses);
    if (!ids.length) return out;
    const now = performance.now();
    return out.map((f) => {
      const pulse = pulses[f.uid];
      return pulse ? inverseFlash(f, (now - pulse.at) / 1000, pulse.base, pulse.target) : f;
    });
  }, [fixtures, bank, project.looks, flash, solo, pulses, t]);
  useEffect(() => {
    if (!Object.keys(pulses).length) return;
    const id = setTimeout(() => { const now = performance.now(); setPulses((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => now - v.at < 1000))); }, 1050);
    return () => clearTimeout(id);
  }, [pulses]);
  const flashFixtures = (uids: string[]) => {
    const now = performance.now();
    setPulses((p) => ({ ...p, ...Object.fromEntries(outFixtures.filter((f) => uids.includes(f.uid)).map((f) => [f.uid, { at: now, base: fixtureState(f, t).v, target: fixtureState(f, t).v > 0.05 ? 0 : 1 }])) }));
  };
  const runCommand = (select: number[] | undefined, level: number | undefined, cct?: number, levelDelta?: number, cctDelta?: number) => {
    const ids = select ? select.map((n) => fixtures[n - 1]?.uid).filter((x): x is string => !!x) : selected;
    if (select) { setSelected(ids); lastPick.current = ids[ids.length - 1] ?? null; }
    const command = { ...(level != null ? { level } : {}), ...(cct != null ? { cct } : {}), ...(levelDelta != null ? { levelDelta } : {}), ...(cctDelta != null ? { cctDelta } : {}) };
    setFixtures((fs) => fs.map((f) => ids.includes(f.uid) ? { ...f, ...commandPatch(f, command) } : f));
  };
  const stepLight = (dir: 1 | -1) => {
    if (!fixtures.length) return;
    const cur = lastPick.current ? fixtures.findIndex((f) => f.uid === lastPick.current) : -1;
    const next = fixtures[(cur + dir + fixtures.length) % fixtures.length];
    if (!next) return;
    setSelected([next.uid]); lastPick.current = next.uid;
  };
  macroRef.current.run = (m: Macro) => {
    const c = macroCommand(m);
    if (c) return runCommand(undefined, c.level, c.cct, c.levelDelta, c.cctDelta);
    const pulse = (target: number) => { const now = performance.now(); setPulses((p) => ({ ...p, ...Object.fromEntries(outFixtures.filter((f) => selected.includes(f.uid)).map((f) => [f.uid, { at: now, base: fixtureState(f, t).v, target }])) })); };
    if (m.action === "next") stepLight(1);
    else if (m.action === "prev") stepLight(-1);
    else if (m.action === "select") { const id = lastPick.current ?? fixtures[0]?.uid; if (id) { setSelected((s) => (s.includes(id) ? s : [...s, id])); lastPick.current = id; } }
    else if (m.action === "all") setSelected(fixtures.map((f) => f.uid));
    else if (m.action === "deselect") {
      const now = performance.now();
      if (now - lastDeselect.current < DOUBLE_TAP_MS) { setSelected(fixtures.map((f) => f.uid)); lastDeselect.current = 0; }
      else { setSelected([]); lastDeselect.current = now; }
    }
    else if (m.action === "flash") flashFixtures(selected);
    else if (m.action === "flash_up") pulse(1);
    else if (m.action === "flash_down") pulse(0);
    else if (m.action === "go") goRef.current(1);
    else if (m.action === "back") goRef.current(-1);
    else if (m.action === "play") { if (play && play.pausedAt != null) { if (play.waiting != null) goRec(); else setPlay({ ...play, start: performance.now() - play.pausedAt * 1000, pausedAt: undefined }); } else goRef.current(1); }
    else if (m.action === "pause") pauseRec();
    else if (m.action === "blackout") toggleBlackout();
    else if (m.action === "undo") undo();
    else if (m.action === "redo") redo();
  };
  const copySettings = () => { const source = sel[0]; if (source) setCopied({ name: source.name, settings: copyFixtureSettings(source) }); };
  const pasteSettings = () => {
    if (!copied) return;
    updateEach(() => ({ ...structuredClone(copied.settings), trigger: null }));
  };
  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    lastPick.current = id;
  };
  // shift-click or press-and-hold selects every light between the last tapped one and this one
  const selectRange = (id: string) => {
    const from = lastPick.current ? fixtures.findIndex((f) => f.uid === lastPick.current) : -1;
    const to = fixtures.findIndex((f) => f.uid === id);
    if (from < 0 || to < 0) return toggleSelect(id);
    const ids = fixtures.slice(Math.min(from, to), Math.max(from, to) + 1).map((f) => f.uid);
    setSelected((s) => [...new Set([...s, ...ids])]);
    lastPick.current = id;
  };
  const holdStart = (id: string) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    held.current = false;
    holdTimer.current = setTimeout(() => { held.current = true; selectRange(id); navigator.vibrate?.(20); }, 450);
  };
  const holdEnd = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  // Sweep: drag across tiles to add every light you pass over
  const [sweep, setSweep] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapSource, setSwapSource] = useState<string | null>(null);
  const swapTile = (id: string) => {
    if (!swapSource) { setSwapSource(id); return; }
    if (swapSource !== id) {
      setFixtures((fs) => {
        const from = fs.findIndex((f) => f.uid === swapSource);
        const to = fs.findIndex((f) => f.uid === id);
        const source = fs[from];
        const target = fs[to];
        if (!source || !target) return fs;
        const next = [...fs];
        next[from] = target;
        next[to] = source;
        return next;
      });
    }
    setSwapSource(null);
  };
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const swept = useRef<Set<string> | null>(null);
  const sweepMode = useRef<"add" | "remove">("add");
  const sweepAt = (x: number, y: number) => {
    const id = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-fixture]")?.dataset["fixture"];
    if (!id || !swept.current || swept.current.has(id)) return;
    // first light touched decides: starting on a selected light deselects while sweeping
    if (swept.current.size === 0) sweepMode.current = selectedRef.current.includes(id) ? "remove" : "add";
    swept.current.add(id);
    lastPick.current = id;
    navigator.vibrate?.(8);
    if (sweepMode.current === "remove") setSelected((s) => s.filter((x) => x !== id));
    else setSelected((s) => (s.includes(id) ? s : [...s, id]));
  };
  const tileClick = (e: React.MouseEvent, id: string) => {
    if (held.current) { held.current = false; return; }
    if (e.shiftKey) selectRange(id); else toggleSelect(id);
  };
  // tapping the active tab again collapses / expands the side panel
  const tab = (p: Panel, label: string) => (
    <Button variant="secondary" onClick={() => { if (panel === p) setPanelOpen((o) => !o); else { setPanel(p); setPanelOpen(true); } }}
      className={`h-11 rounded-lg px-5 text-sm font-bold active:scale-95 ${panel === p && panelOpen ? "bg-primary text-primary-foreground" : panel === p ? "bg-primary/30" : "bg-surface-elevated"}`}>{label} {panel === p ? (panelOpen ? "▾" : "▸") : ""}</Button>
  );
  const outputEnabled = bo.target === 0;

  return (
    <div className="flex h-screen flex-col" onPointerDownCapture={beginFixtureEdit} onPointerUp={() => queueMicrotask(endFixtureEdit)} onPointerCancel={endFixtureEdit}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button onClick={exit} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Exit"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold">{scene.name}</div>
          <div className="truncate text-xs" style={{ color: project.color }}>{project.name}</div>
        </div>
        <div className="flex-1" />
        <div className={`hidden items-center gap-1.5 text-xs text-success transition-opacity sm:flex ${savedFlash ? "opacity-100" : "opacity-0"}`}><Check className="h-3.5 w-3.5" />Auto-saved</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-glow">MASTER</span>
          <input aria-label="Master" type="range" min={0} max={1} step={0.01} value={master} onChange={(e) => setMaster(+e.target.value)} className="w-28 sm:w-40" />
          <NumberField aria-label="Master percent" min={0} max={100} value={Math.round(master * 100)} onChange={(v) => { if (v !== undefined) setMaster(v / 100); }} className="w-12 rounded border border-input bg-surface-elevated px-1 text-right font-mono text-xs" /><span className="text-xs">%</span>
          <Button variant="secondary" size="icon" aria-label="Blackout" aria-pressed={bo.target === 1} title={outputEnabled ? "Blackout — 2 second fade" : "Restore output — 2 second fade"} onClick={toggleBlackout} className={`relative overflow-hidden ${outputEnabled ? "text-primary" : "text-muted-foreground"}`}>
            {outputEnabled ? <Lightbulb className="bulb-lit" /> : <LightbulbOff />}
            {boK < 1 && <span className="absolute bottom-0 left-0 h-0.5 bg-amber-glow" style={{ width: `${boK * 100}%` }} />}
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setGearOpen(true)} title="Equipment list & call sheet" className="text-xs font-bold"><ClipboardList />GEAR</Button>
        <Button variant="secondary" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings"><SettingsIcon /></Button>
        <Button variant="secondary" onClick={() => setConnOpen(true)} title={!conn.node || bridge === "off" || bridge === "error" ? "Disconnected" : bridge === "slow" ? "Slow bridge response" : "Bridge responding — fixture reception not verified"}
          className={`text-xs font-bold ${conn.node && bridge === "ok" ? "bg-success text-primary-foreground" : conn.node && bridge === "slow" ? "bg-warning text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
          <Radio />CONNECT
        </Button>
      </div>
      <div aria-label="Console views" className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-4 py-2">
        <Button variant="secondary" onClick={() => setPatchOpen(true)} className="h-11 px-5 text-sm font-bold">PATCH</Button>
        {tab("control", "CONTROL")}
        {tab("pixels", "PIXELS")}
        <Button variant="secondary" onClick={() => setFadersOpen((o) => !o)} aria-pressed={fadersOpen}
          className={`h-11 rounded-lg px-5 text-sm font-bold active:scale-95 ${fadersOpen ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>FADERS {fadersOpen ? "▾" : "▸"}</Button>
        <Button variant="secondary" onClick={() => setPlotOpen(true)} className="h-11 px-5 text-sm font-bold"><MapIcon />PLOT</Button>
        {<Button variant="ghost" className="ml-auto gap-2 text-xs font-semibold" onClick={() => setGroupsOpen((o) => !o)} aria-label={groupsOpen ? "Hide groups and looks" : "Show groups and looks"} title={groupsOpen ? "Hide groups and looks" : "Show groups and looks"}><span className="hidden sm:inline">{groupsOpen ? "Hide" : "Groups · Looks · Effects · REC"}</span>{groupsOpen ? <PanelRightClose /> : <PanelRightOpen />}</Button>}
      </div>

      <SetupLibrary open={setupsOpen} onOpenChange={setSetupsOpen} setups={project.setups ?? []}
        onSave={(name) => { onSetups([{ ...structuredClone(currentScene()), id: uid(), name, createdAt: Date.now() }, ...(project.setups ?? [])]); save(); setSavedFlash(true); }}
        onRestore={restoreSetup} onDelete={(id) => onSetups((project.setups ?? []).filter((s) => s.id !== id))} />
      {plotOpen && (
        <PlotPanel plot={plot} setPlot={setPlot} fixtures={fixtures} selected={selected} setSelected={setSelected} update={updateOne}
          copiedSource={copied?.name} onCopy={copySettings} onPaste={pasteSettings}
          colorOf={(f) => { const px = frame.get(f.uid); if (px?.length) { const n = px.length; return [0, 1, 2].map((k) => Math.round(px.reduce((a, c) => a + c[k]!, 0) / n)) as RGB; } return fixtureState(f, t, outLevel).rgb.map(Math.round) as RGB; }}
          levelOf={(f) => (frame.get(f.uid) ? (f.on === false ? 0 : f.intensity * outLevel) : fixtureState(f, t, outLevel).v)}
          onClose={() => { setPlotOpen(false); save(); }} onOpenControls={() => { setPlotOpen(false); setPanel("control"); setPanelOpen(true); }} />
      )}
      {patchOpen && (
        <PatchPage title={`${project.name} · ${scene.name}`} callSheet={project.callSheet} onCallSheet={onCallSheet} fixtures={fixtures} onClose={() => { setPatchOpen(false); save(); }} onUpdate={updateOne} onReorder={setFixtures}
          onAdd={(fs) => setFixtures((x) => [...x, ...fs])} onReplace={(fs) => { setFixtures(fs); setSelected([]); }}
          onRemove={(uids) => { setFixtures((x) => x.filter((f) => !uids.includes(f.uid))); setSelected((s) => s.filter((id) => !uids.includes(id))); }} />
      )}
      {gearOpen && <CallSheet title={`${project.name} · ${scene.name}`} data={project.callSheet} onData={onCallSheet} fixtures={fixtures} onClose={() => setGearOpen(false)} />}
      <RecEditor open={recEditor} onOpenChange={setRecEditor} recordings={recordings} setRecordings={onRecordings} selectedFixtures={sel}
        playing={play?.id ?? null} paused={play?.pausedAt != null} progress={recProg} waiting={play?.waiting} onGo={goRec} onPlay={playRec} onPause={pauseRec} onStop={stopRec} />
      <RecDialog open={recOpen} onOpenChange={setRecOpen} src={sel.length ? sel : fixtures} recordings={recordings} setRecordings={onRecordings} />
      <ConnectDialog open={connOpen} onOpenChange={setConnOpen} conn={conn} setConn={setConn} status={bridge} />
      <SettingsDialog macros={macros} setMacros={setMacros} macroLearn={macroLearn} setMacroLearn={setMacroLearn} onSetups={() => setSetupsOpen(true)} open={settingsOpen} onOpenChange={setSettingsOpen} bt={bt} connectBt={connectBt} midi={midi} setMidi={setMidi}
        onNanoKontrol={() => { const ch = (n: number) => `CC 1/${n}`; const keep = midi.maps.filter((m) => !m.key.startsWith("CC 1/")); setMidi({ ...midi, enabled: true, maps: [...keep, ...NANOKONTROL2.faders.map((n, i) => ({ key: ch(n), target: `bank:${i}`, label: `Fader ${i + 1}` })), { key: ch(NANOKONTROL2.master), target: "master", label: "Master" }, { key: ch(NANOKONTROL2.go), target: "cue:go", label: "GO" }, { key: ch(NANOKONTROL2.back), target: "cue:back", label: "Back" }, { key: ch(NANOKONTROL2.blackout), target: "blackout", label: "Blackout" }] }); }}
        learning={learning} setLearning={setLearning} lastMsg={lastMsg} midiDevices={midiDevices} midiError={midiError}
        targets={[
          { id: "master", label: "Master fader" }, { id: "blackout", label: "Blackout" },
          { id: "cue:go", label: "Cue GO" }, { id: "cue:back", label: "Cue Back" },
          ...(project.bank ?? []).map((b, i) => ({ id: `bank:${i}`, label: `Fader ${i + 1}${b.name ? ` — ${b.name}` : ""}` })),
          { id: "trig:lightning", label: "Trigger: lightning" }, { id: "trig:flash", label: "Trigger: flash" },
          ...groups.map((g) => ({ id: `group:${g}`, label: `Group "${g}" intensity` })),
          ...(project.looks ?? []).map((l) => ({ id: `look:${l.id}`, label: `Look: ${l.name}` })),
          ...fixtures.flatMap((f) => [
            { id: `int:${f.uid}`, label: `${f.name} — intensity` }, { id: `on:${f.uid}`, label: `${f.name} — on/off` }, { id: `fx:${f.uid}`, label: `${f.name} — play/stop effect` },
          ]),
        ]} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="fixture-area min-h-0 flex-1 overflow-auto p-4">
          {fixtures.length === 0 ? (
            <Empty icon={<Lightbulb className="h-10 w-10" />} text="No lights patched. Choose a manufacturer, model and mode in the patch panel." />
          ) : (
            <>
              <div className="sticky -top-4 z-20 -mx-4 -mt-4 mb-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2 text-xs text-muted-foreground backdrop-blur">
                <button onClick={() => setSelected(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-3 py-1.5">Select all</button>
                <button onClick={() => setSelected([])} className="rounded-md bg-surface-elevated px-3 py-1.5">Clear</button>
                 <button onClick={() => { setSweep((s) => !s); setSwapping(false); setSwapSource(null); }} aria-pressed={sweep} title="Drag a finger across lights to select them"
                  className={`rounded-md px-3 py-1.5 font-semibold ${sweep ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>Sweep {sweep ? "on" : "off"}</button>
                 <Button variant="secondary" size="icon" aria-label="Keypad" aria-pressed={keypadOpen} title="Keypad — type e.g. 1 + 3 + 5 @ 80"
                   onClick={() => setKeypadOpen((o) => !o)} className={keypadOpen ? "bg-primary text-primary-foreground" : ""}><Keyboard className="h-4 w-4" /></Button>
                 <Button variant="secondary" aria-label="Record selected lights" title="REC — tap to record the selected lights, press and hold to open the REC editor"
                   onPointerDown={() => { recHold.current.fired = false; recHold.current.timer = setTimeout(() => { recHold.current.fired = true; navigator.vibrate?.(20); setRecEditor(true); }, 500); }}
                   onPointerUp={() => { if (recHold.current.timer) clearTimeout(recHold.current.timer); }} onPointerLeave={() => { if (recHold.current.timer) clearTimeout(recHold.current.timer); }}
                   onContextMenu={(e) => e.preventDefault()}
                   onClick={() => { if (!recHold.current.fired) setRecOpen(true); }} className="gap-1.5 px-3 text-xs font-bold select-none">
                   <span className={`h-2.5 w-2.5 rounded-full bg-destructive ${play ? "animate-pulse" : ""}`} />REC
                 </Button>
                 <Button variant="secondary" size="icon" aria-label={locked ? "Unlock patch" : "Lock patch"} aria-pressed={locked} onClick={() => setLocked((l) => !l)} title={locked ? "Patch locked — tap to unlock editing" : "Patch unlocked — tap to lock"} className={locked ? "" : "bg-amber-glow text-primary-foreground"}>
                   {locked ? <Lock /> : <Unlock />}
                 </Button>
                 <Button variant="secondary" size="icon" aria-label="Swap fixture positions" aria-pressed={swapping} title="Swap fixture positions"
                   onClick={() => { setSwapping((s) => !s); setSwapSource(null); setSweep(false); holdEnd(); }}
                   className={swapping ? "bg-primary text-primary-foreground" : ""}><ArrowLeftRight className="h-4 w-4" /></Button>
                <span>{selected.length} selected</span>
              </div>
              <div className="fixture-grid" style={sweep ? { touchAction: "none" } : undefined}
                onPointerDown={(e) => { if (!sweep) return; e.preventDefault(); swept.current = new Set(); sweepAt(e.clientX, e.clientY); }}
                onPointerMove={(e) => { if (sweep && swept.current && (e.buttons || e.pointerType === "touch")) sweepAt(e.clientX, e.clientY); }}
                onPointerUp={() => { swept.current = null; }}
                onPointerCancel={() => { swept.current = null; }}>
                {fixtures.map((f, i) => {
                  const def = getDef(f.defId);
                  const of = pulses[f.uid] ? (outFixtures.find((o) => o.uid === f.uid) ?? f) : f;
                  const color = fixtureColor(of, t, outLevel);
                  const isSel = selected.includes(f.uid);
                  const pix = frame.get(f.uid);
                  const pv = of.on === false ? 0 : of.intensity * outLevel;
                  const [gc, gr] = pixelGrid(f);
                  return (
                     <div key={f.uid} data-fixture={f.uid} role="button" aria-label={`${swapping ? "Swap" : "Select"} fixture ${i + 1}, ${f.name}`} aria-pressed={swapping ? swapSource === f.uid : isSel} tabIndex={0} onPointerDown={() => { if (!sweep && !swapping) holdStart(f.uid); }} onPointerUp={holdEnd} onPointerCancel={holdEnd} onClick={(e) => { if (swapping) swapTile(f.uid); else if (!sweep) tileClick(e, f.uid); }} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (swapping) swapTile(f.uid); else toggleSelect(f.uid); } if (e.key === "Escape") { setSwapSource(null); setSwapping(false); } }}
                       className={`relative flex aspect-square min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border bg-card p-1.5 text-left transition active:scale-95 ${swapping && swapSource === f.uid ? "border-primary bg-primary/15 ring-2 ring-primary" : isSel ? "border-primary bg-primary/5" : "border-border"}`}>
                      {f.label && <div className="absolute inset-x-0 top-0 h-1" style={{ background: f.label }} />}
                      <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1.5 z-10 rounded bg-surface-elevated/90 px-1 font-mono text-[9px] font-semibold leading-tight text-foreground/80">#{i + 1}</span>

                      <FixtureGlyph className="min-h-0 w-full flex-1" model={def.model} icon={f.icon} colour={color} pixels={pix?.map((c) => `rgb(${c[0]*pv},${c[1]*pv},${c[2]*pv})`)} />
                      <div className="flex shrink-0 items-center gap-1">
                        <div title={f.name} className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] font-semibold">
                          {f.label && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.label }} />}
                          {f.on === false && <Power className="h-3 w-3 shrink-0 text-destructive" />}{f.name}
                        </div>
                        <FixtureMenu f={f} fixtures={fixtures} locked={locked} groups={groups}
                          onChange={(p) => updateOne(f.uid, p)} onSplit={() => splitPixels(f)} onJoin={() => joinPixels(f)} onGroup={(g) => setGroup(f, g)}
                          level={outLevel} onPower={(p) => setFixtures((fs) => fs.map((x) => { if (x.uid !== f.uid) return x; const { power: _p, ...rest } = x; return p ? { ...rest, power: p } : rest; }))} />
                      </div>
                      <div className="flex shrink-0 justify-between gap-1 text-[9px] text-muted-foreground">
                        <span className="truncate">U{f.universe}.{f.address}</span>
                        <span className="font-mono">{Math.round(f.intensity * 100)}%</span>
                      </div>
                      {f.group && <div className="shrink-0 truncate text-[9px] text-primary">{f.group}</div>}
                      {f.power && (() => { const b = batteryStatus(f.power, f, outLevel); return (
                        <div title={`${fmtHours(b.hours)} left`} className={`flex shrink-0 items-center gap-1 text-[9px] font-semibold ${b.pct < 0.2 ? "text-destructive" : "text-success"}`}>
                          <BatteryMedium className="h-3 w-3" />{Math.round(b.pct * 100)}% · {fmtHours(b.hours)}
                        </div>); })()}
                      {f.fx.kind !== "none" && <div className={`shrink-0 truncate text-[9px] font-semibold uppercase ${f.fxPlaying === false ? "text-muted-foreground" : "text-amber-glow"}`}>{f.fxPlaying === false ? "■" : "▶"} {f.fx.kind}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {panelOpen && <aside className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
          {panel === "patch" ? (
            <PatchPanel fixtures={fixtures} onUpdate={updateOne} onAdd={(fs) => setFixtures((x) => [...x, ...fs])} onRemove={(uids) => { setFixtures((x) => x.filter((f) => !uids.includes(f.uid))); setSelected((s) => s.filter((id) => !uids.includes(id))); }} />
          ) : panel === "pixels" ? (
            <PixelPanel fixtures={fixtures} selected={selected} layers={layers} frame={frame} activeId={activePixelId} onActiveChange={setActivePixelId} setLayers={(next) => {
              const started = next.filter((l) => l.playing && !layers.find((o) => o.id === l.id)?.playing).flatMap((l) => l.order);
              if (started.length) setFixtures((fs) => fs.map((f) => (started.includes(f.uid) && (f.intensity === 0 || f.on === false) ? { ...f, intensity: f.intensity || 1, on: true } : f)));
              setLayers(next);
            }} />
          ) : sel.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tap lights to select and control them.</p>
          ) : (
            <FixtureControls fixtures={fixtures} sel={sel} update={updateSelected} updateEach={updateEach} fire={fire} locked={locked}
              onFlash={() => flashFixtures(selected)} copiedSource={copied?.name} onCopy={copySettings} onPaste={pasteSettings}
              remove={() => { if (!confirm("Remove selected fixtures from this scene?")) return; setFixtures((fs) => fs.filter((f) => !selected.includes(f.uid))); setSelected([]); }} />
          )}
        </aside>}
        {groupsOpen && (
          <aside aria-label="Groups and looks" className="max-h-[45vh] w-full shrink-0 space-y-4 overflow-auto border-t border-border bg-surface p-3 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
            <GroupsPanel fixtures={fixtures} selected={selected} onCreate={(g) => setFixtures((fs) => fs.map((x) => (selected.includes(x.uid) ? { ...x, group: g } : x)))}
              onSelect={(g) => { const ids = fixtures.filter((f) => f.group === g).map((f) => f.uid); setSelected((s) => ids.every((id) => s.includes(id)) ? s.filter((id) => !ids.includes(id)) : [...new Set([...s, ...ids])]); }} onRename={renameGroup} onUngroup={ungroup} onUpdate={updateGroup}
              onCopy={(from, to) => setFixtures((fs) => {
                const src = fs.find((x) => x.group === from);
                if (!src) return fs;
                const exists = fs.some((x) => x.group === to);
                const copy = { intensity: src.intensity, on: src.on !== false, cct: src.cct, gm: src.gm, hue: src.hue, saturation: src.saturation, crossfade: src.crossfade, cctOnly: src.cctOnly, fx: { ...src.fx }, fxPlaying: src.fxPlaying !== false };
                return fs.map((x) => (exists ? x.group === to : selected.includes(x.uid) && x.group !== from) ? { ...x, ...copy, ...(exists ? {} : { group: to }) } : x);
              })} />
            <div role="tablist" aria-label="Side bar" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-elevated p-1">
              {(["looks", "effects", "rec"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={railTab === k} onClick={() => setRailTab(k)} className={`rounded-md py-2 text-xs font-bold uppercase ${railTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{k === "rec" ? "REC" : k}</button>
              ))}
            </div>
            {railTab === "looks" && <LooksRail fixtures={fixtures} selected={selected} looks={project.looks ?? []} setLooks={onLooks} onRecall={recallLook} lastLook={lastLook} />}
            {railTab === "effects" && <EffectsRail fixture={sel[0]} layer={activePixel} onFixture={(fx) => updateSelected({ fx, fxPlaying: false })} onPixel={(saved) => {
              if (!activePixel) return;
              const order = sel.filter((f) => pixelCount(f) > 1).map((f) => f.uid);
              setLayers(layers.map((l) => l.id === activePixel.id ? { ...saved, id: l.id, order: order.length ? order : l.order, playing: false } : l));
            }} />}
            {railTab === "rec" && <RecRail recordings={recordings} setRecordings={onRecordings} selectedFixtures={sel} playing={play?.id ?? null} paused={play?.pausedAt != null} progress={recProg} waiting={play?.waiting} onGo={goRec} onPlay={playRec} onPause={pauseRec} onStop={stopRec} />}
          </aside>
        )}
      </div>
      {keypadOpen && <Keypad onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onDeselect={() => { setSelected([]); lastPick.current = null; }} count={fixtures.length} selectedNums={fixtures.map((f, i) => (selected.includes(f.uid) ? i + 1 : 0)).filter(Boolean)} onRun={runCommand} onStep={stepLight} onFlash={() => flashFixtures(selected)} onPreview={(nums) => { const ids = nums.map((n) => fixtures[n - 1]?.uid).filter((x): x is string => !!x); setSelected(ids); lastPick.current = ids[ids.length - 1] ?? null; }} onCopy={copySettings} onPaste={pasteSettings} canPaste={!!copied} onClose={() => setKeypadOpen(false)} />}
      {fadersOpen && <PlaybackBar fixtures={fixtures} selected={selected} groups={groups} looks={project.looks ?? []} bank={bank} setBank={onBank}
        flash={flash} setFlash={setFlash} solo={solo} setSolo={setSolo} cues={cues} setCues={onCues} activeCue={activeCue} fadeK={fadeK}
        onGo={() => cueStep(1)} onBack={() => cueStep(-1)} onGoto={gotoCue} onRecordCue={recordCue} onUpdateCueStates={updateCueStates} />}
    </div>
  );
}
