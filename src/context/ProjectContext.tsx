import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { COMPANIES, type Project, type ProjectFinding, type ProjectReview, type ProjectTask } from '../types';
import { apiFetch } from '../lib/api';

const EMPTY_SCOPE: Project['scope'] = {
  businessUnits: [],
  systems: [],
  assets: [],
  frameworks: [],
  controls: [],
  policies: [],
  vendors: [],
};

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  error: string | null;
  companies: Project['company'][];
  refreshProjects: () => Promise<void>;
  addProject: (
    p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'reviews' | 'findings' | 'progress'> & {
      controlIds?: string[];
    },
  ) => Promise<Project | null>;
  updateProject: (id: string, d: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addProjectTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => Promise<void>;
  updateProjectTask: (projectId: string, taskId: string, d: Partial<ProjectTask>) => Promise<void>;
  addProjectReview: (projectId: string, review: Omit<ProjectReview, 'id' | 'reviewedAt'>) => Promise<void>;
  addProjectFinding: (projectId: string, finding: Omit<ProjectFinding, 'id'>) => Promise<void>;
  updateProjectFinding: (projectId: string, findingId: string, d: Partial<ProjectFinding>) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

function genId() {
  return crypto.randomUUID();
}

function normalizeProject(raw: Project): Project {
  return {
    ...raw,
    company: (raw.company || 'NovaPay LLC') as Project['company'],
    team: Array.isArray(raw.team) ? raw.team : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    findings: Array.isArray(raw.findings) ? raw.findings : [],
    scope: raw.scope
      ? {
          businessUnits: raw.scope.businessUnits || [],
          systems: raw.scope.systems || [],
          assets: raw.scope.assets || [],
          frameworks: raw.scope.frameworks || [],
          controls: raw.scope.controls || [],
          policies: raw.scope.policies || [],
          vendors: raw.scope.vendors || [],
        }
      : { ...EMPTY_SCOPE },
    progress: Number(raw.progress) || 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(raw.createdAt).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(raw.updatedAt).toISOString(),
  };
}

/** Body fields the PATCH /api/projects/:id handler accepts. */
function buildPatchBody(d: Partial<Project>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const scalars = [
    'title',
    'company',
    'type',
    'framework',
    'status',
    'description',
    'owner',
    'startDate',
    'targetDate',
    'completedAt',
    'progress',
  ] as const;
  for (const key of scalars) {
    if (d[key] !== undefined) body[key] = d[key];
  }
  if (d.team !== undefined) body.team = d.team;
  if (d.scope !== undefined) body.scope = d.scope;
  if (d.tasks !== undefined) body.tasks = d.tasks;
  if (d.reviews !== undefined) body.reviews = d.reviews;
  if (d.findings !== undefined) body.findings = d.findings;
  return body;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/projects');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load projects');
      }
      const data = (await res.json()) as Project[];
      setProjects(data.map(normalizeProject));
      // Drop legacy browser-only cache so reports/audit cannot mix sources.
      try {
        localStorage.removeItem('grc-projects');
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const companies = useMemo(() => {
    const fromApi = [...new Set(projects.map(p => p.company))];
    return (fromApi.length ? fromApi : COMPANIES) as Project['company'][];
  }, [projects]);

  const patchProject = useCallback(
    async (id: string, d: Partial<Project>) => {
      const res = await apiFetch(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPatchBody(d)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update project');
      }
      const updated = normalizeProject((await res.json()) as Project);
      setProjects(prev => prev.map(p => (p.id === id ? updated : p)));
      return updated;
    },
    [],
  );

  const updateProject = useCallback(
    async (id: string, d: Partial<Project>) => {
      const current = projects.find(p => p.id === id);
      if (!current) return;

      // Optimistic UI for snappy stage/task edits
      const optimistic = normalizeProject({
        ...current,
        ...d,
        updatedAt: new Date().toISOString(),
      });
      setProjects(prev => prev.map(p => (p.id === id ? optimistic : p)));

      try {
        await patchProject(id, d);
      } catch (err) {
        console.error(err);
        await refreshProjects();
        throw err;
      }
    },
    [projects, patchProject, refreshProjects],
  );

  const addProject = useCallback(
    async (
      p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'reviews' | 'findings' | 'progress'> & {
        controlIds?: string[];
      },
    ) => {
      try {
        const res = await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify(p),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create project');
        }
        const created = normalizeProject((await res.json()) as Project);
        setProjects(prev => [created, ...prev]);
        return created;
      } catch (err) {
        console.error(err);
        return null;
      }
    },
    [],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete project');
      }
      setProjects(prev => prev.filter(p => p.id !== id));
    },
    [],
  );

  const withProject = useCallback(
    async (projectId: string, mutate: (p: Project) => Partial<Project>) => {
      const current = projects.find(p => p.id === projectId);
      if (!current) return;
      await updateProject(projectId, mutate(current));
    },
    [projects, updateProject],
  );

  const addProjectTask = useCallback(
    (projectId: string, task: Omit<ProjectTask, 'id'>) =>
      withProject(projectId, p => ({
        tasks: [...p.tasks, { ...task, id: genId() } as ProjectTask],
      })),
    [withProject],
  );

  const updateProjectTask = useCallback(
    (projectId: string, taskId: string, d: Partial<ProjectTask>) =>
      withProject(projectId, p => ({
        tasks: p.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                ...d,
                completedAt: d.status === 'completed' ? new Date().toISOString() : t.completedAt,
              }
            : t,
        ),
      })),
    [withProject],
  );

  const addProjectReview = useCallback(
    (projectId: string, review: Omit<ProjectReview, 'id' | 'reviewedAt'>) =>
      withProject(projectId, p => ({
        reviews: [
          ...p.reviews,
          { ...review, id: genId(), reviewedAt: new Date().toISOString() } as ProjectReview,
        ],
      })),
    [withProject],
  );

  const addProjectFinding = useCallback(
    (projectId: string, finding: Omit<ProjectFinding, 'id'>) =>
      withProject(projectId, p => ({
        findings: [...p.findings, { ...finding, id: genId() } as ProjectFinding],
      })),
    [withProject],
  );

  const updateProjectFinding = useCallback(
    (projectId: string, findingId: string, d: Partial<ProjectFinding>) =>
      withProject(projectId, p => ({
        findings: p.findings.map(f => (f.id === findingId ? { ...f, ...d } : f)),
      })),
    [withProject],
  );

  const value = useMemo(
    () => ({
      projects,
      loading,
      error,
      companies,
      refreshProjects,
      addProject,
      updateProject,
      deleteProject,
      addProjectTask,
      updateProjectTask,
      addProjectReview,
      addProjectFinding,
      updateProjectFinding,
    }),
    [
      projects,
      loading,
      error,
      companies,
      refreshProjects,
      addProject,
      updateProject,
      deleteProject,
      addProjectTask,
      updateProjectTask,
      addProjectReview,
      addProjectFinding,
      updateProjectFinding,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
