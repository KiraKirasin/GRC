import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { usePermission } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PROJECT_TYPES, PROJECT_STATUSES, COMPANIES, CompanyName, ProjectType } from '../types';

const typeIcon: Record<string, string> = {
  audit: '🔍', implementation: '🛡️', annual_review: '🔄', gap_assessment: '📋',
  certification: '📑', nbu_check: '🏦', compliance_campaign: '📜', remediation: '⚠️',
  incident_post_review: '🚨', third_party_assessment: '🏢', re_certification: '🔄',
};

type FrameworkOption = { name: string; shortName?: string; count: number };
type LibraryControl = {
  id: string;
  controlCode: string;
  title: string;
  category: string;
};

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, addProject, deleteProject } = useProjects();
  const canWrite = usePermission('projects:write');
  const canDelete = usePermission('projects:delete');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkOption[]>([]);
  const [fwControls, setFwControls] = useState<LibraryControl[]>([]);
  const [fwControlsLoading, setFwControlsLoading] = useState(false);
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());
  const [controlPickerSearch, setControlPickerSearch] = useState('');
  const [form, setForm] = useState({
    title: '', company: 'NovaPay LLC' as CompanyName, type: 'audit' as ProjectType,
    framework: '', description: '', owner: '', startDate: '', targetDate: '',
  });

  useEffect(() => {
    apiFetch('/api/frameworks')
      .then(r => r.ok ? r.json() : [])
      .then((data: FrameworkOption[]) => {
        setFrameworks(data);
        if (data.length > 0) setForm(f => ({ ...f, framework: f.framework || data[0].name }));
      })
      .catch(() => setFrameworks([]));
  }, []);

  useEffect(() => {
    if (!form.framework || !showForm) {
      setFwControls([]);
      setSelectedControlIds(new Set());
      return;
    }
    setFwControlsLoading(true);
    setControlPickerSearch('');
    apiFetch(`/api/frameworks/controls?framework=${encodeURIComponent(form.framework)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: LibraryControl[]) => {
        setFwControls(data);
        setSelectedControlIds(new Set(data.map(c => c.id)));
      })
      .catch(() => {
        setFwControls([]);
        setSelectedControlIds(new Set());
      })
      .finally(() => setFwControlsLoading(false));
  }, [form.framework, showForm]);

  const filtered = projects.filter(p => {
    const mSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.owner.toLowerCase().includes(search.toLowerCase());
    const mType = !filterType || p.type === filterType;
    const mStatus = !filterStatus || p.status === filterStatus;
    const mCompany = !filterCompany || p.company === filterCompany;
    return mSearch && mType && mStatus && mCompany;
  });

  const selectedFw = frameworks.find(f => f.name === form.framework);

  const filteredFwControls = useMemo(() => {
    const q = controlPickerSearch.toLowerCase().trim();
    if (!q) return fwControls;
    return fwControls.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.controlCode || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }, [fwControls, controlPickerSearch]);

  const toggleControl = (id: string) => {
    setSelectedControlIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedControlIds(prev => {
      const next = new Set(prev);
      for (const c of filteredFwControls) next.add(c.id);
      return next;
    });
  };

  const clearAllControls = () => setSelectedControlIds(new Set());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.framework) {
      setCreateError(t('projects.frameworkRequired'));
      return;
    }
    setCreating(true);
    setCreateError('');
    const created = await addProject({
      title: form.title,
      company: form.company,
      type: form.type,
      status: 'created',
      framework: form.framework,
      description: form.description,
      owner: form.owner,
      team: [],
      startDate: form.startDate,
      targetDate: form.targetDate,
      scope: {
        businessUnits: [], systems: [], assets: [],
        frameworks: [form.framework],
        controls: [], policies: [], vendors: [],
      },
      controlIds: [...selectedControlIds],
    });
    setCreating(false);
    if (!created) {
      setCreateError(t('projects.createFailed'));
      return;
    }
    setForm({ title: '', company: 'NovaPay LLC', type: 'audit', framework: frameworks[0]?.name || '', description: '', owner: '', startDate: '', targetDate: '' });
    setSelectedControlIds(new Set());
    setShowForm(false);
    navigate(`/projects/${created.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('projects.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('projects.description')}</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={!canWrite} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          + {t('projects.createProject')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.totalProjects')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{projects.filter(p => p.status === 'execution').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.inExecution')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-emerald-600">{projects.filter(p => p.status === 'closure' || p.status === 'lessons_learned').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.completed')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{projects.filter(p => p.status === 'created' || p.status === 'planning').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.upcoming')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('projects.type')}</option>
          {PROJECT_TYPES.map(pt => <option key={pt.type} value={pt.type}>{pt.icon} {t(`projects.types.${pt.type}`)}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {PROJECT_STATUSES.map(ps => <option key={ps.status} value={ps.status}>{t(`projects.statuses.${ps.status}`)}</option>)}
        </select>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('projects.company')}</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('common.noResults')}</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <span className="text-3xl shrink-0">{typeIcon[p.type] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATUSES.find(ps => ps.status === p.status)?.color || 'bg-gray-100 text-gray-700'}`}>
                    {t(`projects.statuses.${p.status}`)}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t(`projects.types.${p.type}`)}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                  <span>👤 {p.owner}</span>
                  <span>📅 {p.startDate} → {p.targetDate}</span>
                  <span>📌 {p.framework}</span>
                  <span>🏢 {p.company}</span>
                  {p.controlCount != null && <span>🔒 {p.controlCount} {t('projects.controlsCopied')}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">{p.progress}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{p.tasks.length} tasks · {p.findings.length} findings</p>
              </div>
              {canDelete && (
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(p.id); }}
                className="text-red-400 hover:text-red-600 text-lg shrink-0"
                title={t('common.delete')}
              >&times;</button>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('projects.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
              <button onClick={() => { deleteProject(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('projects.createProject')}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.title_')}</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.type')}</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ProjectType })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {PROJECT_TYPES.map(pt => <option key={pt.type} value={pt.type}>{pt.icon} {t(`projects.types.${pt.type}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.company')}</label>
                  <select value={form.company} onChange={e => setForm({ ...form, company: e.target.value as CompanyName })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                <select
                  value={form.framework}
                  onChange={e => setForm({ ...form, framework: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">{t('projects.selectFramework')}</option>
                  {frameworks.map(fw => (
                    <option key={fw.name} value={fw.name}>
                      {fw.shortName || fw.name} — {fw.count} {t('projects.controlsCopied')}
                    </option>
                  ))}
                </select>
              </div>

              {form.framework && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t('projects.selectControls')}</p>
                      <p className="text-xs text-gray-500">
                        {t('projects.selectedControlsCount', { selected: selectedControlIds.size, total: fwControls.length })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllVisible} className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-white">
                        {t('projects.selectAllControls')}
                      </button>
                      <button type="button" onClick={clearAllControls} className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-white">
                        {t('projects.clearControlSelection')}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={controlPickerSearch}
                    onChange={e => setControlPickerSearch(e.target.value)}
                    placeholder={t('common.search')}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm mb-2 bg-white"
                  />
                  {fwControlsLoading ? (
                    <p className="text-sm text-gray-400 py-4 text-center">{t('common.loading')}</p>
                  ) : filteredFwControls.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">{t('projects.noFrameworkControls')}</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded-lg p-2">
                      {filteredFwControls.map(c => (
                        <label key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedControlIds.has(c.id)}
                            onChange={() => toggleControl(c.id)}
                            className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-gray-900 leading-snug">
                              {c.controlCode ? <span className="font-mono text-xs text-gray-500 mr-1.5">{c.controlCode}</span> : null}
                              {c.title}
                            </span>
                            {c.category && <span className="text-[11px] text-gray-400">{c.category}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-brand-700 mt-2">
                    {selectedControlIds.size === 0
                      ? t('projects.willCopyNone')
                      : selectedControlIds.size === fwControls.length && fwControls.length > 0
                        ? t('projects.willCopyControls', { count: selectedControlIds.size })
                        : t('projects.willCopySelected', { count: selectedControlIds.size })}
                  </p>
                  {selectedFw && selectedFw.count === 0 && (
                    <p className="text-xs text-amber-700 mt-1">{t('projects.emptyFrameworkHint')}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label>
                <input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.startDate')}</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('projects.targetDate')}</label>
                  <input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {creating ? t('common.loading') : t('projects.createProject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
