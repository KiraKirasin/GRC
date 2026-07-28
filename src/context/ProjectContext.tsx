import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, ProjectTask, ProjectReview, ProjectFinding } from '../types';

interface ProjectContextType {
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'reviews' | 'findings' | 'progress'>) => Promise<Project | null>;
  companies: Project['company'][];
  updateProject: (id: string, d: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addProjectTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => void;
  updateProjectTask: (projectId: string, taskId: string, d: Partial<ProjectTask>) => void;
  addProjectReview: (projectId: string, review: Omit<ProjectReview, 'id' | 'reviewedAt'>) => void;
  addProjectFinding: (projectId: string, finding: Omit<ProjectFinding, 'id'>) => void;
  updateProjectFinding: (projectId: string, findingId: string, d: Partial<ProjectFinding>) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
const API = import.meta.env.VITE_API_URL || '';

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

const EMPTY_SCOPE = { businessUnits: [], systems: [], assets: [], frameworks: [], controls: [], policies: [], vendors: [] };

const SEED_PROJECTS: Project[] = [
  {
    id: genId(), company: 'NovaPay LLC', title: 'ISO 27001:2026 Internal Audit', type: 'audit', framework: 'ISO 27001',
    status: 'execution', description: 'Annual internal audit of ISMS against ISO 27001:2022 standard',
    owner: 'Maria Koval', team: ['Ivan Petrenko', 'Dmytro Kovalenko'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['IT', 'Security', 'HR'], systems: ['NovaPay Core', 'SIEM', 'IDM'], assets: ['Servers', 'Databases', 'Endpoints'], frameworks: ['ISO 27001'], controls: ['A.5', 'A.6', 'A.7', 'A.8', 'A.9'], policies: ['IS Policy', 'Access Policy'], vendors: ['AWS', 'Cloudflare'] },
    tasks: [
      { id: genId(), title: 'Review A.5 Information Security Policies', description: 'Verify policy documents are current', status: 'completed', assignee: 'Ivan Petrenko', dueDate: '2026-07-15', evidence: ['IS_Policy_v3.pdf', 'Policy_Review_Report.pdf'], evidenceLinks: [], controlRef: 'A.5' },
      { id: genId(), title: 'Test A.9 Access Controls', description: 'Verify RBAC, MFA, and access reviews', status: 'in_progress', assignee: 'Dmytro Kovalenko', dueDate: '2026-07-30', evidence: ['Access_Review_Q2.xlsx'], evidenceLinks: ['https://novapay-idm/audit-log'], controlRef: 'A.9' },
      { id: genId(), title: 'Verify A.16 Incident Management', description: 'Review incident logs and response times', status: 'open', assignee: 'Maria Koval', dueDate: '2026-08-10', evidence: [], evidenceLinks: [], controlRef: 'A.16' },
    ],
    reviews: [], findings: [
      { id: genId(), title: 'Outdated network diagram', severity: 'low', status: 'open', description: 'Network diagram does not reflect recent segmentation changes', remediation: 'Update network diagram and re-validate', controlRef: 'A.13' },
    ],
    startDate: '2026-07-01', targetDate: '2026-08-30', progress: 45, createdAt: '2026-06-15T10:00:00Z', updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: genId(), company: 'NovaPay LLC', title: 'PCI DSS 4.0 Implementation', type: 'implementation', framework: 'PCI DSS 4.0',
    status: 'execution', description: 'Implement required controls for PCI DSS 4.0 compliance',
    owner: 'Ivan Petrenko', team: ['Dmytro Kovalenko', 'Andriy Bondar'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['IT', 'Security'], systems: ['Payment Gateway', 'CDE'], assets: ['CDE Servers', 'Firewalls'], frameworks: ['PCI DSS 4.0'], controls: ['Req 1', 'Req 2', 'Req 3', 'Req 4', 'Req 7', 'Req 8', 'Req 10'], policies: ['PCI Policy', 'Encryption Policy'], vendors: ['Stripe', 'AWS'] },
    tasks: [
      { id: genId(), title: 'Implement Req 1: Network Segmentation', description: 'Isolate CDE from corporate network', status: 'completed', assignee: 'Dmytro Kovalenko', dueDate: '2026-06-30', evidence: ['Network_Diagram_CDE.pdf', 'FW_Rules_CDE.txt'], evidenceLinks: ['https://novapay-netops/cde-segment'], controlRef: 'Req 1' },
      { id: genId(), title: 'Implement Req 3: PAN Encryption', description: 'Encrypt stored PAN with AES-256', status: 'in_progress', assignee: 'Dmytro Kovalenko', dueDate: '2026-08-01', evidence: ['Encryption_Config.pdf'], evidenceLinks: [], controlRef: 'Req 3' },
      { id: genId(), title: 'Deploy MFA for CDE Access', description: 'Enforce MFA for all CDE administrative access', status: 'open', assignee: 'Ivan Petrenko', dueDate: '2026-08-15', evidence: [], evidenceLinks: [], controlRef: 'Req 8' },
    ],
    reviews: [], findings: [],
    startDate: '2026-04-01', targetDate: '2026-12-01', progress: 35, createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: genId(), company: 'Novapay Solutions', title: 'NBU Resolution №187 Compliance', type: 'nbu_check', framework: 'NBU Resolution №187',
    status: 'preparation', description: 'Ensure compliance with NBU Resolution №187 on cybersecurity',
    owner: 'Maria Koval', team: ['Olena Shevchenko', 'Andriy Bondar'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['IT', 'Security', 'Risk'], systems: ['All banking systems'], assets: ['Information assets'], frameworks: ['NBU Resolution №187'], controls: [], policies: [], vendors: [] },
    tasks: [
      { id: genId(), title: 'Gap Assessment against NBU №187', description: 'Identify gaps in current controls', status: 'open', assignee: 'Maria Koval', dueDate: '2026-08-01', evidence: [], evidenceLinks: [] },
      { id: genId(), title: 'Update Asset Register', description: 'Complete asset inventory per NBU requirements', status: 'open', assignee: 'Andriy Bondar', dueDate: '2026-07-20', evidence: [], evidenceLinks: [] },
    ],
    reviews: [], findings: [],
    startDate: '2026-07-01', targetDate: '2026-10-01', progress: 15, createdAt: '2026-06-20T10:00:00Z', updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: genId(), company: 'NovaPay LLC', title: 'Annual Security Review 2026', type: 'annual_review', framework: 'ISO 27001',
    status: 'planning', description: 'Annual review of all security controls, policies, and risk posture',
    owner: 'Olena Shevchenko', team: ['Ivan Petrenko', 'Maria Koval'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['All'], systems: ['All'], assets: ['All'], frameworks: ['ISO 27001', 'NIST CSF'], controls: [], policies: ['All'], vendors: ['All'] },
    tasks: [
      { id: genId(), title: 'Schedule control testing calendar', description: 'Plan testing for all Annex A controls', status: 'open', assignee: 'Olena Shevchenko', dueDate: '2026-08-15', evidence: [], evidenceLinks: [] },
    ],
    reviews: [], findings: [],
    startDate: '2026-08-01', targetDate: '2026-11-30', progress: 5, createdAt: '2026-07-01T10:00:00Z', updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: genId(), company: 'NovaPay EU UAB', title: 'DORA Readiness Assessment', type: 'gap_assessment', framework: 'DORA',
    status: 'scope', description: 'Gap assessment against EU Digital Operational Resilience Act requirements',
    owner: 'Andriy Bondar', team: ['Maria Koval', 'Ivan Petrenko'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['IT', 'Security', 'Risk'], systems: ['Core Banking', 'Payment Gateway'], assets: ['ICT Assets'], frameworks: ['DORA'], controls: [], policies: [], vendors: ['AWS', 'Cloudflare', 'Stripe'] },
    tasks: [
      { id: genId(), title: 'Map DORA requirements to existing controls', description: 'Cross-reference DORA articles with current control set', status: 'open', assignee: 'Maria Koval', dueDate: '2026-09-01', evidence: [], evidenceLinks: [] },
    ],
    reviews: [], findings: [],
    startDate: '2026-07-15', targetDate: '2026-09-30', progress: 10, createdAt: '2026-07-05T10:00:00Z', updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: genId(), company: 'Novapay Solutions', title: 'SOC 2 Type II Remediation', type: 'remediation', framework: 'SOC 2',
    status: 'created', description: 'Remediate findings from SOC 2 Type II readiness assessment',
    owner: 'Dmytro Kovalenko', team: ['Ivan Petrenko'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['IT', 'Security'], systems: ['All Cloud Services'], assets: ['Cloud Infrastructure'], frameworks: ['SOC 2'], controls: ['CC6', 'CC7'], policies: ['Cloud Security Policy'], vendors: ['AWS', 'GCP'] },
    tasks: [], reviews: [], findings: [],
    startDate: '2026-08-01', targetDate: '2026-10-31', progress: 0, createdAt: '2026-07-06T10:00:00Z', updatedAt: '2026-07-06T10:00:00Z',
  },
  {
    id: genId(), company: 'Novapay Moldova', title: 'GDPR Compliance Campaign', type: 'compliance_campaign', framework: 'GDPR',
    status: 'created', description: 'GDPR compliance verification and documentation refresh',
    owner: 'Olena Shevchenko', team: ['Maria Koval'],
    scope: { ...EMPTY_SCOPE, businessUnits: ['All'], systems: ['CRM', 'Marketing'], assets: ['Personal Data'], frameworks: ['GDPR'], controls: [], policies: ['Data Protection Policy', 'Privacy Policy'], vendors: [] },
    tasks: [
      { id: genId(), title: 'Update RoPA (Register of Processing)', description: 'Review and update data processing register', status: 'open', assignee: 'Olena Shevchenko', dueDate: '2026-09-01', evidence: [], evidenceLinks: [] },
    ],
    reviews: [], findings: [],
    startDate: '2026-08-15', targetDate: '2026-11-01', progress: 0, createdAt: '2026-07-06T10:00:00Z', updatedAt: '2026-07-06T10:00:00Z',
  },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const d = localStorage.getItem('grc-projects');
      return d ? JSON.parse(d) : SEED_PROJECTS;
    } catch { return SEED_PROJECTS; }
  });

  useEffect(() => { localStorage.setItem('grc-projects', JSON.stringify(projects)); }, [projects]);

  const companies = [...new Set(projects.map(p => p.company))] as Project['company'][];

  const addProject = useCallback(async (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'reviews' | 'findings' | 'progress'>) => {
    try {
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create project');
      }
      const created = await res.json() as Project;
      setProjects(prev => [{
        ...created,
        tasks: created.tasks || [],
        reviews: created.reviews || [],
        findings: created.findings || [],
        team: created.team || [],
        scope: created.scope || { businessUnits: [], systems: [], assets: [], frameworks: p.framework ? [p.framework] : [], controls: [], policies: [], vendors: [] },
        progress: created.progress || 0,
      }, ...prev]);
      return created;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await fetch(`${API}/api/projects/${id}`, { method: 'DELETE' });
    } catch { /* local delete still proceeds */ }
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateProject = useCallback((id: string, d: Partial<Project>) =>
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...d, updatedAt: new Date().toISOString() } : p)), []);

  const addProjectTask = useCallback((projectId: string, task: Omit<ProjectTask, 'id'>) =>
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { ...task, id: genId() } as ProjectTask], updatedAt: new Date().toISOString() } : p)), []);

  const updateProjectTask = useCallback((projectId: string, taskId: string, d: Partial<ProjectTask>) =>
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...d, completedAt: d.status === 'completed' ? new Date().toISOString() : t.completedAt } : t), updatedAt: new Date().toISOString() } : p)), []);

  const addProjectReview = useCallback((projectId: string, review: Omit<ProjectReview, 'id' | 'reviewedAt'>) =>
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, reviews: [...p.reviews, { ...review, id: genId(), reviewedAt: new Date().toISOString() } as ProjectReview], updatedAt: new Date().toISOString() } : p)), []);

  const addProjectFinding = useCallback((projectId: string, finding: Omit<ProjectFinding, 'id'>) =>
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, findings: [...p.findings, { ...finding, id: genId() } as ProjectFinding], updatedAt: new Date().toISOString() } : p)), []);

  const updateProjectFinding = useCallback((projectId: string, findingId: string, d: Partial<ProjectFinding>) =>
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, findings: p.findings.map(f => f.id === findingId ? { ...f, ...d } : f), updatedAt: new Date().toISOString() } : p)), []);

  return (
    <ProjectContext.Provider value={{
      projects, companies, addProject, updateProject, deleteProject,
      addProjectTask, updateProjectTask, addProjectReview, addProjectFinding, updateProjectFinding,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
