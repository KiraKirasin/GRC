import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { COMPANIES, type CompanyName } from '../types';

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

export default function AdminImportPage() {
  const { t } = useTranslation();
  const canAccess = usePermission('users:manage');
  const canImportControls = usePermission('controls:write') || canAccess;
  const canImportSystems = usePermission('systems-registry:write') || canAccess;

  const controlsFileRef = useRef<HTMLInputElement>(null);
  const systemsFileRef = useRef<HTMLInputElement>(null);

  const [controlsFramework, setControlsFramework] = useState('');
  const [systemsCompany, setSystemsCompany] = useState<CompanyName>(COMPANIES[0]);
  const [controlsBusy, setControlsBusy] = useState(false);
  const [systemsBusy, setSystemsBusy] = useState(false);
  const [controlsResult, setControlsResult] = useState<ImportResult | null>(null);
  const [systemsResult, setSystemsResult] = useState<ImportResult | null>(null);
  const [controlsError, setControlsError] = useState('');
  const [systemsError, setSystemsError] = useState('');

  if (!canAccess && !canImportControls && !canImportSystems) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t('auth.accessDenied')}</p>
      </div>
    );
  }

  const downloadTemplate = async (path: string, filename: string) => {
    const res = await apiFetch(path);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadFile = async (
    path: string,
    file: File,
    extra: Record<string, string>,
  ): Promise<ImportResult> => {
    const body = new FormData();
    body.append('file', file);
    for (const [k, v] of Object.entries(extra)) {
      if (v) body.append(k, v);
    }
    const res = await apiFetch(path, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || t('adminImport.failed'));
    }
    return data as ImportResult;
  };

  const onControlsFile = async (file: File | null) => {
    if (!file || !canImportControls) return;
    setControlsBusy(true);
    setControlsError('');
    setControlsResult(null);
    try {
      const result = await uploadFile('/api/admin/import/controls', file, {
        framework: controlsFramework,
      });
      setControlsResult(result);
    } catch (err) {
      setControlsError(err instanceof Error ? err.message : t('adminImport.failed'));
    } finally {
      setControlsBusy(false);
      if (controlsFileRef.current) controlsFileRef.current.value = '';
    }
  };

  const onSystemsFile = async (file: File | null) => {
    if (!file || !canImportSystems) return;
    setSystemsBusy(true);
    setSystemsError('');
    setSystemsResult(null);
    try {
      const result = await uploadFile('/api/admin/import/information-systems', file, {
        company: systemsCompany,
      });
      setSystemsResult(result);
    } catch (err) {
      setSystemsError(err instanceof Error ? err.message : t('adminImport.failed'));
    } finally {
      setSystemsBusy(false);
      if (systemsFileRef.current) systemsFileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('adminImport.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('adminImport.description')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canImportControls && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('adminImport.controlsTitle')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('adminImport.controlsHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('adminImport.defaultFramework')}
              </label>
              <input
                type="text"
                value={controlsFramework}
                onChange={(e) => setControlsFramework(e.target.value)}
                placeholder="ISO 27001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">{t('adminImport.defaultFrameworkHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void downloadTemplate(
                    '/api/admin/import/controls/template',
                    'controls-import-template.csv',
                  )
                }
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('adminImport.downloadTemplate')}
              </button>
              <button
                type="button"
                disabled={controlsBusy}
                onClick={() => controlsFileRef.current?.click()}
                className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {controlsBusy ? t('common.loading') : t('adminImport.uploadFile')}
              </button>
              <input
                ref={controlsFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void onControlsFile(e.target.files?.[0] || null)}
              />
            </div>
            {controlsError && <p className="text-sm text-red-600">{controlsError}</p>}
            {controlsResult && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {t('adminImport.result', {
                  created: controlsResult.created,
                  updated: controlsResult.updated,
                  skipped: controlsResult.skipped,
                })}
                {controlsResult.errors && controlsResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                    {controlsResult.errors.slice(0, 8).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {canImportSystems && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('adminImport.systemsTitle')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('adminImport.systemsHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('adminImport.defaultCompany')}
              </label>
              <select
                value={systemsCompany}
                onChange={(e) => setSystemsCompany(e.target.value as CompanyName)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('adminImport.defaultCompanyHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void downloadTemplate(
                    '/api/admin/import/information-systems/template',
                    'is-registry-import-template.csv',
                  )
                }
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('adminImport.downloadTemplate')}
              </button>
              <button
                type="button"
                disabled={systemsBusy}
                onClick={() => systemsFileRef.current?.click()}
                className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {systemsBusy ? t('common.loading') : t('adminImport.uploadFile')}
              </button>
              <input
                ref={systemsFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void onSystemsFile(e.target.files?.[0] || null)}
              />
            </div>
            {systemsError && <p className="text-sm text-red-600">{systemsError}</p>}
            {systemsResult && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {t('adminImport.result', {
                  created: systemsResult.created,
                  updated: systemsResult.updated,
                  skipped: systemsResult.skipped,
                })}
                {systemsResult.errors && systemsResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                    {systemsResult.errors.slice(0, 8).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
