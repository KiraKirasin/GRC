import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { usePermission } from '../context/AuthContext';
import {
  GRCControl,
  ControlStatus,
  FRAMEWORKS,
  compareControlCodes,
  compareDomainsByStandard,
  frameworksFromControls,
} from '../types';

const emptyForm: Omit<GRCControl, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '', description: '', framework: '', category: '', status: 'pending', owner: '',
  evidence: [], evidenceLinks: [], attachments: [], controlDesign: '', source: '', accessList: [], lastReviewed: '',
};

const statusColors: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-700',
  not_applicable: 'bg-purple-100 text-purple-700',
};

function domainKey(category: string) {
  return category?.trim() || '__uncategorized__';
}

export default function ControlsPage() {
  const { t } = useTranslation();
  const { controls, addControl, updateControl, deleteControl } = useCompliance();
  const canWrite = usePermission('controls:write');
  const canDelete = usePermission('controls:delete');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFramework, setFilterFramework] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [groupByDomain, setGroupByDomain] = useState(true);
  const [collapsedFrameworks, setCollapsedFrameworks] = useState<Set<string>>(new Set());
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  const frameworkOptions = useMemo(() => {
    const fromData = frameworksFromControls(controls);
    return fromData.length > 0 ? fromData : FRAMEWORKS.map(f => ({ name: f.name, shortName: f.shortName }));
  }, [controls]);

  const domainOptions = useMemo(() => {
    const domains = new Set<string>();
    for (const c of controls) {
      if (filterFramework && c.framework !== filterFramework) continue;
      domains.add(domainKey(c.category));
    }
    return [...domains].sort(compareDomainsByStandard);
  }, [controls, filterFramework]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return controls.filter(c => {
      const mSearch = !search ||
        c.title.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q) ||
        (c.controlCode || '').toLowerCase().includes(q) ||
        c.source.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      const mStatus = !filterStatus || c.status === filterStatus;
      const mFw = !filterFramework || c.framework === filterFramework;
      const mDomain = !filterDomain || domainKey(c.category) === filterDomain;
      return mSearch && mStatus && mFw && mDomain;
    });
  }, [controls, search, filterStatus, filterFramework, filterDomain]);

  const groupedByFramework = useMemo(() => {
    const byFramework = new Map<string, Map<string, GRCControl[]>>();

    for (const control of filtered) {
      const fw = control.framework || t('database.uncategorizedFramework');
      const domain = domainKey(control.category);
      if (!byFramework.has(fw)) byFramework.set(fw, new Map());
      const byDomain = byFramework.get(fw)!;
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(control);
    }

    const frameworkOrder = new Map(frameworkOptions.map((f, i) => [f.name, i]));

    return [...byFramework.entries()]
      .map(([framework, domains]) => {
        const domainEntries = [...domains.entries()]
          .map(([domain, items]) => [
            domain,
            [...items].sort((a, b) =>
              compareControlCodes(a.controlCode, b.controlCode) || a.title.localeCompare(b.title)
            ),
          ] as [string, GRCControl[]])
          .sort(([a], [b]) => compareDomainsByStandard(a, b));

        const total = domainEntries.reduce((sum, [, items]) => sum + items.length, 0);
        const implemented = domainEntries.reduce(
          (sum, [, items]) => sum + items.filter(c => c.status === 'implemented').length,
          0,
        );

        return { framework, domainEntries, total, implemented };
      })
      .sort((a, b) => {
        const ia = frameworkOrder.get(a.framework) ?? 1000;
        const ib = frameworkOrder.get(b.framework) ?? 1000;
        if (ia !== ib) return ia - ib;
        return a.framework.localeCompare(b.framework);
      });
  }, [filtered, frameworkOptions, t]);

  const domainLabel = (domain: string) =>
    domain === '__uncategorized__' ? t('projects.uncategorizedDomain') : domain;

  const domainCollapseKey = (framework: string, domain: string) => `${framework}::${domain}`;

  const flatControls = useMemo(
    () => [...filtered].sort((a, b) =>
      a.framework.localeCompare(b.framework) ||
      compareDomainsByStandard(domainKey(a.category), domainKey(b.category)) ||
      compareControlCodes(a.controlCode, b.controlCode) ||
      a.title.localeCompare(b.title)
    ),
    [filtered],
  );

  const allFrameworkKeys = useMemo(
    () => groupedByFramework.map(section => section.framework),
    [groupedByFramework],
  );

  const allDomainCollapseKeys = useMemo(
    () => groupedByFramework.flatMap(section =>
      section.domainEntries.map(([domain]) => domainCollapseKey(section.framework, domain))
    ),
    [groupedByFramework],
  );

  const toggleFramework = (framework: string) => {
    setCollapsedFrameworks(prev => {
      const next = new Set(prev);
      if (next.has(framework)) next.delete(framework);
      else next.add(framework);
      return next;
    });
  };

  const toggleDomain = (framework: string, domain: string) => {
    const key = domainCollapseKey(framework, domain);
    setCollapsedDomains(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedFrameworks(new Set());
    setCollapsedDomains(new Set());
  };

  const collapseAll = () => {
    setCollapsedFrameworks(new Set(allFrameworkKeys));
    setCollapsedDomains(new Set(allDomainCollapseKeys));
  };

  const clearFilters = () => {
    setSearch('');
    setFilterFramework('');
    setFilterDomain('');
    setFilterStatus('');
  };

  const filtersActive = Boolean(search || filterFramework || filterDomain || filterStatus);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (c: GRCControl) => {
    setForm({
      title: c.title, description: c.description, framework: c.framework, category: c.category,
      status: c.status, owner: c.owner, evidence: c.evidence, evidenceLinks: c.evidenceLinks,
      attachments: c.attachments, controlDesign: c.controlDesign, source: c.source,
      accessList: c.accessList, lastReviewed: c.lastReviewed, controlCode: c.controlCode,
    });
    setEditingId(c.id);
    setShowForm(true);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateControl(editingId, form);
    else addControl(form);
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const renderControlRow = (c: GRCControl) => (
    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">{c.controlCode || '—'}</td>
      <td className="py-3 px-4 text-gray-900 max-w-xs truncate font-medium">{c.title}</td>
      <td className="py-3 px-4 text-gray-600">{c.owner}</td>
      <td className="py-3 px-4 text-gray-500 text-xs">{c.evidence.length > 0 ? c.evidence.length : '—'}</td>
      <td className="py-3 px-4 text-gray-500 text-xs">{c.lastReviewed}</td>
      <td className="py-3 px-4">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status]}`}>
          {t(`controls.statuses.${c.status}`)}
        </span>
      </td>
      <td className="py-3 px-4">
        {(canWrite || canDelete) && (
          <div className="flex gap-2">
            {canWrite && (
              <button onClick={() => openEdit(c)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">
                {t('common.edit')}
              </button>
            )}
            {canDelete && (
              <button onClick={() => setDeleteConfirm(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                {t('common.delete')}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('controls.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('controls.description')}</p>
        </div>
        {canWrite && (
          <button onClick={openAdd} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
            + {t('controls.addControl')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filterFramework}
          onChange={e => {
            setFilterFramework(e.target.value);
            setFilterDomain('');
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('common.framework')}</option>
          {frameworkOptions.map(fw => (
            <option key={fw.name} value={fw.name}>{fw.shortName}</option>
          ))}
        </select>
        <select
          value={filterDomain}
          onChange={e => setFilterDomain(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('database.domain')}</option>
          {domainOptions.map(domain => (
            <option key={domain} value={domain}>{domainLabel(domain)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('controls.statuses', { returnObjects: true }) as object).map(s => (
            <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            {t('projects.clearFilters')}
          </button>
        )}
        <span className="text-xs text-gray-400 self-center ml-auto">
          {filtered.length}/{controls.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {t('projects.expandAllDomains')}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {t('projects.collapseAllDomains')}
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('controls.noControls')}</p>
        </div>
      ) : groupByDomain ? (
        <div className="space-y-4">
          {groupedByFramework.map(section => {
            const frameworkCollapsed = collapsedFrameworks.has(section.framework);
            return (
              <section key={section.framework} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => toggleFramework(section.framework)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-brand-50 hover:bg-brand-100/80 text-left transition-colors border-b border-gray-100"
                >
                  <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${frameworkCollapsed ? 'bg-white text-gray-500 border border-gray-200' : 'bg-brand-200 text-brand-800'}`}>
                    {frameworkCollapsed ? '▸' : '▾'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{section.framework}</span>
                      <span className="text-xs text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {t('database.frameworkControls', { count: section.total })}
                      </span>
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {t('projects.implementedInDomain', { done: section.implemented })}
                      </span>
                    </div>
                  </div>
                </button>

                {!frameworkCollapsed && (
                  <div className="p-3 space-y-3 bg-gray-50/60">
                    {section.domainEntries.map(([domain, items]) => {
                      const domainCollapsed = collapsedDomains.has(domainCollapseKey(section.framework, domain));
                      const implemented = items.filter(c => c.status === 'implemented').length;
                      return (
                        <div key={domain} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => toggleDomain(section.framework, domain)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
                          >
                            <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${domainCollapsed ? 'bg-white text-gray-500 border border-gray-200' : 'bg-brand-100 text-brand-700'}`}>
                              {domainCollapsed ? '▸' : '▾'}
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
                          {!domainCollapsed && (
                            <div className="overflow-x-auto border-t border-gray-100">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 bg-white text-left text-gray-500">
                                    <th className="py-2.5 px-4 font-medium">{t('controls.code')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('controls.title_')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('common.owner')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('controls.evidence')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('controls.lastReviewed')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('common.status')}</th>
                                    <th className="py-2.5 px-4 font-medium">{t('common.actions')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map(renderControlRow)}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-3 px-4 font-medium">{t('controls.code')}</th>
                <th className="py-3 px-4 font-medium">{t('controls.title_')}</th>
                <th className="py-3 px-4 font-medium">{t('common.framework')}</th>
                <th className="py-3 px-4 font-medium">{t('database.domain')}</th>
                <th className="py-3 px-4 font-medium">{t('common.owner')}</th>
                <th className="py-3 px-4 font-medium">{t('controls.evidence')}</th>
                <th className="py-3 px-4 font-medium">{t('controls.lastReviewed')}</th>
                <th className="py-3 px-4 font-medium">{t('common.status')}</th>
                <th className="py-3 px-4 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {flatControls.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">{c.controlCode || '—'}</td>
                  <td className="py-3 px-4 text-gray-900 max-w-xs truncate font-medium">{c.title}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{c.framework}</td>
                  <td className="py-3 px-4 text-xs text-gray-500 max-w-[160px] truncate">{domainLabel(domainKey(c.category))}</td>
                  <td className="py-3 px-4 text-gray-600">{c.owner}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{c.evidence.length > 0 ? c.evidence.length : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{c.lastReviewed}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status]}`}>
                      {t(`controls.statuses.${c.status}`)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {(canWrite || canDelete) && (
                      <div className="flex gap-2">
                        {canWrite && (
                          <button onClick={() => openEdit(c)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">
                            {t('common.edit')}
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteConfirm(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('controls.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
              <button onClick={() => { deleteControl(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{editingId ? t('controls.editControl') : t('controls.addControl')}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.title_')}</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                  <select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required>
                    <option value="">—</option>
                    {frameworkOptions.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('database.domain')}</label>
                  <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label>
                  <input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.lastReviewed')}</label>
                  <input type="date" value={form.lastReviewed} onChange={e => setForm({ ...form, lastReviewed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ControlStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {(Object.keys(t('controls.statuses', { returnObjects: true }) as object)).map(s => (
                    <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{editingId ? t('common.save') : t('common.add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
