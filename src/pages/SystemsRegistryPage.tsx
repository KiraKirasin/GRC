import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermission } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { userCanAccessCompany } from '../lib/permissions';
import {
  COMPANIES,
  IS_PLACEMENTS,
  IS_SYSTEM_TYPES,
  type CompanyName,
  type InformationSystem,
  type IsSystemType,
} from '../types';

const EMPTY_FORM = {
  company: 'NovaPay LLC' as CompanyName,
  systemType: 'app' as IsSystemType,
  systemCode: '',
  name: '',
  purpose: '',
  supportOwner: '',
  vendor: '',
  placement: '' as string,
  criticality: 'medium',
  appServers: '',
  osContainer: '',
  dbServers: '',
  techSpecs: '',
  datacenter: '',
  failover: '',
  security: '',
  equipment: '',
  info: '',
  consumers: '',
};

const TECH_FIELD_KEYS = [
  'appServers',
  'osContainer',
  'dbServers',
  'techSpecs',
  'datacenter',
  'failover',
  'security',
  'equipment',
  'info',
  'consumers',
] as const;

const criticalityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const typeColors: Record<string, string> = {
  infr: 'bg-slate-100 text-slate-700',
  app: 'bg-blue-100 text-blue-700',
  sec: 'bg-red-100 text-red-700',
  net: 'bg-cyan-100 text-cyan-800',
  db: 'bg-purple-100 text-purple-700',
  data: 'bg-indigo-100 text-indigo-700',
  mon: 'bg-teal-100 text-teal-700',
  int: 'bg-orange-100 text-orange-800',
};

export default function SystemsRegistryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canRead = usePermission('systems-registry:read');
  const canWrite = usePermission('systems-registry:write');

  const allowedCompanies = useMemo(
    () => COMPANIES.filter(c => userCanAccessCompany(user, c)),
    [user],
  );

  const [items, setItems] = useState<InformationSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTechFields, setShowTechFields] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<InformationSystem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/information-systems');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('systemsRegistry.loadFailed'));
      }
      setItems((await res.json()) as InformationSystem[]);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : t('systemsRegistry.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  useEffect(() => {
    if (allowedCompanies.length && !allowedCompanies.includes(form.company)) {
      setForm(f => ({ ...f, company: allowedCompanies[0] }));
    }
  }, [allowedCompanies, form.company]);

  if (!canRead) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t('auth.accessDenied')}</p>
      </div>
    );
  }

  const filtered = items.filter(item => {
    const q = search.toLowerCase().trim();
    const mSearch =
      !q ||
      item.systemCode.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.purpose.toLowerCase().includes(q) ||
      item.supportOwner.toLowerCase().includes(q) ||
      item.vendor.toLowerCase().includes(q) ||
      item.consumers.toLowerCase().includes(q);
    const mCompany = !filterCompany || item.company === filterCompany;
    const mCrit = !filterCriticality || item.criticality === filterCriticality;
    const mType = !filterType || item.systemType === filterType;
    return mSearch && mCompany && mCrit && mType;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      company: allowedCompanies[0] || 'NovaPay LLC',
    });
    setShowTechFields(false);
    setError('');
    setShowForm(true);
  };

  const openEdit = (item: InformationSystem) => {
    setEditingId(item.id);
    setForm({
      company: (COMPANIES.includes(item.company as CompanyName)
        ? item.company
        : allowedCompanies[0] || 'NovaPay LLC') as CompanyName,
      systemType: (item.systemType || 'app') as IsSystemType,
      systemCode: item.systemCode,
      name: item.name,
      purpose: item.purpose,
      supportOwner: item.supportOwner,
      vendor: item.vendor,
      placement: item.placement || '',
      criticality: item.criticality || 'medium',
      appServers: item.appServers,
      osContainer: item.osContainer,
      dbServers: item.dbServers,
      techSpecs: item.techSpecs,
      datacenter: item.datacenter,
      failover: item.failover,
      security: item.security,
      equipment: item.equipment,
      info: item.info,
      consumers: item.consumers,
    });
    setShowTechFields(true);
    setError('');
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (editingId) {
        delete (payload as { systemCode?: string }).systemCode;
      } else if (!payload.systemCode.trim()) {
        delete (payload as { systemCode?: string }).systemCode;
      }
      const path = editingId
        ? `/api/information-systems/${editingId}`
        : '/api/information-systems';
      const res = await apiFetch(path, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('systemsRegistry.saveFailed'));
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('systemsRegistry.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteConfirm || !canWrite) return;
    setError('');
    try {
      const res = await apiFetch(`/api/information-systems/${deleteConfirm.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('systemsRegistry.deleteFailed'));
      }
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('systemsRegistry.deleteFailed'));
      setDeleteConfirm(null);
    }
  };

  const placementLabel = (p: string) =>
    p ? t(`systemsRegistry.placement.${p}`, { defaultValue: p }) : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('systemsRegistry.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('systemsRegistry.description')}</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            + {t('systemsRegistry.add')}
          </button>
        )}
      </div>

      {error && !showForm && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('systemsRegistry.searchPlaceholder')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('systemsRegistry.fields.systemType')}</option>
          {(Object.keys(IS_SYSTEM_TYPES) as IsSystemType[]).map(tp => (
            <option key={tp} value={tp}>{t(`systemsRegistry.systemTypes.${tp}`)} ({tp})</option>
          ))}
        </select>
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('systemsRegistry.fields.company')}</option>
          {allowedCompanies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterCriticality}
          onChange={e => setFilterCriticality(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('systemsRegistry.fields.criticality')}</option>
          {(['low', 'medium', 'high', 'critical'] as const).map(c => (
            <option key={c} value={c}>{t(`systemsRegistry.criticality.${c}`)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.columns.systemCode')}</th>
                  <th className="px-4 py-3 min-w-[10rem]">{t('systemsRegistry.columns.name')}</th>
                  <th className="px-4 py-3 min-w-[12rem]">{t('systemsRegistry.columns.purpose')}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.columns.supportOwner')}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.columns.vendor')}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.columns.placement')}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.columns.criticality')}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t('systemsRegistry.fields.company')}</th>
                  {canWrite && <th className="px-4 py-3 whitespace-nowrap">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/80 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-gray-900">{item.systemCode}</span>
                      <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[item.systemType] || typeColors.app}`}>
                        {item.systemType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="line-clamp-2" title={item.purpose}>{item.purpose || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.supportOwner || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.vendor || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{placementLabel(item.placement)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${criticalityColors[item.criticality] || criticalityColors.medium}`}>
                        {t(`systemsRegistry.criticality.${item.criticality}`, { defaultValue: item.criticality })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{item.company}</td>
                    {canWrite && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-brand-600 hover:underline text-xs mr-3"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(item)}
                          className="text-red-500 hover:underline text-xs"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {t('systemsRegistry.rowCount', { count: filtered.length })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? t('systemsRegistry.edit') : t('systemsRegistry.add')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={save} className="flex flex-col min-h-0 flex-1">
                <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.fields.systemType')}</label>
                      <select
                        value={form.systemType}
                        onChange={e => setForm({ ...form, systemType: e.target.value as IsSystemType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                        disabled={Boolean(editingId)}
                      >
                        {(Object.keys(IS_SYSTEM_TYPES) as IsSystemType[]).map(tp => (
                          <option key={tp} value={tp}>{t(`systemsRegistry.systemTypes.${tp}`)} ({tp})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.fields.systemCode')}</label>
                      {editingId ? (
                        <input
                          type="text"
                          value={form.systemCode}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-mono"
                        />
                      ) : (
                        <input
                          type="text"
                          value={form.systemCode}
                          onChange={e => setForm({ ...form, systemCode: e.target.value.toLowerCase() })}
                          placeholder={t('systemsRegistry.systemCodeAuto', { prefix: form.systemType })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                      )}
                      {!editingId && (
                        <p className="text-xs text-gray-500 mt-1">{t('systemsRegistry.systemCodeHint')}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.fields.company')}</label>
                      <select
                        value={form.company}
                        onChange={e => setForm({ ...form, company: e.target.value as CompanyName })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      >
                        {allowedCompanies.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.columns.name')}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.columns.purpose')}</label>
                    <textarea
                      value={form.purpose}
                      onChange={e => setForm({ ...form, purpose: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.columns.supportOwner')}</label>
                      <input
                        type="text"
                        value={form.supportOwner}
                        onChange={e => setForm({ ...form, supportOwner: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.columns.vendor')}</label>
                      <input
                        type="text"
                        value={form.vendor}
                        onChange={e => setForm({ ...form, vendor: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.columns.placement')}</label>
                      <select
                        value={form.placement}
                        onChange={e => setForm({ ...form, placement: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">—</option>
                        {IS_PLACEMENTS.map(p => (
                          <option key={p} value={p}>{t(`systemsRegistry.placement.${p}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('systemsRegistry.fields.criticality')}</label>
                      <select
                        value={form.criticality}
                        onChange={e => setForm({ ...form, criticality: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {(['low', 'medium', 'high', 'critical'] as const).map(c => (
                          <option key={c} value={c}>{t(`systemsRegistry.criticality.${c}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTechFields(v => !v)}
                    className="text-sm text-brand-600 hover:text-brand-800 font-medium"
                  >
                    {showTechFields ? '▾' : '▸'} {t('systemsRegistry.technicalDetails')}
                  </button>
                  {showTechFields && (
                    <div className="space-y-3 pt-1 border-t border-gray-100">
                      {TECH_FIELD_KEYS.map(key => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t(`systemsRegistry.fields.${key}`)}</label>
                          {key === 'techSpecs' || key === 'info' || key === 'security' || key === 'failover' ? (
                            <textarea
                              value={form[key]}
                              onChange={e => setForm({ ...form, [key]: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          ) : (
                            <input
                              type="text"
                              value={form[key]}
                              onChange={e => setForm({ ...form, [key]: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-white rounded-b-xl">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">
              {t('systemsRegistry.deleteConfirm', { name: `${deleteConfirm.systemCode} — ${deleteConfirm.name}` })}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
