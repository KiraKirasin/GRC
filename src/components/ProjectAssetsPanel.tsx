import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import type { ProjectAsset } from '../types';

const EMPTY_FORM = {
  name: '',
  purpose: '',
  supportOwner: '',
  criticality: 'medium',
  vendor: '',
  consumers: '',
  info: '',
};

const criticalityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

type RegistryOption = {
  id: string;
  company: string;
  systemCode?: string;
  name: string;
  purpose: string;
  supportOwner: string;
  criticality: string;
  alreadyInScope: boolean;
};

interface Props {
  projectId: string;
  canWrite: boolean;
  canLinkFromRegistry?: boolean;
  onAssetsChange?: (assets: ProjectAsset[]) => void;
}

export default function ProjectAssetsPanel({ projectId, canWrite, canLinkFromRegistry = false, onAssetsChange }: Props) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const [showRegistryPicker, setShowRegistryPicker] = useState(false);
  const [registryOptions, setRegistryOptions] = useState<RegistryOption[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registrySearch, setRegistrySearch] = useState('');
  const [selectedRegistryIds, setSelectedRegistryIds] = useState<Set<string>>(new Set());
  const [addingFromRegistry, setAddingFromRegistry] = useState(false);

  const canUseRegistry = canWrite || canLinkFromRegistry;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/assets`);
      const data = res.ok ? ((await res.json()) as ProjectAsset[]) : [];
      setAssets(data);
      onAssetsChange?.(data);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, onAssetsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
  };

  const openEdit = (a: ProjectAsset) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      purpose: a.purpose,
      supportOwner: a.supportOwner,
      criticality: a.criticality || 'medium',
      vendor: a.vendor,
      consumers: a.consumers,
      info: a.info,
    });
    setShowForm(true);
    setError('');
  };

  const openRegistryPicker = async () => {
    setShowRegistryPicker(true);
    setRegistrySearch('');
    setSelectedRegistryIds(new Set());
    setError('');
    setRegistryLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/assets/registry-options`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegistryOptions([]);
        setError((body as { error?: string }).error || t('projects.registryLoadFailed'));
        return;
      }
      setRegistryOptions(Array.isArray(body) ? (body as RegistryOption[]) : []);
    } catch {
      setRegistryOptions([]);
      setError(t('projects.registryLoadFailed'));
    } finally {
      setRegistryLoading(false);
    }
  };

  const filteredRegistry = useMemo(() => {
    const q = registrySearch.toLowerCase().trim();
    if (!q) return registryOptions;
    return registryOptions.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q) ||
        (r.purpose || '').toLowerCase().includes(q) ||
        (r.supportOwner || '').toLowerCase().includes(q),
    );
  }, [registryOptions, registrySearch]);

  const toggleRegistryId = (id: string, alreadyInScope: boolean) => {
    if (alreadyInScope) return;
    setSelectedRegistryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addFromRegistry = async () => {
    if (!selectedRegistryIds.size) return;
    setAddingFromRegistry(true);
    setError('');
    try {
      const res = await apiFetch(`/api/projects/${projectId}/assets/from-registry`, {
        method: 'POST',
        body: JSON.stringify({ ids: [...selectedRegistryIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || t('projects.registryAddAssetsFailed'));
        return;
      }
      setImportMsg(
        t('projects.registryAddAssetsResult', {
          created: (data as { created?: number }).created ?? 0,
          skipped: (data as { skipped?: number }).skipped ?? 0,
        }),
      );
      if (Array.isArray((data as { assets?: ProjectAsset[] }).assets)) {
        setAssets((data as { assets: ProjectAsset[] }).assets);
        onAssetsChange?.((data as { assets: ProjectAsset[] }).assets);
      } else {
        await load();
      }
      setShowRegistryPicker(false);
    } finally {
      setAddingFromRegistry(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError(t('projects.assetNameRequired'));
      return;
    }
    const path = editingId
      ? `/api/projects/${projectId}/assets/${editingId}`
      : `/api/projects/${projectId}/assets`;
    const res = await apiFetch(path, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t('projects.assetSaveFailed'));
      return;
    }
    setShowForm(false);
    await load();
  };

  const remove = async (a: ProjectAsset) => {
    if (!confirm(t('projects.assetDeleteConfirm', { name: a.name }))) return;
    const res = await apiFetch(`/api/projects/${projectId}/assets/${a.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) await load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{t('projects.assetsInventory')}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.assetsInventoryHint')}</p>
        </div>
        {canUseRegistry && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openRegistryPicker()}
              className="px-3 py-1.5 text-xs border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-50"
            >
              {t('projects.fromIsRegistryAssets')}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                + {t('projects.assetAdd')}
              </button>
            )}
          </div>
        )}
      </div>

      {error && !showRegistryPicker && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {importMsg && <p className="text-xs text-emerald-700 mb-2">{importMsg}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{t('projects.assetsEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-2 font-medium">{t('projects.assetFields.name')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.assetFields.purpose')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.assetFields.supportOwner')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.assetFields.vendor')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.assetFields.criticality')}</th>
                {canWrite && <th className="py-2 font-medium">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {a.name}
                      {a.registrySystemId ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          {t('projects.fromRegistryBadge')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-gray-600 max-w-[12rem] truncate" title={a.purpose}>
                    {a.purpose || '—'}
                  </td>
                  <td className="py-2 pr-2 text-gray-600">{a.supportOwner || '—'}</td>
                  <td className="py-2 pr-2 text-gray-600">{a.vendor || '—'}</td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded ${
                        criticalityColors[a.criticality] || criticalityColors.medium
                      }`}
                    >
                      {a.criticality}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="text-brand-600 hover:underline mr-2"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(a)}
                        className="text-red-500 hover:underline"
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
      )}

      {showRegistryPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('projects.fromIsRegistryAssets')}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t('projects.fromIsRegistryAssetsHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegistryPicker(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 shrink-0">
                <input
                  type="search"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="overflow-y-auto px-5 py-3 flex-1 min-h-0">
                {registryLoading ? (
                  <p className="text-sm text-gray-400">{t('common.loading')}</p>
                ) : filteredRegistry.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">{t('projects.registryEmpty')}</p>
                ) : (
                  <div className="space-y-1">
                    {filteredRegistry.map((r) => {
                      const checked = selectedRegistryIds.has(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-start gap-2 text-sm px-2 py-2 rounded-lg border ${
                            r.alreadyInScope
                              ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                              : checked
                                ? 'border-brand-200 bg-brand-50 cursor-pointer'
                                : 'border-transparent hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-gray-300"
                            checked={checked || r.alreadyInScope}
                            disabled={r.alreadyInScope}
                            onChange={() => toggleRegistryId(r.id, r.alreadyInScope)}
                          />
                          <span className="min-w-0">
                            <span className="font-mono text-xs text-gray-500">{r.systemCode ? `${r.systemCode} · ` : ''}</span>
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {r.company}
                            </span>
                            {r.alreadyInScope && (
                              <span className="ml-2 text-[10px] text-gray-500">
                                ({t('projects.alreadyInScope')})
                              </span>
                            )}
                            {r.purpose ? (
                              <span className="block text-xs text-gray-500 truncate">{r.purpose}</span>
                            ) : null}
                          </span>
                          <span
                            className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                              criticalityColors[r.criticality] || criticalityColors.medium
                            }`}
                          >
                            {r.criticality}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRegistryPicker(false)}
                  className="px-4 py-2 text-sm text-gray-600"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!selectedRegistryIds.size || addingFromRegistry}
                  onClick={() => void addFromRegistry()}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {addingFromRegistry
                    ? t('common.loading')
                    : t('projects.addSelectedAssets', { count: selectedRegistryIds.size })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => void save(e)}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? t('projects.assetEdit') : t('projects.assetAdd')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  ['name', 'name'],
                  ['purpose', 'purpose'],
                  ['supportOwner', 'supportOwner'],
                  ['vendor', 'vendor'],
                  ['consumers', 'consumers'],
                ] as const
              ).map(([key, labelKey]) => (
                <div key={key} className={key === 'purpose' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t(`projects.assetFields.${labelKey}`)}
                  </label>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={key === 'name'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('projects.assetFields.criticality')}
                </label>
                <select
                  value={form.criticality}
                  onChange={(e) => setForm({ ...form, criticality: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('projects.assetFields.info')}
                </label>
                <textarea
                  value={form.info}
                  onChange={(e) => setForm({ ...form, info: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
