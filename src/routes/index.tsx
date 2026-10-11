import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { fixtureColor, getDef, type PatchedFixture, type TriggerKind } from "@/lib/dmx";
import { ItemMenu, ColorSwatches } from "@/components/console/ItemMenu";
import { PatchPanel } from "@/components/console/PatchPanel";
import { FixtureControls } from "@/components/console/FixtureControls";
import { PixelPanel } from "@/components/console/PixelPanel";
import { ConnectDialog } from "@/components/console/ConnectDialog";
import { defaultPixelMap, gridHeight, renderPixels, textMask, type PixelMap } from "@/lib/pixels";
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

  useEffect(() => {
    setProjects(loadProjects());
    setLoaded(true);
  }, []);

  // Immediate save on structural changes
  useEffect(() => {
    if (loaded) saveProjects(projects);
  }, [projects, loaded]);

  const updateProject = (id: string, fn: (p: Project) => Project) =>
    setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  if (!loaded) return <div className="min-h-screen bg-background" />;

  if (view.name === "projects") {
    return (
      <ProjectsScreen
        projects={projects}
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

function ProjectsScreen({ projects, onOpen, onCreate, onDelete, onUpdate, onDuplicate }: {
  projects: Project[]; onOpen: (id: string) => void; onCreate: (n: string, color: string) => void; onDelete: (id: string) => void;
  onUpdate: (id: string, fn: (p: Project) => Project) => void; onDuplicate: (id: string) => void;
}) {
  const [color, setColor] = useState(PROJECT_COLORS[0]!);
  return (
    <div className="min-h-screen">
      <Header title="CRMX Console" subtitle="Projects" />
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

function ConsoleScreen({ project, scene, onSave, onExit }: { project: Project; scene: Scene; onSave: (s: Scene) => void; onExit: () => void }) {
  const [fixtures, setFixtures] = useState<PatchedFixture[]>(scene.fixtures);
  const [master, setMaster] = useState(scene.master);
  const [blackout, setBlackout] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>("patch");
  const [panelOpen, setPanelOpen] = useState(true);
  const [pm, setPm] = useState<PixelMap>(() => ({ ...defaultPixelMap(), ...(scene.pixelMap ?? {}), playing: false }));
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

  const latest = useRef({ fixtures, master, pm });
  latest.current = { fixtures, master, pm };
  const save = () => onSave({ ...scene, fixtures: latest.current.fixtures.map((f) => ({ ...f, trigger: null })), master: latest.current.master, pixelMap: latest.current.pm });

  const textH = gridHeight(pm, fixtures);
  const mask = useMemo(() => (pm.kind === "text" ? textMask(pm.text.toUpperCase(), textH) : null), [pm.kind, pm.text, textH]);
  const frame = pm.playing ? renderPixels(pm, fixtures, t, mask) : new Map<string, [number, number, number][]>();
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

  const fire = (kind: TriggerKind) => {
    const targets = selected.length ? selected : fixtures.map((f) => f.uid);
    const now = clock.current;
    setFixtures((fs) => fs.map((f) => (targets.includes(f.uid) ? { ...f, trigger: { kind, at: now + (kind === "lightning" ? Math.random() * 0.25 : 0) } } : f)));
  };

  const sel = fixtures.filter((f) => selected.includes(f.uid));
  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setPanel("control");
    setPanelOpen(true);
  };
  // tapping the active tab again collapses / expands the side panel
  const tab = (p: Panel, label: string) => (
    <button onClick={() => { if (panel === p) setPanelOpen((o) => !o); else { setPanel(p); setPanelOpen(true); } }}
      className={`rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${panel === p && panelOpen ? "bg-primary text-primary-foreground" : panel === p ? "bg-primary/30" : "bg-surface-elevated"}`}>{label} {panel === p ? (panelOpen ? "▾" : "▸") : ""}</button>
  );

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
        <button onClick={() => setBlackout((b) => !b)} className={`rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${blackout ? "bg-destructive text-destructive-foreground" : "bg-surface-elevated"}`}>
          {blackout ? <LightbulbOff className="inline h-4 w-4" /> : <Lightbulb className="inline h-4 w-4" />} BLACKOUT
        </button>
        {tab("patch", "PATCH")}
        {tab("control", "CONTROL")}
        {tab("pixels", "PIXELS")}
        <button onClick={() => setConnOpen(true)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${conn.node ? "bg-success text-primary-foreground" : "bg-surface-elevated"}`}>
          <Radio className="h-4 w-4" />{conn.node ? conn.node.ip : "CONNECT"}
        </button>
      </div>

      <ConnectDialog open={connOpen} onOpenChange={setConnOpen} conn={conn} setConn={setConn} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {fixtures.length === 0 ? (
            <Empty icon={<Lightbulb className="h-10 w-10" />} text="No lights patched. Choose a manufacturer, model and mode in the patch panel." />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <button onClick={() => setSelected(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-3 py-1.5">Select all</button>
                <button onClick={() => setSelected([])} className="rounded-md bg-surface-elevated px-3 py-1.5">Clear</button>
                <span>{selected.length} selected</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {fixtures.map((f) => {
                  const def = getDef(f.defId);
                  const color = fixtureColor(f, t, blackout ? 0 : master);
                  const isSel = selected.includes(f.uid);
                  const pix = frame.get(f.uid);
                  const pv = f.on === false || blackout ? 0 : f.intensity * master;
                  return (
                    <button key={f.uid} onClick={() => toggleSelect(f.uid)} className={`rounded-xl border-2 bg-card p-3 text-left transition active:scale-95 ${isSel ? "border-primary" : "border-transparent"}`}>
                      {pix ? (
                        <div className="mb-3 flex h-16 gap-px overflow-hidden rounded-lg bg-background">
                          {pix.map((c, i) => <div key={i} className="flex-1" style={{ background: `rgb(${c[0] * pv},${c[1] * pv},${c[2] * pv})` }} />)}
                        </div>
                      ) : (
                        <div className="mb-3 h-16 rounded-lg" style={{ background: color, boxShadow: `0 0 24px ${color}` }} />
                      )}
                      <div className="flex items-center gap-1 truncate text-sm font-semibold">{f.on === false && <Power className="h-3 w-3 shrink-0 text-destructive" />}{f.name}</div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">{def.brand} · U{f.universe}.{f.address}</span>
                        <span className="font-mono">{Math.round(f.intensity * 100)}%</span>
                      </div>
                      {f.fx.kind !== "none" && <div className={`mt-1 text-[10px] font-semibold uppercase ${f.fxPlaying === false ? "text-muted-foreground" : "text-amber-glow"}`}>{f.fxPlaying === false ? "■" : "▶"} {f.fx.kind}</div>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {panelOpen && <aside className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
          {panel === "patch" ? (
            <PatchPanel fixtures={fixtures} onAdd={(fs) => setFixtures((x) => [...x, ...fs])} />
          ) : panel === "pixels" ? (
            <PixelPanel fixtures={fixtures} pm={pm} setPm={setPm} frame={frame} />
          ) : sel.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tap lights to select and control them.</p>
          ) : (
            <FixtureControls fixtures={fixtures} sel={sel} update={updateSelected} fire={fire}
              remove={() => { setFixtures((fs) => fs.filter((f) => !selected.includes(f.uid))); setSelected([]); }} />
          )}
        </aside>}
      </div>
    </div>
  );
}
