import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Lightbulb,
  LightbulbOff,
  Check,
  Folder,
  Clapperboard,
  Copy,
} from "lucide-react";
import {
  EFFECTS,
  FIXTURE_LIBRARY,
  createFixture,
  fixtureColor,
  type PatchedFixture,
} from "@/lib/dmx";
import {
  PROJECT_COLORS,
  loadProjects,
  saveProjects,
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
        onCreate={(name) => {
          const p: Project = {
            id: uid(),
            name,
            color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
            createdAt: Date.now(),
            scenes: [],
          };
          setProjects((ps) => [p, ...ps]);
        }}
        onDelete={(id) => setProjects((ps) => ps.filter((p) => p.id !== id))}
      />
    );
  }

  const project = projects.find((p) => p.id === view.projectId);
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
            fixtures: prev ? prev.fixtures.map((f) => ({ ...f, intensity: 0, effect: "none" })) : [],
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

function ProjectsScreen({ projects, onOpen, onCreate, onDelete }: { projects: Project[]; onOpen: (id: string) => void; onCreate: (n: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="min-h-screen">
      <Header title="CRMX Console" subtitle="Projects" />
      <main className="mx-auto max-w-5xl space-y-6 p-5">
        <NewItemForm placeholder="New project name (e.g. Commercial Day 1)" onCreate={onCreate} />
        {projects.length === 0 ? (
          <Empty icon={<Folder className="h-10 w-10" />} text="No projects yet. Create one to start patching lights." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} color={p.color} title={p.name} meta={`${p.scenes.length} scenes · ${fmtDate(p.createdAt)}`} onClick={() => onOpen(p.id)} onDelete={() => confirm(`Delete "${p.name}"?`) && onDelete(p.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- Scenes ---------------- */

function ScenesScreen({ project, onBack, onOpen, onCreate, onDuplicate, onDelete }: { project: Project; onBack: () => void; onOpen: (id: string) => void; onCreate: (n: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
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
              <Card
                key={s.id}
                color={project.color}
                title={s.name}
                meta={`${s.fixtures.length} fixtures · ${fmtDate(s.createdAt)}`}
                onClick={() => onOpen(s.id)}
                onDelete={() => confirm(`Delete "${s.name}"?`) && onDelete(s.id)}
                extra={
                  <button onClick={(e) => { e.stopPropagation(); onDuplicate(s.id); }} className="rounded-md p-2 text-muted-foreground hover:text-foreground" aria-label="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ color, title, meta, onClick, onDelete, extra }: { color: string; title: string; meta: string; onClick: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  return (
    <div onClick={onClick} className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 transition active:scale-[0.98] hover:border-primary/40">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
        <div className="flex">
          {extra}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-md p-2 text-muted-foreground hover:text-destructive" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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

function ConsoleScreen({ project, scene, onSave, onExit }: { project: Project; scene: Scene; onSave: (s: Scene) => void; onExit: () => void }) {
  const [fixtures, setFixtures] = useState<PatchedFixture[]>(scene.fixtures);
  const [master, setMaster] = useState(scene.master);
  const [blackout, setBlackout] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showPatch, setShowPatch] = useState(scene.fixtures.length === 0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [t, setT] = useState(0);

  // Animation clock for effects preview
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      setT((performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-save every 10 seconds + on exit
  const latest = useRef({ fixtures, master });
  latest.current = { fixtures, master };
  const save = () => onSave({ ...scene, fixtures: latest.current.fixtures, master: latest.current.master });
  useEffect(() => {
    const id = setInterval(() => {
      save();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exit = () => {
    save();
    onExit();
  };

  const defs = useMemo(() => Object.fromEntries(FIXTURE_LIBRARY.map((d) => [d.id, d])), []);
  const nextAddress = fixtures.reduce((max, f) => Math.max(max, f.address + (defs[f.defId]?.channels ?? 1)), 1);

  const updateSelected = (patch: Partial<PatchedFixture>) =>
    setFixtures((fs) => fs.map((f) => (selected.includes(f.uid) ? { ...f, ...patch } : f)));

  const sel = fixtures.filter((f) => selected.includes(f.uid));
  const first = sel[0];
  const firstDef = first ? defs[first.defId] : undefined;
  const hasColor = sel.some((f) => ["rgb", "rgbw"].includes(defs[f.defId]?.mode ?? ""));

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button onClick={exit} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Exit">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold">{scene.name}</div>
          <div className="truncate text-xs text-primary">{project.name}</div>
        </div>
        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 text-xs text-success transition-opacity ${savedFlash ? "opacity-100" : "opacity-0"}`}>
          <Check className="h-3.5 w-3.5" /> Auto-saved
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-glow">MASTER</span>
          <input type="range" min={0} max={1} step={0.01} value={master} onChange={(e) => setMaster(+e.target.value)} className="w-32 accent-[var(--color-amber-glow)] sm:w-44" />
          <span className="w-9 text-right font-mono text-xs">{Math.round(master * 100)}%</span>
        </div>
        <button
          onClick={() => setBlackout((b) => !b)}
          className={`rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${blackout ? "bg-destructive text-destructive-foreground" : "bg-surface-elevated"}`}
        >
          {blackout ? <LightbulbOff className="inline h-4 w-4" /> : <Lightbulb className="inline h-4 w-4" />} BLACKOUT
        </button>
        <button onClick={() => setShowPatch((v) => !v)} className={`rounded-lg px-3 py-2.5 text-xs font-bold active:scale-95 ${showPatch ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
          PATCH
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Fixtures grid */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {fixtures.length === 0 ? (
            <Empty icon={<Lightbulb className="h-10 w-10" />} text="No lights patched. Add fixtures from the patch library." />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <button onClick={() => setSelected(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-3 py-1.5">Select all</button>
                <button onClick={() => setSelected([])} className="rounded-md bg-surface-elevated px-3 py-1.5">Clear</button>
                <span>{selected.length} selected</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {fixtures.map((f) => {
                  const def = defs[f.defId];
                  const scaled = { ...f, intensity: blackout ? 0 : f.intensity * master };
                  const color = fixtureColor(scaled, def, t);
                  const isSel = selected.includes(f.uid);
                  return (
                    <button
                      key={f.uid}
                      onClick={() => toggleSelect(f.uid)}
                      className={`rounded-xl border-2 bg-card p-3 text-left transition active:scale-95 ${isSel ? "border-primary" : "border-transparent"}`}
                    >
                      <div className="mb-3 h-16 rounded-lg" style={{ background: color, boxShadow: `0 0 24px ${color}` }} />
                      <div className="truncate text-sm font-semibold">{f.name}</div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{def?.brand} · @{f.address}</span>
                        <span className="font-mono">{Math.round(f.intensity * 100)}%</span>
                      </div>
                      {f.effect !== "none" && <div className="mt-1 text-[10px] font-semibold uppercase text-amber-glow">{f.effect}</div>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <aside className="max-h-[50vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
          {showPatch ? (
            <div className="space-y-2">
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fixture library</h2>
              {FIXTURE_LIBRARY.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    const count = fixtures.filter((f) => f.defId === d.id).length + 1;
                    setFixtures((fs) => [...fs, createFixture(d, nextAddress, count)]);
                  }}
                  className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2.5 text-left text-sm active:scale-[0.98]"
                >
                  <span>
                    <span className="font-semibold">{d.brand}</span> {d.model}
                    <span className="block text-[11px] uppercase text-muted-foreground">{d.mode} · {d.channels} ch</span>
                  </span>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          ) : !first ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tap lights to select and control them.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {sel.length === 1 ? first.name : `${sel.length} fixtures`}
                </h2>
                <button
                  onClick={() => {
                    setFixtures((fs) => fs.filter((f) => !selected.includes(f.uid)));
                    setSelected([]);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {sel.length === 1 && (
                <div className="grid grid-cols-3 gap-2">
                  <input value={first.name} onChange={(e) => updateSelected({ name: e.target.value })} className="col-span-2 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" />
                  <input type="number" min={1} max={512} value={first.address} onChange={(e) => updateSelected({ address: Math.min(512, Math.max(1, +e.target.value)) })} className="rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" />
                </div>
              )}

              <Control label="Intensity" value={first.intensity} display={`${Math.round(first.intensity * 100)}%`} onChange={(v) => updateSelected({ intensity: v })} />

              <div className="flex gap-2">
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <button key={v} onClick={() => updateSelected({ intensity: v })} className="flex-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold active:scale-95">
                    {v * 100}
                  </button>
                ))}
              </div>

              {(!hasColor || firstDef?.mode === "rgbw") && (
                <Control label="CCT" value={first.cct} display={`${Math.round(2700 + first.cct * 3800)}K`} onChange={(v) => updateSelected({ cct: v })} gradient="linear-gradient(to right, rgb(255,169,87), rgb(200,220,255))" />
              )}

              {hasColor && (
                <>
                  <Control label="Hue" value={first.hue / 360} display={`${Math.round(first.hue)}°`} onChange={(v) => updateSelected({ hue: v * 360 })} gradient="linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" />
                  <Control label="Saturation" value={first.saturation} display={`${Math.round(first.saturation * 100)}%`} onChange={(v) => updateSelected({ saturation: v })} />
                </>
              )}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effect</div>
                <div className="grid grid-cols-3 gap-2">
                  {EFFECTS.map((e) => (
                    <button key={e.id} onClick={() => updateSelected({ effect: e.id })} className={`rounded-md py-2.5 text-xs font-semibold active:scale-95 ${first.effect === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {first.effect !== "none" && (
                <>
                  <Control label="Speed" value={first.effectSpeed} display={`${Math.round(first.effectSpeed * 100)}%`} onChange={(v) => updateSelected({ effectSpeed: v })} />
                  <Control label="Size" value={first.effectSize} display={`${Math.round(first.effectSize * 100)}%`} onChange={(v) => updateSelected({ effectSize: v })} />
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Control({ label, value, display, onChange, gradient }: { label: string; value: number; display: string; onChange: (v: number) => void; gradient?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono">{display}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-primary)]"
        style={{ background: gradient ?? "var(--color-surface-elevated)" }}
      />
    </div>
  );
}
