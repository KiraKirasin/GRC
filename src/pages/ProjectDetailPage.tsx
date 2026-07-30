import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../context/ProjectContext';
import { useCompliance } from '../context/ComplianceContext';
import { usePermission } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PROJECT_STATUSES, ProjectStatus, ProjectReview, ProjectControl, ControlStatus, ControlAttachment, ControlMitigation, EMPTY_MITIGATION, TaskStatus, TaskPriority, FRAMEWORKS, compareDomainsByStandard, compareControlCodes } from '../types';

const controlStatusColors: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-700', not_applicable: 'bg-purple-100 text-purple-700',
};

const typeIcon: Record<string, string> = {
  audit: '🔍', implementation: '🛡️', annual_review: '🔄', gap_assessment: '📋',
  certification: '📑', nbu_check: '🏦', compliance_campaign: '📜', remediation: '⚠️',
  incident_post_review: '🚨', third_party_assessment: '🏢', re_certification: '🔄',
};

const STAGE_ORDER: ProjectStatus[] = ['created', 'planning', 'scope', 'preparation', 'execution', 'review', 'approval', 'closure', 'lessons_learned'];

const taskStatusColors: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700', blocked: 'bg-red-100 text-red-700',
};

const findingSeverityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};
const findingStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700', accepted: 'bg-purple-100 text-purple-700',
};

export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, updateProject, updateProjectTask, addProjectTask, addProjectFinding, updateProjectFinding } = useProjects();
  const { controls, addTask, updateTask } = useCompliance();
  const canWriteControl = usePermission('project-controls:write');
  const canReviewControl = usePermission('project-controls:review');
  const canEditControl = canWriteControl || canReviewControl;
  const canAttach = usePermission('project-controls:attachments');
  const project = projects.find(p => p.id === id);

  const [activeTab, setActiveTab] = useState<'tasks' | 'scope' | 'controls' | 'evidence' | 'findings' | 'reviews'>('controls');
  const [projectControls, setProjectControls] = useState<ProjectControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlSearch, setControlSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEvidence, setFilterEvidence] = useState<'all' | 'has_evidence' | 'no_evidence'>('all');
  const [groupByDomain, setGroupByDomain] = useState(true);
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const [editingControl, setEditingControl] = useState<ProjectControl | null>(null);
  const [showAddControl, setShowAddControl] = useState(false);
  const [addMode, setAddMode] = useState<'library' | 'custom'>('library');
  const [addFrameworks, setAddFrameworks] = useState<{ name: string; shortName?: string; count: number }[]>([]);
  const [addFwName, setAddFwName] = useState('');
  const [addLibraryControls, setAddLibraryControls] = useState<{ id: string; controlCode: string; title: string; category: string }[]>([]);
  const [addLibraryLoading, setAddLibraryLoading] = useState(false);
  const [addSelectedIds, setAddSelectedIds] = useState<Set<string>>(new Set());
  const [addLibrarySearch, setAddLibrarySearch] = useState('');
  const [addCustom, setAddCustom] = useState({ title: '', description: '', framework: '', category: '', controlCode: '', owner: '' });
  const [addingControl, setAddingControl] = useState(false);
  const [addControlError, setAddControlError] = useState('');
  const [controlForm, setControlForm] = useState({
    title: '', description: '', framework: '', category: '', owner: '', lastReviewed: '', status: 'pending' as ControlStatus,
    evidence: [] as string[], evidenceLinks: [] as string[],
    mitigation: { ...EMPTY_MITIGATION } as ControlMitigation,
  });
  const [evidenceDbSearch, setEvidenceDbSearch] = useState('');
  const [savingControl, setSavingControl] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newFinding, setNewFinding] = useState({ title: '', severity: 'medium' as 'low' | 'medium' | 'high' | 'critical', description: '', remediation: '' });
  const [showFindingForm, setShowFindingForm] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskAssignee, setEditTaskAssignee] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');

  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [editFindingTitle, setEditFindingTitle] = useState('');
  const [editFindingSeverity, setEditFindingSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [editFindingDesc, setEditFindingDesc] = useState('');
  const [editFindingRemed, setEditFindingRemed] = useState('');

  const [addingScopeKey, setAddingScopeKey] = useState<string | null>(null);
  const [scopeInput, setScopeInput] = useState('');

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewStatus, setEditReviewStatus] = useState<'pending' | 'approved' | 'rejected' | 'changes_requested'>('pending');
  const [editReviewReviewer, setEditReviewReviewer] = useState('');
  const [editReviewComments, setEditReviewComments] = useState('');

  const [newReviewStage, setNewReviewStage] = useState<'security' | 'compliance' | 'internal_audit' | 'ciso' | 'management'>('security');
  const [newReviewReviewer, setNewReviewReviewer] = useState('');
  const [newReviewComments, setNewReviewComments] = useState('');

  const loadProjectControls = () => {
    if (!id) return;
    setControlsLoading(true);
    apiFetch(`/api/projects/${id}/controls`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ProjectControl[]) => setProjectControls(data))
      .catch(() => setProjectControls([]))
      .finally(() => setControlsLoading(false));
  };

  useEffect(() => { loadProjectControls(); }, [id]);

  useEffect(() => {
    if (!showAddControl) return;
    apiFetch('/api/frameworks')
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string; shortName?: string; count: number }[]) => {
        setAddFrameworks(data);
        const initial = project?.framework || data[0]?.name || '';
        setAddFwName(prev => prev || initial);
        setAddCustom(c => ({ ...c, framework: c.framework || initial }));
      })
      .catch(() => setAddFrameworks([]));
  }, [showAddControl, project?.framework]);

  useEffect(() => {
    if (!showAddControl || addMode !== 'library' || !addFwName) {
      setAddLibraryControls([]);
      setAddSelectedIds(new Set());
      return;
    }
    setAddLibraryLoading(true);
    setAddLibrarySearch('');
    apiFetch(`/api/frameworks/controls?framework=${encodeURIComponent(addFwName)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; controlCode: string; title: string; category: string }[]) => {
        const already = new Set(projectControls.map(c => c.sourceControlId).filter(Boolean));
        const available = data.filter(c => !already.has(c.id));
        setAddLibraryControls(available);
        setAddSelectedIds(new Set());
      })
      .catch(() => {
        setAddLibraryControls([]);
        setAddSelectedIds(new Set());
      })
      .finally(() => setAddLibraryLoading(false));
  }, [showAddControl, addMode, addFwName, projectControls]);

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg">Project not found</p>
        <button onClick={() => navigate('/projects')} className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg">← Back</button>
      </div>
    );
  }

  const currentStageIndex = STAGE_ORDER.indexOf(project.status);
  const canAdvance = currentStageIndex < STAGE_ORDER.length - 1;
  const canRegress = currentStageIndex > 0;

  const advanceStage = () => {
    if (canAdvance) {
      updateProject(project.id, { status: STAGE_ORDER[currentStageIndex + 1] });
    }
  };
  const regressStage = () => {
    if (canRegress) {
      updateProject(project.id, { status: STAGE_ORDER[currentStageIndex - 1] });
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addProjectTask(project.id, {
      title: newTaskTitle, description: '', status: 'open', assignee: newTaskAssignee || project.owner,
      dueDate: newTaskDue || project.targetDate, evidence: [], evidenceLinks: [],
    });
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskDue('');
  };

  const handleAddFinding = (e: React.FormEvent) => {
    e.preventDefault();
    addProjectFinding(project.id, {
      title: newFinding.title, severity: newFinding.severity, status: 'open',
      description: newFinding.description, remediation: newFinding.remediation,
    });
    setNewFinding({ title: '', severity: 'medium', description: '', remediation: '' });
    setShowFindingForm(false);
  };

  const handleDeleteTask = (taskId: string) => {
    updateProject(project.id, { tasks: project.tasks.filter(t => t.id !== taskId) });
  };

  const handleDeleteFinding = (findingId: string) => {
    updateProject(project.id, { findings: project.findings.filter(f => f.id !== findingId) });
  };

  const handleDeleteReview = (reviewId: string) => {
    updateProject(project.id, { reviews: project.reviews.filter(r => r.id !== reviewId) });
  };

  const handleUpdateReview = (reviewId: string, d: Partial<ProjectReview>) => {
    updateProject(project.id, { reviews: project.reviews.map(r => r.id === reviewId ? { ...r, ...d } : r) });
  };

  const handleAddScopeItem = (key: string) => {
    if (!scopeInput.trim()) return;
    const current = project.scope[key as keyof typeof project.scope] as string[];
    updateProject(project.id, { scope: { ...project.scope, [key]: [...current, scopeInput.trim()] } });
    setScopeInput('');
  };

  const handleRemoveScopeItem = (key: string, item: string) => {
    const current = project.scope[key as keyof typeof project.scope] as string[];
    updateProject(project.id, { scope: { ...project.scope, [key]: current.filter(i => i !== item) } });
  };

  const handleAddFramework = (framework: string) => {
    if (project.scope.frameworks.includes(framework)) return;
    updateProject(project.id, { scope: { ...project.scope, frameworks: [...project.scope.frameworks, framework] } });
  };

  const handleToggleControl = (controlTitle: string) => {
    const current = project.scope.controls;
    const updated = current.includes(controlTitle) ? current.filter(c => c !== controlTitle) : [...current, controlTitle];
    updateProject(project.id, { scope: { ...project.scope, controls: updated } });
  };

  const handleSaveTaskEdit = (taskId: string) => {
    updateProjectTask(project.id, taskId, { title: editTaskTitle, assignee: editTaskAssignee, dueDate: editTaskDue });
    setEditingTaskId(null);
  };

  const handleSaveFindingEdit = (findingId: string) => {
    updateProjectFinding(project.id, findingId, {
      title: editFindingTitle, severity: editFindingSeverity,
      description: editFindingDesc, remediation: editFindingRemed,
    });
    setEditingFindingId(null);
  };

  const filteredControls = controls.filter(c => project.scope.frameworks.includes(c.framework));

  const controlOwners = useMemo(() => {
    const owners = new Set(
      projectControls.map(c => (c.owner || '').trim()).filter(Boolean)
    );
    return [...owners].sort((a, b) => a.localeCompare(b));
  }, [projectControls]);

  const controlHasEvidence = (c: ProjectControl) =>
    c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0;

  const filteredProjectControls = useMemo(() => {
    const q = controlSearch.toLowerCase();
    return projectControls.filter(c => {
      const mSearch = !q ||
        c.title.toLowerCase().includes(q) ||
        c.controlCode?.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      const mOwner = !filterOwner ||
        (filterOwner === '__unassigned__' ? !(c.owner || '').trim() : c.owner === filterOwner);
      const mStatus = !filterStatus || c.status === filterStatus;
      const hasEv = controlHasEvidence(c);
      const mEvidence = filterEvidence === 'all' ||
        (filterEvidence === 'has_evidence' && hasEv) ||
        (filterEvidence === 'no_evidence' && !hasEv);
      return mSearch && mOwner && mStatus && mEvidence;
    });
  }, [projectControls, controlSearch, filterOwner, filterStatus, filterEvidence]);

  const filtersActive = Boolean(filterOwner || filterStatus || filterEvidence !== 'all' || controlSearch);
  const clearControlFilters = () => {
    setControlSearch('');
    setFilterOwner('');
    setFilterStatus('');
    setFilterEvidence('all');
  };

  const controlsByDomain = useMemo(() => {
    const map = new Map<string, ProjectControl[]>();
    for (const c of filteredProjectControls) {
      const domain = (c.category || '').trim() || '__uncategorized__';
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(c);
    }
    return [...map.entries()]
      .map(([domain, items]) => [
        domain,
        [...items].sort((a, b) =>
          compareControlCodes(a.controlCode, b.controlCode) || a.title.localeCompare(b.title)
        ),
      ] as [string, ProjectControl[]])
      .sort((a, b) => compareDomainsByStandard(a[0], b[0]));
  }, [filteredProjectControls]);

  const allDomainKeys = useMemo(() => controlsByDomain.map(([d]) => d), [controlsByDomain]);

  const domainLabel = (domain: string) =>
    domain === '__uncategorized__' ? t('projects.uncategorizedDomain') : domain;

  const toggleDomain = (domain: string) => {
    setCollapsedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const expandAllDomains = () => setCollapsedDomains(new Set());
  const collapseAllDomains = () => setCollapsedDomains(new Set(allDomainKeys));

  type EvidencePickerOption = {
    value: string;
    controlTitle: string;
    controlCode?: string;
    framework: string;
    source: 'database' | 'project';
  };

  const evidencePickerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: EvidencePickerOption[] = [];

    const pushOption = (opt: EvidencePickerOption) => {
      const key = opt.value.toLowerCase();
      if (!opt.value.trim() || seen.has(key)) return;
      seen.add(key);
      options.push(opt);
    };

    for (const c of controls) {
      for (const file of c.evidence) {
        pushOption({
          value: file,
          controlTitle: c.title,
          controlCode: c.controlCode,
          framework: c.framework,
          source: 'database',
        });
      }
      for (const att of c.attachments || []) {
        const name = typeof att === 'string' ? att : (att as { name?: string })?.name;
        if (!name) continue;
        pushOption({
          value: name,
          controlTitle: c.title,
          controlCode: c.controlCode,
          framework: c.framework,
          source: 'database',
        });
      }
    }

    for (const c of projectControls) {
      if (editingControl && c.id === editingControl.id) continue;
      for (const file of c.evidence) {
        pushOption({
          value: file,
          controlTitle: c.title,
          controlCode: c.controlCode,
          framework: c.framework,
          source: 'project',
        });
      }
      for (const att of c.attachments) {
        pushOption({
          value: att.name,
          controlTitle: c.title,
          controlCode: c.controlCode,
          framework: c.framework,
          source: 'project',
        });
      }
    }

    return options;
  }, [controls, projectControls, editingControl]);

  const filteredEvidencePickerOptions = useMemo(() => {
    const q = evidenceDbSearch.toLowerCase().trim();
    if (!q) return [];
    return evidencePickerOptions
      .filter(opt =>
        opt.value.toLowerCase().includes(q) ||
        opt.controlTitle.toLowerCase().includes(q) ||
        (opt.controlCode || '').toLowerCase().includes(q) ||
        opt.framework.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a.source !== b.source) return a.source === 'database' ? -1 : 1;
        return a.value.localeCompare(b.value);
      })
      .slice(0, 12);
  }, [evidenceDbSearch, evidencePickerOptions]);

  const addEvidenceItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setControlForm(prev => {
      if (prev.evidence.some(e => e.toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, evidence: [...prev.evidence, trimmed] };
    });
    setEvidenceDbSearch('');
  };

  const removeEvidenceItem = (value: string) => {
    setControlForm(prev => ({
      ...prev,
      evidence: prev.evidence.filter(e => e !== value),
    }));
  };

  const openEditControl = (c: ProjectControl) => {
    setAttachmentError('');
    setEvidenceDbSearch('');
    setEditingControl(c);
    const mitigation: ControlMitigation = {
      ...EMPTY_MITIGATION,
      ...(c.mitigation || {}),
      enabled: Boolean(c.mitigation?.enabled),
    };
    setControlForm({
      title: c.title,
      description: c.description,
      framework: c.framework,
      category: c.category,
      owner: c.owner,
      lastReviewed: c.lastReviewed,
      status: c.status,
      evidence: c.evidence || [],
      evidenceLinks: c.evidenceLinks || [],
      mitigation,
    });
  };

  const openAddControl = () => {
    setAddControlError('');
    setAddMode('library');
    setAddSelectedIds(new Set());
    setAddLibrarySearch('');
    setAddCustom({
      title: '', description: '', framework: project.framework || '', category: '', controlCode: '', owner: project.owner || '',
    });
    setAddFwName(project.framework || '');
    setShowAddControl(true);
  };

  const filteredAddLibrary = (() => {
    const q = addLibrarySearch.toLowerCase().trim();
    if (!q) return addLibraryControls;
    return addLibraryControls.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.controlCode || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  })();

  const handleAddControls = async () => {
    if (!id) return;
    setAddingControl(true);
    setAddControlError('');
    try {
      let res: Response;
      if (addMode === 'library') {
        if (addSelectedIds.size === 0) {
          setAddControlError(t('projects.selectControls'));
          setAddingControl(false);
          return;
        }
        res = await apiFetch(`/api/projects/${id}/controls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceControlIds: [...addSelectedIds], framework: addFwName }),
        });
      } else {
        if (!addCustom.title.trim()) {
          setAddControlError(t('projects.customControlTitle'));
          setAddingControl(false);
          return;
        }
        res = await apiFetch(`/api/projects/${id}/controls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addCustom),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddControlError(err.error || t('projects.addControlFailed'));
        return;
      }
      setShowAddControl(false);
      loadProjectControls();
      updateProject(project.id, {
        controlCount: (project.controlCount || projectControls.length) + (addMode === 'library' ? addSelectedIds.size : 1),
      });
    } catch {
      setAddControlError(t('projects.addControlFailed'));
    } finally {
      setAddingControl(false);
    }
  };

  const setMitigationEnabled = (enabled: boolean) => {
    if (!enabled) {
      setControlForm({
        ...controlForm,
        mitigation: { ...controlForm.mitigation, enabled: false },
      });
      return;
    }
    const code = editingControl?.controlCode ? `${editingControl.controlCode} ` : '';
    setControlForm({
      ...controlForm,
      mitigation: {
        ...controlForm.mitigation,
        enabled: true,
        title: controlForm.mitigation.title || `Mitigate: ${code}${controlForm.title}`.trim(),
        description: controlForm.mitigation.description || controlForm.description || '',
        category: controlForm.mitigation.category || controlForm.category || '',
        assignee: controlForm.mitigation.assignee || controlForm.owner || '',
        dueDate: controlForm.mitigation.dueDate || project?.targetDate || '',
        priority: controlForm.mitigation.priority || 'medium',
        status: controlForm.mitigation.status || 'remaining',
      },
    });
  };

  const applyControlUpdate = (updated: ProjectControl) => {
    setProjectControls(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditingControl(updated);
  };

  const uploadControlFiles = async (files: FileList | null) => {
    if (!editingControl || !files || files.length === 0) return;
    setUploadingFiles(true);
    setAttachmentError('');
    try {
      const body = new FormData();
      Array.from(files).forEach(f => body.append('files', f));
      const res = await apiFetch(`/api/projects/${project!.id}/controls/${editingControl.id}/attachments`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        setAttachmentError(t('projects.uploadFailed'));
        return;
      }
      const updated = await res.json() as ProjectControl;
      applyControlUpdate(updated);
    } catch {
      setAttachmentError(t('projects.uploadFailed'));
    } finally {
      setUploadingFiles(false);
    }
  };

  const deleteControlAttachment = async (att: ControlAttachment) => {
    if (!editingControl) return;
    setAttachmentError('');
    try {
      const res = await apiFetch(
        `/api/projects/${project!.id}/controls/${editingControl.id}/attachments/${att.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setAttachmentError(t('projects.deleteAttachmentFailed'));
        return;
      }
      const updated = await res.json() as ProjectControl;
      applyControlUpdate(updated);
    } catch {
      setAttachmentError(t('projects.deleteAttachmentFailed'));
    }
  };

  const attachmentUrl = (controlId: string, att: ControlAttachment) =>
    `/api/projects/${project!.id}/controls/${controlId}/attachments/${att.id}`;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const saveProjectControl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingControl) return;
    setSavingControl(true);
    try {
      let mitigation: ControlMitigation = { ...controlForm.mitigation };
      if (mitigation.enabled) {
        if (!mitigation.title.trim()) {
          setAttachmentError(t('projects.mitigationTitleRequired'));
          setSavingControl(false);
          return;
        }
        const taskPayload = {
          title: mitigation.title.trim(),
          description: mitigation.description,
          category: mitigation.category,
          assignee: mitigation.assignee,
          dueDate: mitigation.dueDate,
          priority: mitigation.priority,
          status: mitigation.status,
          framework: controlForm.framework || project.framework,
          sourceProjectId: project.id,
          sourceControlId: editingControl.id,
          sourceControlCode: editingControl.controlCode || '',
        };
        if (mitigation.taskId) {
          updateTask(mitigation.taskId, taskPayload);
        } else {
          const created = addTask(taskPayload);
          mitigation = { ...mitigation, taskId: created.id };
        }
      }

      const res = await apiFetch(`/api/projects/${project.id}/controls/${editingControl.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...controlForm, mitigation }),
      });
      if (res.ok) {
        const updated = await res.json() as ProjectControl;
        setProjectControls(prev => prev.map(c => c.id === updated.id ? updated : c));
        setEditingControl(null);
      }
    } finally {
      setSavingControl(false);
    }
  };

  const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
  const progress = project.tasks.length > 0 ? Math.round((completedTasks / project.tasks.length) * 100) : project.progress;

  const stageLabel = (s: ProjectStatus) => {
    const found = PROJECT_STATUSES.find(ps => ps.status === s);
    return found ? found.label : s;
  };

  return (
    <div>
      <button onClick={() => navigate('/projects')} className="text-sm text-brand-600 hover:text-brand-800 mb-4 inline-block">← {t('projects.backToList')}</button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{typeIcon[project.type] || '📋'}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATUSES.find(ps => ps.status === project.status)?.color || 'bg-gray-100 text-gray-700'}`}>
                  {t(`projects.statuses.${project.status}`)}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t(`projects.types.${project.type}`)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>👤 {project.owner}</span>
                <span>📅 {project.startDate} → {project.targetDate}</span>
                <span>📌 {project.framework}</span>
                <span>🏢 {project.company}</span>
                {project.team.length > 0 && <span>👥 {project.team.join(', ')}</span>}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${Math.max(progress, project.progress)}%` }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{Math.max(progress, project.progress)}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{completedTasks}/{project.tasks.length} tasks</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STAGE_ORDER.map((stage, i) => {
              const isActive = i === currentStageIndex;
              const isDone = i < currentStageIndex;
              const isFuture = i > currentStageIndex;
              return (
                <div key={stage} className="flex items-center">
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-brand-200 text-brand-700 ring-2 ring-brand-300' :
                    isDone ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    <span>{isDone ? '✓' : isActive ? '●' : '○'}</span>
                    <span>{t(`projects.statuses.${stage}`)}</span>
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 ${isDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={regressStage} disabled={!canRegress} className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-30">← {t('projects.prevStage')}</button>
            <button onClick={advanceStage} disabled={!canAdvance} className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-30">{t('projects.nextStage')} →</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['controls', 'evidence', 'tasks', 'scope', 'findings', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab ? 'bg-brand-200 text-brand-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t(`projects.tabs.${tab}`)}
            {tab === 'tasks' && ` (${project.tasks.length})`}
            {tab === 'findings' && ` (${project.findings.length})`}
            {tab === 'controls' && ` (${projectControls.length})`}
            {tab === 'evidence' && ` (${projectControls.filter(c => c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0).length})`}
          </button>
        ))}
      </div>

      {activeTab === 'controls' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{t('projects.tabs.controls')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('projects.projectControlsNote')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWriteControl && (
                <button
                  type="button"
                  onClick={openAddControl}
                  className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium"
                >
                  + {t('projects.addControl')}
                </button>
              )}
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupByDomain}
                  onChange={e => setGroupByDomain(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {t('projects.groupByDomain')}
              </label>
              {groupByDomain && (
                <>
                  <button type="button" onClick={expandAllDomains} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    {t('projects.expandAllDomains')}
                  </button>
                  <button type="button" onClick={collapseAllDomains} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    {t('projects.collapseAllDomains')}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              value={controlSearch}
              onChange={e => setControlSearch(e.target.value)}
              placeholder={t('common.search')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm flex-1 min-w-[160px]"
            />
            <select
              value={filterOwner}
              onChange={e => setFilterOwner(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t('common.all')} — {t('common.owner')}</option>
              <option value="__unassigned__">{t('projects.unassignedOwner')}</option>
              {controlOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t('common.all')} — {t('common.status')}</option>
              {(Object.keys(t('controls.statuses', { returnObjects: true }) as object)).map(s => (
                <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>
              ))}
            </select>
            <select
              value={filterEvidence}
              onChange={e => setFilterEvidence(e.target.value as 'all' | 'has_evidence' | 'no_evidence')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">{t('common.all')} — {t('controls.evidence')}</option>
              <option value="has_evidence">{t('database.hasEvidence')}</option>
              <option value="no_evidence">{t('database.noEvidence')}</option>
            </select>
            {filtersActive && (
              <button
                type="button"
                onClick={clearControlFilters}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                {t('projects.clearFilters')}
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filteredProjectControls.length}/{projectControls.length}
            </span>
          </div>
          {controlsLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t('common.loading')}</p>
          ) : filteredProjectControls.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {projectControls.length === 0 ? t('projects.noProjectControls') : t('common.noResults')}
            </p>
          ) : groupByDomain ? (
            <div className="space-y-3">
              {controlsByDomain.map(([domain, items]) => {
                const collapsed = collapsedDomains.has(domain);
                const implemented = items.filter(c => c.status === 'implemented').length;
                return (
                  <div key={domain} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleDomain(domain)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
                    >
                      <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${collapsed ? 'bg-white text-gray-500 border border-gray-200' : 'bg-brand-100 text-brand-700'}`}>
                        {collapsed ? '▸' : '▾'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{domainLabel(domain)}</span>
                          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                            {t('projects.domainControls', { count: items.length })}
                          </span>
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {t('projects.implementedInDomain', { done: implemented })}
                          </span>
                        </div>
                      </div>
                    </button>
                    {!collapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-t border-b border-gray-100 bg-white text-left text-gray-500">
                              <th className="py-2.5 px-3 font-medium">ID</th>
                              <th className="py-2.5 px-3 font-medium">{t('controls.title_')}</th>
                              <th className="py-2.5 px-3 font-medium">{t('common.owner')}</th>
                              <th className="py-2.5 px-3 font-medium">{t('controls.evidence')}</th>
                              <th className="py-2.5 px-3 font-medium">{t('common.status')}</th>
                              <th className="py-2.5 px-3 font-medium">{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(c => (
                              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                                <td className="py-2 px-3 font-mono text-xs">{c.controlCode || '—'}</td>
                                <td className="py-2 px-3 font-medium text-gray-900 max-w-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{c.title}</span>
                                    {c.mitigation?.enabled && (
                                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">MA</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-gray-600">{c.owner || '—'}</td>
                                <td className="py-2 px-3 text-xs text-gray-500">{c.evidence.length + c.evidenceLinks.length + c.attachments.length || '—'}</td>
                                <td className="py-2 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${controlStatusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {t(`controls.statuses.${c.status}`)}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {canEditControl && (
                                  <button onClick={() => openEditControl(c)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{t('common.edit')}</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="py-3 px-3 font-medium">ID</th>
                    <th className="py-3 px-3 font-medium">{t('controls.title_')}</th>
                    <th className="py-3 px-3 font-medium">{t('common.category')}</th>
                    <th className="py-3 px-3 font-medium">{t('common.owner')}</th>
                    <th className="py-3 px-3 font-medium">{t('controls.evidence')}</th>
                    <th className="py-3 px-3 font-medium">{t('common.status')}</th>
                    <th className="py-3 px-3 font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectControls.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-xs">{c.controlCode || '—'}</td>
                      <td className="py-2 px-3 font-medium text-gray-900 max-w-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{c.title}</span>
                          {c.mitigation?.enabled && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">MA</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500 max-w-[160px] truncate">{c.category}</td>
                      <td className="py-2 px-3 text-gray-600">{c.owner}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{c.evidence.length + c.evidenceLinks.length + c.attachments.length || '—'}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${controlStatusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>
                          {t(`controls.statuses.${c.status}`)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {canEditControl && (
                        <button onClick={() => openEditControl(c)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{t('common.edit')}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">
            {t('projects.evidenceDbNote')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-2 py-1.5 bg-white border border-gray-200 rounded-lg cursor-pointer select-none">
              <input
                type="checkbox"
                checked={groupByDomain}
                onChange={e => setGroupByDomain(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              {t('projects.groupByDomain')}
            </label>
            {groupByDomain && (
              <>
                <button type="button" onClick={expandAllDomains} className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  {t('projects.expandAllDomains')}
                </button>
                <button type="button" onClick={collapseAllDomains} className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  {t('projects.collapseAllDomains')}
                </button>
              </>
            )}
            <select
              value={filterOwner}
              onChange={e => setFilterOwner(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t('common.all')} — {t('common.owner')}</option>
              <option value="__unassigned__">{t('projects.unassignedOwner')}</option>
              {controlOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t('common.all')} — {t('common.status')}</option>
              {(Object.keys(t('controls.statuses', { returnObjects: true }) as object)).map(s => (
                <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>
              ))}
            </select>
            <select
              value={filterEvidence}
              onChange={e => setFilterEvidence(e.target.value as 'all' | 'has_evidence' | 'no_evidence')}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">{t('common.all')} — {t('controls.evidence')}</option>
              <option value="has_evidence">{t('database.hasEvidence')}</option>
              <option value="no_evidence">{t('database.noEvidence')}</option>
            </select>
            {filtersActive && (
              <button type="button" onClick={clearControlFilters} className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                {t('projects.clearFilters')}
              </button>
            )}
          </div>
          {controlsLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t('common.loading')}</p>
          ) : groupByDomain ? (
            controlsByDomain.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">
                {projectControls.length === 0 ? t('projects.noProjectControls') : t('common.noResults')}
              </p>
            ) : (
              controlsByDomain.map(([domain, items]) => {
                const collapsed = collapsedDomains.has(domain);
                return (
                  <div key={domain} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleDomain(domain)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                    >
                      <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${collapsed ? 'bg-white text-gray-500 border border-gray-200' : 'bg-brand-100 text-brand-700'}`}>
                        {collapsed ? '▸' : '▾'}
                      </span>
                      <span className="font-semibold text-gray-900">{domainLabel(domain)}</span>
                      <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {t('projects.domainControls', { count: items.length })}
                      </span>
                    </button>
                    {!collapsed && (
                      <div className="p-3 space-y-2 border-t border-gray-100">
                        {items.map(c => {
                          const hasEvidence = controlHasEvidence(c);
                          return (
                            <div key={c.id} className="rounded-lg border border-gray-100 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs text-gray-500">{c.controlCode}</span>
                                    <span className="font-medium text-gray-900 truncate">{c.title}</span>
                                    {!hasEvidence && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">{t('database.missingEvidence')}</span>}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">{c.owner || '—'}</p>
                                </div>
                                {canEditControl && (
                                <button onClick={() => openEditControl(c)} className="text-xs text-brand-600 font-medium shrink-0">{t('common.edit')}</button>
                                )}
                              </div>
                              {hasEvidence && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {c.evidence.map((f, i) => (
                                    <span key={`e-${i}`} className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">📄 {f}</span>
                                  ))}
                                  {c.evidenceLinks.map((url, i) => (
                                    <a key={`l-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs hover:bg-brand-200">
                                      🔗 {url.length > 40 ? url.slice(0, 40) + '...' : url}
                                    </a>
                                  ))}
                                  {c.attachments.map(att => (
                                    att.storedName ? (
                                      <a key={att.id} href={attachmentUrl(c.id, att)} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs hover:bg-amber-100">
                                        📎 {att.name}
                                      </a>
                                    ) : (
                                      <span key={att.id} className="inline-flex px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs">📎 {att.name}</span>
                                    )
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : filteredProjectControls.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {projectControls.length === 0 ? t('projects.noProjectControls') : t('common.noResults')}
            </p>
          ) : (
            filteredProjectControls.map(c => {
              const hasEvidence = controlHasEvidence(c);
              return (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-500">{c.controlCode}</span>
                        <span className="font-medium text-gray-900 truncate">{c.title}</span>
                        {!hasEvidence && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">{t('database.missingEvidence')}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{c.framework} · {c.category} · {c.owner}</p>
                    </div>
                    {canEditControl && (
                    <button onClick={() => openEditControl(c)} className="text-xs text-brand-600 font-medium shrink-0">{t('common.edit')}</button>
                    )}
                  </div>
                  {hasEvidence && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.evidence.map((f, i) => (
                        <span key={`e-${i}`} className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">📄 {f}</span>
                      ))}
                      {c.evidenceLinks.map((url, i) => (
                        <a key={`l-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs hover:bg-brand-200">
                          🔗 {url.length > 40 ? url.slice(0, 40) + '...' : url}
                        </a>
                      ))}
                      {c.attachments.map(att => (
                        att.storedName ? (
                          <a
                            key={att.id}
                            href={attachmentUrl(c.id, att)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs hover:bg-amber-100"
                          >
                            📎 {att.name}
                          </a>
                        ) : (
                          <span key={att.id} className="inline-flex px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs">📎 {att.name}</span>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('projects.tabs.tasks')}</h3>
          </div>

          <form onSubmit={handleAddTask} className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder={t('projects.taskTitle')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm flex-1 min-w-[150px]" required />
            <input type="text" value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} placeholder={t('projects.assignee')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-[140px]" />
            <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-[140px]" />
            <button type="submit" className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t('common.add')}</button>
          </form>

          {project.tasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('projects.noTasks')}</p>
          ) : (
            <div className="space-y-2">
              {project.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => updateProjectTask(project.id, task.id, { status: task.status === 'completed' ? 'open' : 'completed' })}
                    className="rounded border-gray-300 shrink-0"
                  />
                  {editingTaskId === task.id ? (
                    <div className="flex-1 flex flex-wrap gap-2 items-center">
                      <input type="text" value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 min-w-[120px]" />
                      <input type="text" value={editTaskAssignee} onChange={e => setEditTaskAssignee(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-[120px]" placeholder={t('projects.assignee')} />
                      <input type="date" value={editTaskDue} onChange={e => setEditTaskDue(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-[130px]" />
                      <button onClick={() => handleSaveTaskEdit(task.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">✓</button>
                      <button onClick={() => setEditingTaskId(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${taskStatusColors[task.status]}`}>{t(`projects.taskStatuses.${task.status}`)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {task.assignee && <span>👤 {task.assignee}</span>}
                        {task.dueDate && <span>📅 {task.dueDate}</span>}
                        {task.controlRef && <span>🔗 {task.controlRef}</span>}
                        {task.evidence.length > 0 && <span>📄 {task.evidence.length} files</span>}
                      </div>
                      {task.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {task.evidence.map((f, i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">📄 {f}</span>)}
                        </div>
                      )}
                      {task.evidenceLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {task.evidenceLinks.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded hover:bg-brand-200">🔗 link</a>)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditTaskTitle(task.title);
                        setEditTaskAssignee(task.assignee);
                        setEditTaskDue(task.dueDate);
                      }}
                      className="text-xs text-brand-400 hover:text-brand-600 px-1"
                      title={t('common.edit')}
                    >✏️</button>
                    {task.status !== 'completed' && task.status !== 'blocked' && (
                      <button onClick={() => updateProjectTask(project.id, task.id, { status: 'blocked' })} className="text-xs text-red-500 hover:text-red-700 px-1" title="Block">⛔</button>
                    )}
                    {task.status === 'blocked' && (
                      <button onClick={() => updateProjectTask(project.id, task.id, { status: 'open' })} className="text-xs text-gray-500 hover:text-gray-700 px-1" title="Unblock">↩</button>
                    )}
                    <button onClick={() => handleDeleteTask(task.id)} className="text-xs text-red-300 hover:text-red-600 px-1" title={t('common.delete')}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scope' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('projects.tabs.scope')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { key: 'businessUnits', label: t('projects.scopeBusinessUnits'), icon: '🏢' },
              { key: 'systems', label: t('projects.scopeSystems'), icon: '💻' },
              { key: 'assets', label: t('projects.scopeAssets'), icon: '📦' },
              { key: 'frameworks', label: t('projects.scopeFrameworks'), icon: '📋' },
              { key: 'controls', label: t('projects.scopeControls'), icon: '🔒' },
              { key: 'policies', label: t('projects.scopePolicies'), icon: '📄' },
              { key: 'vendors', label: t('projects.scopeVendors'), icon: '🏢' },
            ] as const).map(cat => {
              const items = project.scope[cat.key as keyof typeof project.scope] as string[];

              if (cat.key === 'frameworks') {
                return (
                  <div key={cat.key} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">{cat.icon} {cat.label}</p>
                    {items.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {items.map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                            {item}
                            <button onClick={() => handleRemoveScopeItem(cat.key, item)} className="text-red-400 hover:text-red-600 font-bold leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-2">{t('projects.scopeEmpty')}</p>
                    )}
                    <select
                      value=""
                      onChange={e => { if (e.target.value) handleAddFramework(e.target.value); }}
                      className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white"
                    >
                      <option value="">+ {t('projects.scopeAdd')}</option>
                      {FRAMEWORKS.map(fw => (
                        <option key={fw.name} value={fw.name} disabled={items.includes(fw.name)}>{fw.shortName}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (cat.key === 'controls') {
                return (
                  <div key={cat.key} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">{cat.icon} {cat.label}</p>
                    {items.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {items.map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                            {item}
                            <button onClick={() => handleRemoveScopeItem(cat.key, item)} className="text-red-400 hover:text-red-600 font-bold leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-2">{t('projects.scopeEmpty')}</p>
                    )}
                    {filteredControls.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded bg-white p-1">
                        {filteredControls.map(c => (
                          <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                            <input
                              type="checkbox"
                              checked={items.includes(c.title)}
                              onChange={() => handleToggleControl(c.title)}
                              className="rounded border-gray-300 shrink-0"
                            />
                            <span className="truncate">{c.title}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{t('projects.scopeSelectFrameworks')}</p>
                    )}
                  </div>
                );
              }

              return (
                <div key={cat.key} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">{cat.icon} {cat.label}</p>
                  {items.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {items.map((item, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                          {item}
                          <button onClick={() => handleRemoveScopeItem(cat.key, item)} className="text-red-400 hover:text-red-600 font-bold leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic mb-2">{t('projects.scopeEmpty')}</p>
                  )}
                  {addingScopeKey === cat.key ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={scopeInput}
                        onChange={e => setScopeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { handleAddScopeItem(cat.key); } }}
                        className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded"
                        autoFocus
                        placeholder={t('projects.scopeAdd')}
                      />
                      <button onClick={() => handleAddScopeItem(cat.key)} className="text-xs px-2 py-1 bg-brand-600 text-white rounded hover:bg-brand-700">+</button>
                      <button onClick={() => { setAddingScopeKey(null); setScopeInput(''); }} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingScopeKey(cat.key)}
                      className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:border-gray-400 w-full text-left"
                    >+ {t('projects.scopeAdd')}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('projects.tabs.findings')}</h3>
            <button onClick={() => setShowFindingForm(true)} className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700">+ {t('projects.addFinding')}</button>
          </div>

          {showFindingForm && (
            <form onSubmit={handleAddFinding} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <input type="text" value={newFinding.title} onChange={e => setNewFinding({ ...newFinding, title: e.target.value })} placeholder={t('projects.findingTitle')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
              <div className="flex gap-2">
                <select value={newFinding.severity} onChange={e => setNewFinding({ ...newFinding, severity: e.target.value as any })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
                <button type="submit" className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t('common.add')}</button>
                <button type="button" onClick={() => setShowFindingForm(false)} className="px-3 py-1.5 text-sm text-gray-600">{t('common.cancel')}</button>
              </div>
              <textarea value={newFinding.description} onChange={e => setNewFinding({ ...newFinding, description: e.target.value })} placeholder={t('projects.findingDescription')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" rows={2} />
            </form>
          )}

          {project.findings.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('projects.noFindings')}</p>
          ) : (
            <div className="space-y-2">
              {project.findings.map(f => (
                <div key={f.id} className="p-3 border border-gray-100 rounded-lg">
                  {editingFindingId === f.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editFindingTitle} onChange={e => setEditFindingTitle(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      <div className="flex gap-2">
                        <select value={editFindingSeverity} onChange={e => setEditFindingSeverity(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                        </select>
                        <select value={f.status} onChange={e => updateProjectFinding(project.id, f.id, { status: e.target.value as any })} className="px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="accepted">Accepted</option>
                        </select>
                      </div>
                      <textarea value={editFindingDesc} onChange={e => setEditFindingDesc(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" rows={2} />
                      <textarea value={editFindingRemed} onChange={e => setEditFindingRemed(e.target.value)} placeholder="Remediation" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" rows={2} />
                      <div className="flex gap-1">
                        <button onClick={() => handleSaveFindingEdit(f.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">✓</button>
                        <button onClick={() => setEditingFindingId(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">✕</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-900">{f.title}</span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${findingSeverityColors[f.severity]}`}>{f.severity}</span>
                        <select
                          value={f.status}
                          onChange={e => updateProjectFinding(project.id, f.id, { status: e.target.value as any })}
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium border-0 ${findingStatusColors[f.status]}`}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="accepted">Accepted</option>
                        </select>
                        <button
                          onClick={() => {
                            setEditingFindingId(f.id);
                            setEditFindingTitle(f.title);
                            setEditFindingSeverity(f.severity);
                            setEditFindingDesc(f.description);
                            setEditFindingRemed(f.remediation);
                          }}
                          className="text-xs text-brand-400 hover:text-brand-600"
                        >✏️</button>
                        <button onClick={() => handleDeleteFinding(f.id)} className="text-xs text-red-300 hover:text-red-600">🗑️</button>
                      </div>
                      {f.description && <p className="text-xs text-gray-500">{f.description}</p>}
                      {f.remediation && <p className="text-xs text-gray-400 mt-1">Remediation: {f.remediation}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('projects.tabs.reviews')}</h3>

          {project.reviews.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('projects.noReviews')}</p>
          ) : (
            <div className="space-y-2">
              {project.reviews.map(r => (
                <div key={r.id} className="p-3 border border-gray-100 rounded-lg">
                  {editingReviewId === r.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <select value={editReviewStatus} onChange={e => setEditReviewStatus(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="changes_requested">Changes Requested</option>
                        </select>
                        <input type="text" value={editReviewReviewer} onChange={e => setEditReviewReviewer(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Reviewer" />
                      </div>
                      <textarea value={editReviewComments} onChange={e => setEditReviewComments(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" rows={2} />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            handleUpdateReview(r.id, { status: editReviewStatus, reviewer: editReviewReviewer, comments: editReviewComments });
                            setEditingReviewId(null);
                          }}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >✓</button>
                        <button onClick={() => setEditingReviewId(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{r.stage}</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        r.status === 'changes_requested' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.status}</span>
                      <span className="text-xs text-gray-400">by {r.reviewer}</span>
                      <span className="text-xs text-gray-400">{new Date(r.reviewedAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => {
                          setEditingReviewId(r.id);
                          setEditReviewStatus(r.status);
                          setEditReviewReviewer(r.reviewer);
                          setEditReviewComments(r.comments);
                        }}
                        className="text-xs text-brand-400 hover:text-brand-600"
                      >✏️</button>
                      <button onClick={() => handleDeleteReview(r.id)} className="text-xs text-red-300 hover:text-red-600">🗑️</button>
                    </div>
                  )}
                  {!editingReviewId && r.comments && <p className="text-xs text-gray-500 mt-1">{r.comments}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">{t('projects.addReview')}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={newReviewStage}
                onChange={e => setNewReviewStage(e.target.value as any)}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs"
              >
                {(['security', 'compliance', 'internal_audit', 'ciso', 'management'] as const).map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
              <input
                type="text"
                value={newReviewReviewer}
                onChange={e => setNewReviewReviewer(e.target.value)}
                placeholder="Reviewer"
                className="px-2 py-1.5 border border-gray-300 rounded text-xs"
              />
              <input
                type="text"
                value={newReviewComments}
                onChange={e => setNewReviewComments(e.target.value)}
                placeholder="Comments"
                className="px-2 py-1.5 border border-gray-300 rounded text-xs flex-1 min-w-[120px]"
              />
              <button
                onClick={() => {
                  if (!newReviewReviewer.trim()) return;
                  const existing = project.reviews.find(r => r.stage === newReviewStage);
                  if (existing) {
                    handleUpdateReview(existing.id, { status: 'approved', reviewer: newReviewReviewer, comments: newReviewComments });
                  } else {
                    updateProject(project.id, {
                      reviews: [...project.reviews, {
                        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                        stage: newReviewStage,
                        status: 'approved',
                        reviewer: newReviewReviewer,
                        comments: newReviewComments,
                        reviewedAt: new Date().toISOString(),
                      }],
                    });
                  }
                  setNewReviewReviewer('');
                  setNewReviewComments('');
                }}
                className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >+ {t('common.add')}</button>
            </div>
          </div>
        </div>
      )}

      {showAddControl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('projects.addControlTitle')}</h3>
              <button onClick={() => setShowAddControl(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setAddMode('library'); setAddControlError(''); }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${addMode === 'library' ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('projects.addFromLibrary')}
              </button>
              <button
                type="button"
                onClick={() => { setAddMode('custom'); setAddControlError(''); }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${addMode === 'custom' ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('projects.addCustomControl')}
              </button>
            </div>

            {addMode === 'library' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">{t('projects.addControlLibraryHint')}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                  <select
                    value={addFwName}
                    onChange={e => setAddFwName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {addFrameworks.map(fw => (
                      <option key={fw.name} value={fw.name}>{fw.shortName || fw.name} — {fw.count}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={addLibrarySearch}
                  onChange={e => setAddLibrarySearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                {addLibraryLoading ? (
                  <p className="text-sm text-gray-400 py-6 text-center">{t('common.loading')}</p>
                ) : filteredAddLibrary.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">{t('projects.noLibraryControlsLeft')}</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {filteredAddLibrary.map(c => (
                      <label key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addSelectedIds.has(c.id)}
                          onChange={() => {
                            setAddSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            });
                          }}
                          className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-gray-900">
                            {c.controlCode ? <span className="font-mono text-xs text-gray-500 mr-1.5">{c.controlCode}</span> : null}
                            {c.title}
                          </span>
                          {c.category && <span className="text-[11px] text-gray-400">{c.category}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">{t('projects.selectedControlsCount', { selected: addSelectedIds.size, total: addLibraryControls.length })}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">{t('projects.addControlCustomHint')}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.customControlTitle')}</label>
                  <input
                    type="text"
                    value={addCustom.title}
                    onChange={e => setAddCustom({ ...addCustom, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.customControlCode')}</label>
                    <input
                      type="text"
                      value={addCustom.controlCode}
                      onChange={e => setAddCustom({ ...addCustom, controlCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                    <select
                      value={addCustom.framework}
                      onChange={e => setAddCustom({ ...addCustom, framework: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {addFrameworks.map(fw => (
                        <option key={fw.name} value={fw.name}>{fw.shortName || fw.name}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
                  <input
                    type="text"
                    value={addCustom.category}
                    onChange={e => setAddCustom({ ...addCustom, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                  <textarea
                    value={addCustom.description}
                    onChange={e => setAddCustom({ ...addCustom, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label>
                  <input
                    type="text"
                    value={addCustom.owner}
                    onChange={e => setAddCustom({ ...addCustom, owner: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {addControlError && <p className="text-sm text-red-600 mt-3">{addControlError}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => setShowAddControl(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleAddControls}
                disabled={addingControl}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {addingControl ? t('common.loading') : t('projects.addControl')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingControl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('controls.editControl')}</h3>
              <button onClick={() => setEditingControl(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{t('projects.editProjectControlNote')}</p>
            <form onSubmit={saveProjectControl} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.title_')}</label>
                <input type="text" value={controlForm.title} onChange={e => setControlForm({ ...controlForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea value={controlForm.description} onChange={e => setControlForm({ ...controlForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                  <input type="text" value={controlForm.framework} onChange={e => setControlForm({ ...controlForm, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
                  <input type="text" value={controlForm.category} onChange={e => setControlForm({ ...controlForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label>
                  <input type="text" value={controlForm.owner} onChange={e => setControlForm({ ...controlForm, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.lastReviewed')}</label>
                  <input type="date" value={controlForm.lastReviewed} onChange={e => setControlForm({ ...controlForm, lastReviewed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select value={controlForm.status} onChange={e => setControlForm({ ...controlForm, status: e.target.value as ControlStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {(Object.keys(t('controls.statuses', { returnObjects: true }) as object)).map(s => (
                    <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('projects.mitigationAction')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('projects.mitigationHint')}</p>
                </div>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="mitigation-enabled"
                      checked={!controlForm.mitigation.enabled}
                      onChange={() => setMitigationEnabled(false)}
                    />
                    {t('common.no')}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="mitigation-enabled"
                      checked={controlForm.mitigation.enabled}
                      onChange={() => setMitigationEnabled(true)}
                    />
                    {t('common.yes')}
                  </label>
                </div>
                {controlForm.mitigation.enabled && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.title_')}</label>
                      <input
                        type="text"
                        value={controlForm.mitigation.title}
                        onChange={e => setControlForm({
                          ...controlForm,
                          mitigation: { ...controlForm.mitigation, title: e.target.value },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        placeholder="Implement access control policy"
                        required={controlForm.mitigation.enabled}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                      <textarea
                        value={controlForm.mitigation.description}
                        onChange={e => setControlForm({
                          ...controlForm,
                          mitigation: { ...controlForm.mitigation, description: e.target.value },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        rows={2}
                        placeholder="Define and implement RBAC for all systems"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
                        <input
                          type="text"
                          value={controlForm.mitigation.category}
                          onChange={e => setControlForm({
                            ...controlForm,
                            mitigation: { ...controlForm.mitigation, category: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          placeholder="Access Control"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.assignee')}</label>
                        <input
                          type="text"
                          value={controlForm.mitigation.assignee}
                          onChange={e => setControlForm({
                            ...controlForm,
                            mitigation: { ...controlForm.mitigation, assignee: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.dueDate')}</label>
                        <input
                          type="date"
                          value={controlForm.mitigation.dueDate}
                          onChange={e => setControlForm({
                            ...controlForm,
                            mitigation: { ...controlForm.mitigation, dueDate: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.priority')}</label>
                        <select
                          value={controlForm.mitigation.priority}
                          onChange={e => setControlForm({
                            ...controlForm,
                            mitigation: { ...controlForm.mitigation, priority: e.target.value as TaskPriority },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          {(Object.keys(t('tasks.priorities', { returnObjects: true }) as object)).map(p => (
                            <option key={p} value={p}>{t(`tasks.priorities.${p}`)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                        <select
                          value={controlForm.mitigation.status}
                          onChange={e => setControlForm({
                            ...controlForm,
                            mitigation: { ...controlForm.mitigation, status: e.target.value as TaskStatus },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          {(Object.keys(t('tasks.statuses', { returnObjects: true }) as object)).map(s => (
                            <option key={s} value={s}>{t(`tasks.statuses.${s}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {controlForm.mitigation.taskId && (
                      <p className="text-xs text-emerald-700">{t('projects.mitigationLinkedTask')}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.evidence')}</label>
                <p className="text-xs text-gray-500 mb-1.5">{t('projects.evidenceStartTyping')}</p>
                <div className="relative mb-2">
                  <input
                    type="search"
                    value={evidenceDbSearch}
                    onChange={e => setEvidenceDbSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const first = filteredEvidencePickerOptions.find(opt =>
                          !controlForm.evidence.some(ev => ev.toLowerCase() === opt.value.toLowerCase())
                        );
                        if (first) addEvidenceItem(first.value);
                        else if (evidenceDbSearch.trim()) addEvidenceItem(evidenceDbSearch);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    placeholder={t('projects.searchEvidenceDb')}
                    autoComplete="off"
                  />
                  {evidenceDbSearch.trim() && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredEvidencePickerOptions.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => addEvidenceItem(evidenceDbSearch)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {t('projects.addEvidenceAsTyped', { name: evidenceDbSearch.trim() })}
                        </button>
                      ) : (
                        filteredEvidencePickerOptions.map(opt => {
                          const alreadyAdded = controlForm.evidence.some(
                            e => e.toLowerCase() === opt.value.toLowerCase()
                          );
                          return (
                            <button
                              key={`${opt.source}-${opt.value}-${opt.controlTitle}`}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addEvidenceItem(opt.value)}
                              className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                                opt.source === 'database' ? 'bg-brand-50/40' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">{opt.value}</span>
                                <span className={`text-[10px] uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded ${
                                  opt.source === 'database'
                                    ? 'bg-brand-100 text-brand-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {opt.source === 'database' ? t('projects.evidenceFromDatabase') : t('projects.evidenceFromProject')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {[opt.controlCode, opt.controlTitle, opt.framework].filter(Boolean).join(' · ')}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {controlForm.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {controlForm.evidence.map(file => (
                      <span key={file} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {file}
                        <button
                          type="button"
                          onClick={() => removeEvidenceItem(file)}
                          className="text-blue-500 hover:text-blue-800 leading-none"
                          aria-label={t('common.delete')}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('projects.evidenceManualLabel')}</label>
                <input
                  type="text"
                  value={controlForm.evidence.join(', ')}
                  onChange={e => setControlForm({
                    ...controlForm,
                    evidence: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder={t('projects.evidenceManualPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('projects.evidenceSearchHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('database.evidenceLinks')}</label>
                <input
                  type="text"
                  value={controlForm.evidenceLinks.join(', ')}
                  onChange={e => setControlForm({
                    ...controlForm,
                    evidenceLinks: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('database.attachments')}</label>
                <p className="text-xs text-gray-500 mb-2">{t('projects.attachmentsHint')}</p>
                {(editingControl.attachments || []).length > 0 && (
                  <ul className="space-y-1.5 mb-3">
                    {editingControl.attachments.map(att => (
                      <li key={att.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          {att.storedName ? (
                            <a href={attachmentUrl(editingControl.id, att)} className="text-brand-700 hover:underline font-medium truncate block" target="_blank" rel="noopener noreferrer">
                              📎 {att.name}
                            </a>
                          ) : (
                            <span className="font-medium text-gray-800 truncate block">📎 {att.name}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {[formatFileSize(att.size), att.uploadedAt ? new Date(att.uploadedAt).toLocaleString() : ''].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        {canAttach && (
                        <button
                          type="button"
                          onClick={() => deleteControlAttachment(att)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium shrink-0"
                        >
                          {t('common.delete')}
                        </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canAttach && (
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={uploadingFiles}
                    onChange={e => {
                      void uploadControlFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  {uploadingFiles ? t('projects.uploading') : `+ ${t('projects.addAttachments')}`}
                </label>
                )}
                {attachmentError && <p className="text-xs text-red-600 mt-1.5">{attachmentError}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingControl(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
                <button type="submit" disabled={savingControl} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {savingControl ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
