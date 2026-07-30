import { useCallback, useEffect, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { usePermission } from '../context/AuthContext';

interface AuditLogItem {
  id: string;
  createdAt: string;
  category: string;
  action: string;
  severity: string;
  success: boolean;
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: Record<string, { from?: unknown; to?: unknown } | unknown>;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

interface AuditMeta {
  actions: string[];
  entityTypes: string[];
  actors: { email: string; name: string }[];
  categories: string[];
  severities: string[];
}

const emptyFilters = {
  search: '',
  category: '',
  action: '',
  entityType: '',
  actorEmail: '',
  severity: '',
  success: '',
  from: '',
  to: '',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function severityClass(severity: string) {
  if (severity === 'critical') return 'bg-red-100 text-red-800';
  if (severity === 'warning') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function categoryClass(category: string) {
  return category === 'security'
    ? 'bg-violet-100 text-violet-800'
    : 'bg-sky-100 text-sky-800';
}

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const canRead = usePermission('audit:read');
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadMeta = useCallback(async () => {
    const res = await apiFetch('/api/audit-logs/meta');
    if (res.ok) setMeta(await res.json());
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const res = await apiFetch(`/api/audit-logs?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load');
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    if (!canRead) return;
    loadMeta();
  }, [canRead, loadMeta]);

  useEffect(() => {
    if (!canRead) return;
    loadLogs();
  }, [canRead, loadLogs]);

  if (!canRead) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        {t('auth.accessDenied')}
      </div>
    );
  }

  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-GB';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('audit.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('audit.subtitle')}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="search"
            value={filters.search}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, search: e.target.value })); }}
            placeholder={t('common.search')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={filters.category}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, category: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.category')}</option>
            {(meta?.categories || ['security', 'data']).map(c => (
              <option key={c} value={c}>{t(`audit.categories.${c}`, { defaultValue: c })}</option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, action: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.action')}</option>
            {(meta?.actions || []).map(a => (
              <option key={a} value={a}>{t(`audit.actions.${a}`, { defaultValue: a })}</option>
            ))}
          </select>
          <select
            value={filters.entityType}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, entityType: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.object')}</option>
            {(meta?.entityTypes || []).map(e => (
              <option key={e} value={e}>{t(`audit.entities.${e}`, { defaultValue: e })}</option>
            ))}
          </select>
          <select
            value={filters.actorEmail}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, actorEmail: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.actor')}</option>
            {(meta?.actors || []).map(a => (
              <option key={a.email} value={a.email}>{a.name || a.email} ({a.email})</option>
            ))}
          </select>
          <select
            value={filters.severity}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, severity: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.severity')}</option>
            {(meta?.severities || ['info', 'warning', 'critical']).map(s => (
              <option key={s} value={s}>{t(`audit.severities.${s}`, { defaultValue: s })}</option>
            ))}
          </select>
          <select
            value={filters.success}
            onChange={e => { setOffset(0); setFilters(f => ({ ...f, success: e.target.value })); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">{t('common.all')} — {t('audit.result')}</option>
            <option value="true">{t('audit.success')}</option>
            <option value="false">{t('audit.failed')}</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.from}
              onChange={e => { setOffset(0); setFilters(f => ({ ...f, from: e.target.value })); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              title={t('audit.from')}
            />
            <input
              type="date"
              value={filters.to}
              onChange={e => { setOffset(0); setFilters(f => ({ ...f, to: e.target.value })); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              title={t('audit.to')}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t('audit.showing', { shown: items.length, total })}</span>
          <button
            type="button"
            onClick={() => { setFilters(emptyFilters); setOffset(0); }}
            className="text-brand-600 hover:underline"
          >
            {t('audit.resetFilters')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="py-3 px-4 font-medium">{t('audit.when')}</th>
                <th className="py-3 px-4 font-medium">{t('audit.actor')}</th>
                <th className="py-3 px-4 font-medium">{t('audit.action')}</th>
                <th className="py-3 px-4 font-medium">{t('audit.object')}</th>
                <th className="py-3 px-4 font-medium">{t('audit.summary')}</th>
                <th className="py-3 px-4 font-medium">{t('audit.result')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">{t('common.loading')}</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">{t('common.noResults')}</td>
                </tr>
              ) : (
                items.map(item => {
                  const open = expanded === item.id;
                  const changeEntries = Object.entries(item.changes || {});
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpanded(open ? null : item.id)}
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600 align-top">
                          {new Date(item.createdAt).toLocaleString(locale)}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-gray-900">{item.actorName || '—'}</div>
                          <div className="text-xs text-gray-500">{item.actorEmail || '—'}</div>
                          {item.actorRole && (
                            <div className="text-[11px] text-gray-400 capitalize">{item.actorRole}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-wrap gap-1">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${categoryClass(item.category)}`}>
                              {t(`audit.categories.${item.category}`, { defaultValue: item.category })}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${severityClass(item.severity)}`}>
                              {t(`audit.actions.${item.action}`, { defaultValue: item.action })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="text-xs text-gray-500">
                            {t(`audit.entities.${item.entityType}`, { defaultValue: item.entityType || '—' })}
                          </div>
                          <div className="font-medium text-gray-800 max-w-[200px] truncate" title={item.entityLabel}>
                            {item.entityLabel || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-gray-700 max-w-md">
                          {item.summary}
                          {changeEntries.length > 0 && (
                            <div className="text-[11px] text-brand-600 mt-1">
                              {open ? t('audit.hideDetails') : t('audit.showDetails', { count: changeEntries.length })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${item.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {item.success ? t('audit.success') : t('audit.failed')}
                          </span>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-gray-50 bg-slate-50/80">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-gray-700 mb-2">{t('audit.changes')}</p>
                                {changeEntries.length === 0 ? (
                                  <p className="text-gray-400">{t('audit.noChanges')}</p>
                                ) : (
                                  <div className="space-y-2">
                                    {changeEntries.map(([field, change]) => {
                                      const typed = change as { from?: unknown; to?: unknown };
                                      const hasFromTo = typed && typeof typed === 'object' && ('from' in typed || 'to' in typed);
                                      return (
                                        <div key={field} className="border border-gray-200 rounded-lg bg-white p-2">
                                          <div className="font-medium text-gray-800 mb-1">{field}</div>
                                          {hasFromTo ? (
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <div className="text-gray-400 mb-0.5">{t('audit.from')}</div>
                                                <pre className="whitespace-pre-wrap break-all text-red-700/80">{formatValue(typed.from)}</pre>
                                              </div>
                                              <div>
                                                <div className="text-gray-400 mb-0.5">{t('audit.to')}</div>
                                                <pre className="whitespace-pre-wrap break-all text-emerald-700/80">{formatValue(typed.to)}</pre>
                                              </div>
                                            </div>
                                          ) : (
                                            <pre className="whitespace-pre-wrap break-all">{formatValue(change)}</pre>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="font-semibold text-gray-700 mb-2">{t('audit.context')}</p>
                                  <dl className="space-y-1 text-gray-600">
                                    <div className="flex gap-2"><dt className="w-24 text-gray-400">IP</dt><dd>{item.ipAddress || '—'}</dd></div>
                                    <div className="flex gap-2"><dt className="w-24 text-gray-400">UA</dt><dd className="break-all">{item.userAgent || '—'}</dd></div>
                                    <div className="flex gap-2"><dt className="w-24 text-gray-400">ID</dt><dd className="font-mono break-all">{item.entityId || '—'}</dd></div>
                                  </dl>
                                </div>
                                {Object.keys(item.metadata || {}).length > 0 && (
                                  <div>
                                    <p className="font-semibold text-gray-700 mb-2">{t('audit.metadata')}</p>
                                    <pre className="bg-white border border-gray-200 rounded-lg p-2 whitespace-pre-wrap break-all">
                                      {JSON.stringify(item.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <button
              type="button"
              disabled={offset <= 0}
              onClick={() => setOffset(o => Math.max(0, o - limit))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              {t('audit.prev')}
            </button>
            <span className="text-gray-500">
              {Math.floor(offset / limit) + 1} / {Math.max(1, Math.ceil(total / limit))}
            </span>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset(o => o + limit)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              {t('audit.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
