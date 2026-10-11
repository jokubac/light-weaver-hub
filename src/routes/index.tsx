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
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { fixtureColor, getDef, type PatchedFixture, type TriggerKind } from "@/lib/dmx";
import { ItemMenu, ColorSwatches } from "@/components/console/ItemMenu";
import { PatchPanel } from "@/components/console/PatchPanel";
import { FixtureControls } from "@/components/console/FixtureControls";
import { PixelPanel } from "@/components/console/PixelPanel";
import { ConnectDialog } from "@/components/console/ConnectDialog";
import { FixtureMenu } from "@/components/console/FixtureMenu";
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

