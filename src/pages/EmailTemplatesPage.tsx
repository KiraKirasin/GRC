import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { usePermission } from '../context/AuthContext';

type Template = {
  id: string;
  process: string;
  processLabel?: string;
  locale: 'uk' | 'en' | 'ru';
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  enabled: boolean;
};

const PROCESS_KEYS = ['user_created', 'control_assigned', 'system_update_assigned', 'task_assigned'];

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const canRead = usePermission('email-templates:read');
  const canWrite = usePermission('email-templates:write');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!canRead) return;
    apiFetch('/api/email-templates')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json() as Template[];
        setTemplates(data);
        if (data[0]) { setSelectedId(data[0].id); setForm(data[0]); }
      })
      .catch(() => setMessage(t('emailTemplates.loadFailed')))
      .finally(() => setLoading(false));
  }, [canRead, t]);

  const selectTemplate = (id: string) => {
    const next = templates.find(item => item.id === id) || null;
    setSelectedId(id);
    setForm(next);
    setMessage('');
  };

  const save = async () => {
    if (!form || !canWrite) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch(`/api/email-templates/${form.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Template;
      setTemplates(prev => prev.map(item => item.id === updated.id ? updated : item));
      setForm(updated);
      setMessage(t('emailTemplates.saved'));
    } catch {
      setMessage(t('emailTemplates.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) return <div className="text-center py-16 text-gray-500">{t('auth.accessDenied')}</div>;
  if (loading) return <div className="text-center py-16 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('emailTemplates.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('emailTemplates.description')}</p>
      </div>
      {message && <div className="px-3 py-2 rounded-lg bg-brand-50 text-brand-700 text-sm">{message}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
          {PROCESS_KEYS.flatMap(process => templates.filter(item => item.process === process)).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTemplate(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedId === item.id ? 'bg-brand-100 text-brand-800' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className="block font-medium">{item.name}</span>
              <span className="text-xs opacity-70">{item.locale.toUpperCase()} · {item.enabled ? t('emailTemplates.enabled') : t('emailTemplates.disabled')}</span>
            </button>
          ))}
        </div>
        {form && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">{form.name}</h3>
                <p className="text-xs text-gray-500">{form.process} · {form.locale.toUpperCase()}</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.enabled} disabled={!canWrite} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                {t('emailTemplates.enabled')}
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.subject')}</label>
              <input disabled={!canWrite} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyText')}</label>
              <textarea disabled={!canWrite} value={form.bodyText} onChange={e => setForm({ ...form, bodyText: e.target.value })} rows={9} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailTemplates.bodyHtml')}</label>
              <textarea disabled={!canWrite} value={form.bodyHtml} onChange={e => setForm({ ...form, bodyHtml: e.target.value })} rows={7} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>
            <p className="text-xs text-gray-500">{t('emailTemplates.variables')}</p>
            {canWrite && <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? t('common.saving') : t('common.save')}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
