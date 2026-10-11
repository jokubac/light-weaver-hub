import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pullAndMerge, pushProjects, pushUserData, useUser } from "@/lib/cloud";
import { LogIn, LogOut, Cloud, Map as MapIcon } from "lucide-react";
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
import { fixtureColor, fixtureState, getDef, getMode, type PatchedFixture, type TriggerKind } from "@/lib/dmx";
import { ItemMenu, ColorSwatches } from "@/components/console/ItemMenu";
import { PatchPanel } from "@/components/console/PatchPanel";
import { FixtureControls } from "@/components/console/FixtureControls";
import { PixelPanel } from "@/components/console/PixelPanel";
import { GroupsPanel } from "@/components/console/GroupsPanel";
import { buildUniverses, createSender, type BridgeStatus } from "@/lib/output";
import { ConnectDialog } from "@/components/console/ConnectDialog";
import { FixtureMenu } from "@/components/console/FixtureMenu";
import { SettingsDialog, type BtDevice } from "@/components/console/SettingsDialog";
import { batteryStatus, drawFactor, fmtHours } from "@/lib/power";
import { listenMidi, loadMidi, saveMidi, type MidiMsg } from "@/lib/midi";
import { Settings as SettingsIcon, BatteryMedium } from "lucide-react";
import { LooksPanel, applyLook } from "@/components/console/LooksPanel";
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
      { title: "CRMX Console — DMX lighting control for film sets" },
      {
        name: "description",
        content: "Control ARRI, Aputure, Nanlite and Astera lights with scenes, effects and auto-save.",
      },
      { property: "og:title", content: "CRMX Console — DMX lighting control" },
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
    />
  );
}

/* ---------------- Shared bits ---------------- */

function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
      {onBack && (
        <button onClick={onBack} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-primary">{subtitle}</p>}
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
  if (!email) return <Link to="/auth" className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground"><LogIn className="h-4 w-4" />Sign in</Link>;
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
      <Header title="CRMX Console" subtitle="Projects" right={account} />
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

type Panel = "patch" | "control" | "pixels" | "groups" | "looks";
type RGB = [number, number, number];
const FADE = 2; // blackout fade time in seconds

function ConsoleScreen({ project, scene, onSave, onExit, onLooks }: {
  project: Project; scene: Scene; onSave: (s: Scene) => void; onExit: () => void; onLooks: (l: Look[]) => void;
}) {
  const [fixtures, setFixtures] = useState<PatchedFixture[]>(scene.fixtures);
  const [master, setMaster] = useState(scene.master);
  const [bo, setBo] = useState<{ target: 0 | 1; at: number; from: number }>({ target: 0, at: -10, from: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>("patch");
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
  const [t, setT] = useState(0);
  const clock = useRef(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
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
  const save = () => {
    const { pixelMap: _legacy, ...rest } = scene;
    onSave({ ...rest, fixtures: latest.current.fixtures.map((f) => ({ ...f, trigger: null })), master: latest.current.master, pixelLayers: latest.current.layers, plot: latest.current.plot });
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
    if (conn.node) void sender(conn, buildUniverses(fixtures, t, outLevel, frame, conn));
  });

  // Battery drain: integrate each light's draw every 5 s
  const outRef = useRef(outLevel);
  outRef.current = outLevel;
  useEffect(() => {
    const id = setInterval(() => {
      setFixtures((fs) => fs.some((f) => f.power) ? fs.map((f) => (f.power ? { ...f, power: { ...f.power, usedWh: f.power.usedWh + (f.power.watts * drawFactor(f, outRef.current) * 5) / 3600 } } : f)) : fs);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Settings: Bluetooth + MIDI
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bt, setBt] = useState<BtDevice[]>([]);
  const connectBt = async () => {
    const nb = (navigator as Navigator & { bluetooth?: { requestDevice: (o: object) => Promise<any> } }).bluetooth;
    if (!nb) { alert("This browser can't use Bluetooth. Use Chrome or Edge (Android, Windows, Mac)."); return; }
    try {
      const dev = await nb.requestDevice({ acceptAllDevices: true, optionalServices: ["battery_service", "device_information"] });
      const entry: BtDevice = { id: dev.id, name: dev.name || "Bluetooth device", battery: null };
      setBt((b) => [...b.filter((x) => x.id !== dev.id), entry]);
      const server = await dev.gatt.connect();
      try {
        const ch = await (await server.getPrimaryService("battery_service")).getCharacteristic("battery_level");
        const set = (v: number) => setBt((b) => b.map((x) => (x.id === dev.id ? { ...x, battery: v } : x)));
        set((await ch.readValue()).getUint8(0));
        await ch.startNotifications().catch(() => {});
        ch.addEventListener("characteristicvaluechanged", (e: any) => set(e.target.value.getUint8(0)));
      } catch { /* device has no standard battery service */ }
    } catch { /* user cancelled */ }
  };

  const [midi, setMidiState] = useState(() => ({ enabled: false, maps: [] as ReturnType<typeof loadMidi>["maps"] }));
  useEffect(() => { setMidiState(loadMidi()); }, []);
  const setMidi = (m: typeof midi) => { setMidiState(m); saveMidi(m); };
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
    const id = setInterval(() => {
      save();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    if (panel !== "looks" && panel !== "groups") { setPanel("control"); setPanelOpen(true); }
  };
  // tapping the active tab again collapses / expands the side panel
  const tab = (p: Panel, label: string) => (
    <button onClick={() => { if (panel === p) setPanelOpen((o) => !o); else { setPanel(p); setPanelOpen(true); } }}
      className={`rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${panel === p && panelOpen ? "bg-primary text-primary-foreground" : panel === p ? "bg-primary/30" : "bg-surface-elevated"}`}>{label} {panel === p ? (panelOpen ? "▾" : "▸") : ""}</button>
  );
  const boActive = bo.target === 1 || boLevel > 0;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button onClick={exit} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Exit"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold">{scene.name}</div>
          <div className="truncate text-xs" style={{ color: project.color }}>{project.name}</div>
        </div>
        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 text-xs text-success transition-opacity ${savedFlash ? "opacity-100" : "opacity-0"}`}><Check className="h-3.5 w-3.5" /> Auto-saved</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-glow">MASTER</span>
          <input type="range" min={0} max={1} step={0.01} value={master} onChange={(e) => setMaster(+e.target.value)} className="w-28 accent-[var(--color-amber-glow)] sm:w-40" />
          <span className="w-9 text-right font-mono text-xs">{Math.round(master * 100)}%</span>
        </div>
        <button onClick={toggleBlackout} className={`relative overflow-hidden rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${bo.target ? "bg-destructive text-destructive-foreground" : "bg-surface-elevated"}`}>
          {boActive ? <LightbulbOff className="inline h-4 w-4" /> : <Lightbulb className="inline h-4 w-4" />} BLACKOUT
          {boK < 1 && <span className="absolute bottom-0 left-0 h-0.5 bg-amber-glow" style={{ width: `${boK * 100}%` }} />}
        </button>
        <button onClick={() => setLocked((l) => !l)} title={locked ? "Patch locked — tap to unlock editing" : "Patch unlocked — tap to lock"}
          className={`flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${locked ? "bg-surface-elevated" : "bg-amber-glow text-primary-foreground"}`}>
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}{locked ? "LOCKED" : "UNLOCKED"}
        </button>
        {tab("patch", "PATCH")}
        {tab("control", "CONTROL")}
        {tab("pixels", "PIXELS")}
        {tab("groups", "GROUPS")}
        {tab("looks", "LOOKS")}
        <button onClick={() => setPlotOpen(true)} className="flex items-center gap-1 rounded-lg bg-surface-elevated px-3 py-2.5 text-xs font-bold active:scale-95"><MapIcon className="h-4 w-4" />PLOT</button>
        <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-surface-elevated p-2.5 active:scale-95" aria-label="Settings"><SettingsIcon className="h-4 w-4" /></button>
        <button onClick={() => setConnOpen(true)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${conn.node ? (bridge === "error" ? "bg-destructive text-destructive-foreground" : "bg-success text-primary-foreground") : "bg-surface-elevated"}`}>
          <Radio className="h-4 w-4" />{conn.node ? (bridge === "error" ? "NO BRIDGE" : conn.node.ip) : "CONNECT"}
        </button>
      </div>

      {plotOpen && (
        <PlotPanel plot={plot} setPlot={setPlot} fixtures={fixtures} selected={selected} setSelected={setSelected} update={updateOne}
          colorOf={(f) => { const px = frame.get(f.uid); if (px?.length) { const n = px.length; return [0, 1, 2].map((k) => Math.round(px.reduce((a, c) => a + c[k]!, 0) / n)) as RGB; } return fixtureState(f, t, outLevel).rgb.map(Math.round) as RGB; }}
          levelOf={(f) => (frame.get(f.uid) ? (f.on === false ? 0 : f.intensity * outLevel) : fixtureState(f, t, outLevel).v)}
          onClose={() => { setPlotOpen(false); save(); }} onOpenControls={() => { setPlotOpen(false); setPanel("control"); setPanelOpen(true); }} />
      )}
      <ConnectDialog open={connOpen} onOpenChange={setConnOpen} conn={conn} setConn={setConn} status={bridge} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} bt={bt} connectBt={connectBt} midi={midi} setMidi={setMidi}
        learning={learning} setLearning={setLearning} lastMsg={lastMsg} midiDevices={midiDevices} midiError={midiError}
        targets={[
          { id: "master", label: "Master fader" }, { id: "blackout", label: "Blackout" },
          { id: "trig:lightning", label: "Trigger: lightning" }, { id: "trig:flash", label: "Trigger: flash" },
          ...groups.map((g) => ({ id: `group:${g}`, label: `Group "${g}" intensity` })),
          ...(project.looks ?? []).map((l) => ({ id: `look:${l.id}`, label: `Look: ${l.name}` })),
          ...fixtures.flatMap((f) => [
            { id: `int:${f.uid}`, label: `${f.name} — intensity` }, { id: `on:${f.uid}`, label: `${f.name} — on/off` }, { id: `fx:${f.uid}`, label: `${f.name} — play/stop effect` },
          ]),
        ]} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {fixtures.length === 0 ? (
            <Empty icon={<Lightbulb className="h-10 w-10" />} text="No lights patched. Choose a manufacturer, model and mode in the patch panel." />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <button onClick={() => setSelected(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-3 py-1.5">Select all</button>
                <button onClick={() => setSelected([])} className="rounded-md bg-surface-elevated px-3 py-1.5">Clear</button>
                <span>{selected.length} selected</span>
                {groups.map((g) => (
                  <span key={g} className="flex items-center overflow-hidden rounded-md bg-primary/15 text-foreground">
                    <button onClick={() => { setSelected(fixtures.filter((f) => f.group === g).map((f) => f.uid)); setPanel("control"); setPanelOpen(true); }} className="px-3 py-1.5 font-semibold">{g} ({fixtures.filter((f) => f.group === g).length})</button>
                    <button onClick={() => ungroup(g)} className="px-1.5 py-1.5 text-muted-foreground hover:text-destructive" aria-label={`Ungroup ${g}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {fixtures.map((f) => {
                  const def = getDef(f.defId);
                  const color = fixtureColor(f, t, outLevel);
                  const isSel = selected.includes(f.uid);
                  const pix = frame.get(f.uid);
                  const pv = f.on === false ? 0 : f.intensity * outLevel;
                  const [gc, gr] = pixelGrid(f);
                  return (
                    <div key={f.uid} role="button" tabIndex={0} onClick={() => toggleSelect(f.uid)} onKeyDown={(e) => e.key === "Enter" && toggleSelect(f.uid)}
                      className={`relative cursor-pointer overflow-hidden rounded-xl border-2 bg-card p-3 text-left transition active:scale-95 ${isSel ? "border-primary" : "border-transparent"}`}>
                      {f.label && <div className="absolute inset-x-0 top-0 h-1" style={{ background: f.label }} />}
                      {pix ? (
                        <div className="mb-3 grid h-16 gap-px overflow-hidden rounded-lg bg-background" style={{ gridTemplateColumns: `repeat(${gc}, 1fr)`, gridTemplateRows: `repeat(${gr}, 1fr)` }}>
                          {pix.map((c, i) => <div key={i} style={{ background: `rgb(${c[0] * pv},${c[1] * pv},${c[2] * pv})` }} />)}
                        </div>
                      ) : (
                        <div className="mb-3 h-16 rounded-lg" style={{ background: color, boxShadow: `0 0 24px ${color}` }} />
                      )}
                      <div className="flex items-center gap-1">
                        <div className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-semibold">
                          {f.label && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.label }} />}
                          {f.on === false && <Power className="h-3 w-3 shrink-0 text-destructive" />}{f.name}
                        </div>
                        <FixtureMenu f={f} fixtures={fixtures} locked={locked} groups={groups}
                          onChange={(p) => updateOne(f.uid, p)} onSplit={() => splitPixels(f)} onJoin={() => joinPixels(f)} onGroup={(g) => setGroup(f, g)}
                          level={outLevel} onPower={(p) => setFixtures((fs) => fs.map((x) => { if (x.uid !== f.uid) return x; const { power: _p, ...rest } = x; return p ? { ...rest, power: p } : rest; }))} />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">{def.brand} · U{f.universe}.{f.address}</span>
                        <span className="font-mono">{Math.round(f.intensity * 100)}%</span>
                      </div>
                      {f.group && <div className="truncate text-[10px] text-primary">{f.group}</div>}
                      {f.power && (() => { const b = batteryStatus(f.power, f, outLevel); return (
                        <div className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${b.pct < 0.2 ? "text-destructive" : "text-success"}`}>
                          <BatteryMedium className="h-3 w-3" />{Math.round(b.pct * 100)}% · {fmtHours(b.hours)} left
                        </div>); })()}
                      {f.fx.kind !== "none" && <div className={`mt-1 text-[10px] font-semibold uppercase ${f.fxPlaying === false ? "text-muted-foreground" : "text-amber-glow"}`}>{f.fxPlaying === false ? "■" : "▶"} {f.fx.kind}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {panelOpen && <aside className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
          {panel === "patch" ? (
            <PatchPanel fixtures={fixtures} onAdd={(fs) => setFixtures((x) => [...x, ...fs])} />
          ) : panel === "looks" ? (
            <LooksPanel fixtures={fixtures} selected={selected} looks={project.looks ?? []} setLooks={onLooks} onRecall={recallLook} lastLook={lastLook} />
          ) : panel === "groups" ? (
            <GroupsPanel fixtures={fixtures} selected={selected} onCreate={(g) => setFixtures((fs) => fs.map((x) => (selected.includes(x.uid) ? { ...x, group: g } : x)))}
              onSelect={(g) => setSelected(fixtures.filter((f) => f.group === g).map((f) => f.uid))} onRename={renameGroup} onUngroup={ungroup} onUpdate={updateGroup}
              onCopy={(from, to) => setFixtures((fs) => {
                const src = fs.find((x) => x.group === from);
                if (!src) return fs;
                const exists = fs.some((x) => x.group === to);
                const copy = { intensity: src.intensity, on: src.on !== false, cct: src.cct, gm: src.gm, hue: src.hue, saturation: src.saturation, crossfade: src.crossfade, cctOnly: src.cctOnly, fx: { ...src.fx }, fxPlaying: src.fxPlaying !== false };
                return fs.map((x) => (exists ? x.group === to : selected.includes(x.uid) && x.group !== from) ? { ...x, ...copy, ...(exists ? {} : { group: to }) } : x);
              })} />
          ) : panel === "pixels" ? (
            <PixelPanel fixtures={fixtures} layers={layers} frame={frame} setLayers={(next) => {
              const started = next.filter((l) => l.playing && !layers.find((o) => o.id === l.id)?.playing).flatMap((l) => l.order);
              if (started.length) setFixtures((fs) => fs.map((f) => (started.includes(f.uid) && (f.intensity === 0 || f.on === false) ? { ...f, intensity: f.intensity || 1, on: true } : f)));
              setLayers(next);
            }} />
          ) : sel.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tap lights to select and control them.</p>
          ) : (
            <FixtureControls fixtures={fixtures} sel={sel} update={updateSelected} updateEach={updateEach} fire={fire} locked={locked}
              remove={() => { setFixtures((fs) => fs.filter((f) => !selected.includes(f.uid))); setSelected([]); }} />
          )}
        </aside>}
      </div>
    </div>
  );
}
