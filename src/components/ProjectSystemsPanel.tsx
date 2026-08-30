import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import type { ProjectSystem } from '../types';

const EMPTY_FORM = {
  name: '',
  purpose: '',
  owner: '',
  serverLocation: '',
  techSpecs: '',
  os: '',
  failover: '',
  security: '',
  criticality: 'medium',
  equipment: '',
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
  onSystemsChange?: (systems: ProjectSystem[]) => void;
}

export default function ProjectSystemsPanel({ projectId, canWrite, canLinkFromRegistry = false, onSystemsChange }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [systems, setSystems] = useState<ProjectSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
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
      const res = await apiFetch(`/api/projects/${projectId}/systems`);
      const data = res.ok ? ((await res.json()) as ProjectSystem[]) : [];
      setSystems(data);
      onSystemsChange?.(data);
    } catch {
      setSystems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, onSystemsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
  };

  const openEdit = (s: ProjectSystem) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      purpose: s.purpose,
      owner: s.owner,
      serverLocation: s.serverLocation,
      techSpecs: s.techSpecs,
      os: s.os,
      failover: s.failover,
      security: s.security,
      criticality: s.criticality || 'medium',
      equipment: s.equipment,
      info: s.info,
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
      const res = await apiFetch(`/api/projects/${projectId}/systems/registry-options`);
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
      const res = await apiFetch(`/api/projects/${projectId}/systems/from-registry`, {
        method: 'POST',
        body: JSON.stringify({ ids: [...selectedRegistryIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || t('projects.registryAddFailed'));
        return;
      }
      setImportMsg(
        t('projects.registryAddResult', {
          created: (data as { created?: number }).created ?? 0,
          skipped: (data as { skipped?: number }).skipped ?? 0,
        }),
      );
      if (Array.isArray((data as { systems?: ProjectSystem[] }).systems)) {
        setSystems((data as { systems: ProjectSystem[] }).systems);
        onSystemsChange?.((data as { systems: ProjectSystem[] }).systems);
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
      setError(t('projects.systemNameRequired'));
      return;
    }
    const path = editingId
      ? `/api/projects/${projectId}/systems/${editingId}`
      : `/api/projects/${projectId}/systems`;
    const res = await apiFetch(path, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t('projects.systemSaveFailed'));
      return;
    }
    setShowForm(false);
    await load();
  };

  const remove = async (s: ProjectSystem) => {
    if (!confirm(t('projects.systemDeleteConfirm', { name: s.name }))) return;
    const res = await apiFetch(`/api/projects/${projectId}/systems/${s.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) await load();
  };

  const downloadTemplate = async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/systems/template`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'systems-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await apiFetch(`/api/projects/${projectId}/systems/import`, {
        method: 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('projects.systemImportFailed'));
        return;
      }
      setImportMsg(
        t('projects.systemImportResult', {
          created: data.created ?? 0,
          updated: data.updated ?? 0,
        }),
      );
      if (Array.isArray(data.systems)) {
        setSystems(data.systems);
        onSystemsChange?.(data.systems);
      } else {
        await load();
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{t('projects.systemsInventory')}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{t('projects.systemsInventoryHint')}</p>
        </div>
        {canUseRegistry && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openRegistryPicker()}
              className="px-3 py-1.5 text-xs border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-50"
            >
              {t('projects.fromIsRegistry')}
            </button>
            {canWrite && (
              <>
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('projects.systemsTemplate')}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? '…' : t('projects.systemsImport')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              + {t('projects.systemAdd')}
            </button>
              </>
            )}
          </div>
        )}
      </div>

      {!canUseRegistry && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {t('projects.scopeSystemsReadOnly')}
        </p>
      )}

      {error && !showRegistryPicker && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {importMsg && <p className="text-xs text-emerald-700 mb-2">{importMsg}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      ) : systems.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{t('projects.systemsEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-2 font-medium">{t('projects.systemFields.name')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.systemFields.purpose')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.systemFields.owner')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.systemFields.os')}</th>
                <th className="py-2 pr-2 font-medium">{t('projects.systemFields.criticality')}</th>
                {canWrite && <th className="py-2 font-medium">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {s.name}
                      {s.registrySystemId ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          {t('projects.fromRegistryBadge')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-gray-600 max-w-[12rem] truncate" title={s.purpose}>
                    {s.purpose || '—'}
                  </td>
                  <td className="py-2 pr-2 text-gray-600">{s.owner || '—'}</td>
                  <td className="py-2 pr-2 text-gray-600">{s.os || '—'}</td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded ${
                        criticalityColors[s.criticality] || criticalityColors.medium
                      }`}
                    >
                      {s.criticality}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="text-brand-600 hover:underline mr-2"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s)}
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
                  <h3 className="text-lg font-semibold text-gray-900">{t('projects.fromIsRegistry')}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t('projects.fromIsRegistryHint')}</p>
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
                    : t('projects.addSelectedSystems', { count: selectedRegistryIds.size })}
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
              {editingId ? t('projects.systemEdit') : t('projects.systemAdd')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  ['name', 'name'],
                  ['purpose', 'purpose'],
                  ['owner', 'owner'],
                  ['serverLocation', 'serverLocation'],
                  ['techSpecs', 'techSpecs'],
                  ['os', 'os'],
                  ['failover', 'failover'],
                  ['security', 'security'],
                  ['equipment', 'equipment'],
                ] as const
              ).map(([key, labelKey]) => (
                <div key={key} className={key === 'purpose' || key === 'techSpecs' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t(`projects.systemFields.${labelKey}`)}
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
                  {t('projects.systemFields.criticality')}
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
                  {t('projects.systemFields.info')}
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
