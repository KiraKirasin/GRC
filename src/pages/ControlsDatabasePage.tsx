import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { FRAMEWORKS, frameworksFromControls } from '../types';

const statusColors: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-700', not_applicable: 'bg-purple-100 text-purple-700',
};

export default function ControlsDatabasePage() {
  const { t } = useTranslation();
  const { controls } = useCompliance();
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEvidence, setFilterEvidence] = useState<'all' | 'has_evidence' | 'no_evidence'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const frameworkOptions = useMemo(() => {
    const fromData = frameworksFromControls(controls);
    return fromData.length > 0 ? fromData : FRAMEWORKS.map(f => ({ name: f.name, shortName: f.shortName }));
  }, [controls]);

  const filtered = controls.filter(c => {
    const q = search.toLowerCase();
    const mSearch = !search ||
      c.title.toLowerCase().includes(q) ||
      c.owner.toLowerCase().includes(q) ||
      c.source.toLowerCase().includes(q) ||
      c.controlDesign.toLowerCase().includes(q) ||
      (c.controlCode || '').toLowerCase().includes(q);
    const mStatus = !filterStatus || c.status === filterStatus;
    const mFw = !filterFramework || c.framework === filterFramework;
    const hasEvidence = c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0;
    const mEvidence = filterEvidence === 'all' || (filterEvidence === 'has_evidence' && hasEvidence) || (filterEvidence === 'no_evidence' && !hasEvidence);
    return mSearch && mStatus && mFw && mEvidence;
  });

  const totalEvidence = controls.reduce((sum, c) => sum + c.evidence.length + c.evidenceLinks.length + c.attachments.length, 0);
  const totalWithEvidence = controls.filter(c => c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('database.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('database.description')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{controls.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('database.totalControls')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-emerald-600">{totalWithEvidence}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('database.withEvidence')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-brand-600">{totalEvidence}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('database.totalEvidenceItems')}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{controls.length - totalWithEvidence}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('database.missingEvidence')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={filterFramework} onChange={e => setFilterFramework(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.framework')}</option>
          {frameworkOptions.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('controls.statuses', { returnObjects: true }) as object).map(s => <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>)}
        </select>
        <select value={filterEvidence} onChange={e => setFilterEvidence(e.target.value as 'all' | 'has_evidence' | 'no_evidence')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">{t('database.allControls')}</option>
          <option value="has_evidence">{t('database.hasEvidence')}</option>
          <option value="no_evidence">{t('database.noEvidence')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('common.noResults')}</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isExpanded = expandedId === c.id;
            const hasEvidence = c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0;
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left"
                >
                  <span className={`shrink-0 text-xs font-mono w-6 h-6 flex items-center justify-center rounded transition-colors ${isExpanded ? 'bg-brand-200 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.controlCode && <span className="font-mono text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">{c.controlCode}</span>}
                      <span className="font-medium text-gray-900 truncate">{c.title}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status]}`}>{t(`controls.statuses.${c.status}`)}</span>
                      {!hasEvidence && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">{t('database.missingEvidence')}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.framework} · {c.category} · {c.owner} · {t('controls.lastReviewed')}: {c.lastReviewed}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">{c.evidence.length + c.evidenceLinks.length + c.attachments.length}</p>
                    <p className="text-xs text-gray-400">{t('database.evidenceCount')}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                      <div className="space-y-3">
                        {c.source && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-0.5">{t('database.source')}</p>
                            <p className="text-sm text-gray-900">{c.source}</p>
                          </div>
                        )}
                        {c.controlDesign && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-0.5">{t('database.controlDesign')}</p>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{c.controlDesign}</p>
                          </div>
                        )}
                        {c.category && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-0.5">{t('common.category')}</p>
                            <p className="text-sm text-gray-900">{c.category}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {c.evidence.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">{t('database.evidenceFiles')} ({c.evidence.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {c.evidence.map((f, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                  📄 {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {c.evidenceLinks.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">{t('database.evidenceLinks')} ({c.evidenceLinks.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {c.evidenceLinks.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs font-medium hover:bg-brand-200">
                                  🔗 {url.length > 40 ? url.slice(0, 40) + '...' : url}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {c.attachments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">{t('database.attachments')} ({c.attachments.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {c.attachments.map((a, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                                  📎 {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {!hasEvidence && (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {t('database.noEvidenceMsg')}
                          </div>
                        )}
                      </div>
                    </div>

                    {c.accessList && c.accessList.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-1">{t('database.access')} ({c.accessList.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {c.accessList.map((a, i) => (
                            <span key={i} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                              {a.name} ({a.role}) — {a.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
