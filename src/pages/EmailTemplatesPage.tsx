import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { usePermission } from '../context/AuthContext';

type Locale = 'uk' | 'en' | 'ru';

type Template = {
  id: string;
  process: string;
  processLabel?: string;
  locale: Locale;
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  enabled: boolean;
};

const LOCALES: Locale[] = ['uk', 'en', 'ru'];
const PROCESS_KEYS = ['user_created', 'control_assigned', 'system_update_assigned', 'task_assigned'] as const;

const EMPTY_CREATE = {
  process: 'user_created' as string,
  customProcess: '',
  name: '',
  subject: '',
  bodyText: '',
  bodyHtml: '',
  enabled: true,
};

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const canRead = usePermission('email-templates:read');
  const canWrite = usePermission('email-templates:write');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [locale, setLocale] = useState<Locale>('uk');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await apiFetch('/api/email-templates');
    if (!res.ok) throw new Error();
    return (await res.json()) as Template[];
  };

  useEffect(() => {
    if (!canRead) return;
    setLoading(true);
    load()
      .then((data) => {
        setTemplates(data);
        const preferred = data.find((item) => item.locale === locale) || data[0];
        if (preferred) {
          setLocale(preferred.locale);
          setSelectedId(preferred.id);
          setForm(preferred);
        }
      })
      .catch(() => setError(t('emailTemplates.loadFailed')))
      .finally(() => setLoading(false));
  }, [canRead, t]);

  const templatesForLocale = useMemo(
    () => templates.filter((item) => item.locale === locale).sort((a, b) => a.name.localeCompare(b.name)),
    [templates, locale],
  );

  const availableProcesses = useMemo(() => {
    const used = new Set(templatesForLocale.map((item) => item.process));
    return PROCESS_KEYS.filter((p) => !used.has(p));
  }, [templatesForLocale]);

  useEffect(() => {
    if (creating) return;
    setSelectedId((current) => {
      const stillValid = templatesForLocale.some((item) => item.id === current);
      if (stillValid) {
        setForm(templatesForLocale.find((item) => item.id === current) || null);
        return current;
      }
      const first = templatesForLocale[0] || null;
      setForm(first);
      return first?.id || '';
    });
  }, [locale, templatesForLocale, creating]);

  const selectLocale = (next: Locale) => {
    setLocale(next);
    setCreating(false);
    setMessage('');
    setError('');
    const first = templates.find((item) => item.locale === next);
    setSelectedId(first?.id || '');
    setForm(first || null);
  };

  const selectTemplate = (id: string) => {
    const next = templatesForLocale.find((item) => item.id === id) || null;
    setSelectedId(id);
    setForm(next);
    setCreating(false);
    setMessage('');
    setError('');
  };

  const openCreate = () => {
    setCreating(true);
    setForm(null);
    setSelectedId('');
    setCreateForm({
      ...EMPTY_CREATE,
      process: availableProcesses[0] || 'custom',
      customProcess: '',
      name: '',
      subject: '',
      bodyText: '',
      bodyHtml: '',
      enabled: true,
    });
    setMessage('');
    setError('');
  };

  const save = async () => {
    if (!form || !canWrite) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch(`/api/email-templates/${form.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || t('emailTemplates.saveFailed'));
      }
      const updated = (await res.json()) as Template;
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? { ...updated, processLabel: item.processLabel } : item)));
      setForm(updated);
      setMessage(t('emailTemplates.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('emailTemplates.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!canWrite) return;
    const process =
      createForm.process === 'custom'
        ? createForm.customProcess.trim().toLowerCase().replace(/\s+/g, '_')
        : createForm.process;
    if (!process) {
      setError(t('emailTemplates.processRequired'));
      return;
    }
    if (!createForm.name.trim()) {
      setError(t('emailTemplates.nameRequired'));
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch('/api/email-templates', {
        method: 'POST',
        body: JSON.stringify({
          process,
          locale,
          name: createForm.name.trim(),
          subject: createForm.subject.trim() || createForm.name.trim(),
          bodyText: createForm.bodyText,
          bodyHtml: createForm.bodyHtml,
          enabled: createForm.enabled,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || t('emailTemplates.createFailed'));
      }
      const created = body as Template;
      setTemplates((prev) => [...prev, created]);
      setCreating(false);
      setSelectedId(created.id);
      setForm(created);
      setMessage(t('emailTemplates.created'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('emailTemplates.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) return <div className="text-center py-16 text-gray-500">{t('auth.accessDenied')}</div>;
  if (loading) return <div className="text-center py-16 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('emailTemplates.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('emailTemplates.description')}</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            + {t('emailTemplates.create')}
          </button>
        )}
      </div>

      {(message || error) && (
        <div className={`px-3 py-2 rounded-lg text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>
          {error || message}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.language')}</label>
            <select
              value={locale}
              onChange={(e) => selectLocale(e.target.value as Locale)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`emailTemplates.locales.${l}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.template')}</label>
            <select
              value={creating ? '' : selectedId}
              onChange={(e) => selectTemplate(e.target.value)}
              disabled={creating || templatesForLocale.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              {templatesForLocale.length === 0 ? (
                <option value="">{t('emailTemplates.noTemplatesForLocale')}</option>
              ) : (
                templatesForLocale.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.process})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{t('emailTemplates.createTitle')}</h3>
              <p className="text-xs text-gray-500">
                {t(`emailTemplates.locales.${locale}`)} ({locale.toUpperCase()})
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={createForm.enabled}
                onChange={(e) => setCreateForm({ ...createForm, enabled: e.target.checked })}
              />
              {t('emailTemplates.enabled')}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.process')}</label>
              <select
                value={createForm.process}
                onChange={(e) => setCreateForm({ ...createForm, process: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {availableProcesses.map((p) => (
                  <option key={p} value={p}>
                    {t(`emailTemplates.processes.${p}`)}
                  </option>
                ))}
                <option value="custom">{t('emailTemplates.customProcess')}</option>
              </select>
            </div>
            {createForm.process === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.customProcessKey')}</label>
                <input
                  value={createForm.customProcess}
                  onChange={(e) => setCreateForm({ ...createForm, customProcess: e.target.value })}
                  placeholder="approval_requested"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
            )}
            <div className={createForm.process === 'custom' ? '' : 'sm:col-span-1'}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.name')}</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.subject')}</label>
            <input
              value={createForm.subject}
              onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyText')}</label>
            <textarea
              value={createForm.bodyText}
              onChange={(e) => setCreateForm({ ...createForm, bodyText: e.target.value })}
              rows={9}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyHtml')}</label>
            <textarea
              value={createForm.bodyHtml}
              onChange={(e) => setCreateForm({ ...createForm, bodyHtml: e.target.value })}
              rows={7}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <p className="text-xs text-gray-500">{t('emailTemplates.variables')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                const first = templatesForLocale[0] || null;
                setSelectedId(first?.id || '');
                setForm(first);
              }}
              className="px-4 py-2 text-sm text-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void create()}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('emailTemplates.create')}
            </button>
          </div>
        </div>
      )}

      {!creating && form && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.name')}</label>
              <input
                disabled={!canWrite}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.process} · {form.locale.toUpperCase()}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 shrink-0 mt-6">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              {t('emailTemplates.enabled')}
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.subject')}</label>
            <input
              disabled={!canWrite}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyText')}</label>
            <textarea
              disabled={!canWrite}
              value={form.bodyText}
              onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              rows={9}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyHtml')}</label>
            <textarea
              disabled={!canWrite}
              value={form.bodyHtml}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              rows={7}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <p className="text-xs text-gray-500">{t('emailTemplates.variables')}</p>
          {canWrite && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      )}

      {!creating && !form && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
          {t('emailTemplates.noTemplatesForLocale')}
          {canWrite && (
            <div className="mt-3">
              <button type="button" onClick={openCreate} className="text-sm text-brand-600 hover:underline">
                + {t('emailTemplates.create')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
