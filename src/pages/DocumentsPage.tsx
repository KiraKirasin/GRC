import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { DocumentType, FRAMEWORKS } from '../types';

const typeColors: Record<string, string> = {
  procedure: 'bg-blue-100 text-blue-700', standard: 'bg-purple-100 text-purple-700',
  evidence: 'bg-emerald-100 text-emerald-700', report: 'bg-amber-100 text-amber-700',
  certificate: 'bg-green-100 text-green-700', policy: 'bg-brand-200 text-brand-700', other: 'bg-gray-100 text-gray-700',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { documents, addDocument, deleteDocument } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'other' as DocumentType, framework: '', status: 'active' as 'active' | 'archived' });
  const [files, setFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const [links, setLinks] = useState<string[]>(['']);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = documents.filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, size: f.size, type: f.type }));
      setFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const addLink = () => setLinks(prev => [...prev, '']);
  const removeLink = (index: number) => setLinks(prev => prev.filter((_, i) => i !== index));
  const updateLink = (index: number, value: string) => setLinks(prev => prev.map((l, i) => i === index ? value : l));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const validLinks = links.filter(l => l.trim());
    addDocument({ ...form, files, links: validLinks, uploadedAt: now, updatedAt: now });
    setShowForm(false);
    setForm({ title: '', type: 'other' as DocumentType, framework: '', status: 'active' });
    setFiles([]);
    setLinks(['']);
  };

  const openForm = () => {
    setForm({ title: '', type: 'other' as DocumentType, framework: '', status: 'active' });
    setFiles([]);
    setLinks(['']);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('documents.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('documents.description')}</p></div>
        <button onClick={openForm} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">+ {t('documents.addDocument')}</button>
      </div>
      <div className="flex gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('documents.noDocuments')}</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const isExpanded = expandedId === d.id;
            const hasFiles = d.files && d.files.length > 0;
            const hasLinks = d.links && d.links.length > 0;
            return (
              <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    className="shrink-0 text-xs font-mono w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{d.title}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColors[d.type]}`}>{t(`documents.types.${d.type}`)}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{t(`documents.statuses.${d.status}`)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.framework} · {new Date(d.uploadedAt).toLocaleDateString()}
                      {hasFiles && ` · ${d.files!.length} file(s)`}
                      {hasLinks && ` · ${d.links!.length} link(s)`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : d.id)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{isExpanded ? t('common.close') : t('common.edit')}</button>
                    <button onClick={() => setDeleteConfirm(d.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">{t('common.delete')}</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">📄 {t('documents.files', 'Files')} ({hasFiles ? d.files!.length : 0})</p>
                        {hasFiles ? (
                          <div className="space-y-1">
                            {d.files!.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                                <span className="text-gray-600 truncate flex-1">{f.name}</span>
                                <span className="text-gray-400 shrink-0">{formatSize(f.size)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">{t('documents.noFiles', 'No files')}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">🔗 {t('documents.links', 'Links')} ({hasLinks ? d.links!.length : 0})</p>
                        {hasLinks ? (
                          <div className="space-y-1">
                            {d.links!.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs bg-brand-100 text-brand-700 rounded px-2 py-1 hover:bg-brand-200 truncate">
                                🔗 {url}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">{t('documents.noLinks', 'No links')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('documents.deleteConfirm')}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button onClick={() => { deleteDocument(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button></div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{t('documents.addDocument')}</h3><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('documents.title_')}</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('documents.type')}</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DocumentType })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('documents.types', { returnObjects: true }) as object)).map(ty => <option key={ty} value={ty}>{t(`documents.types.${ty}`)}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('documents.framework')}</label><select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{FRAMEWORKS.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}</select></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">{t('documents.files', 'Files')}</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ {t('common.add')}</button>
                </div>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
                {files.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                        <span className="text-gray-600 truncate flex-1">{f.name}</span>
                        <span className="text-gray-400 shrink-0">{formatSize(f.size)}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">{t('documents.noFiles', 'No files selected')}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">🔗 {t('documents.links', 'Links')}</label>
                  <button type="button" onClick={addLink} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ {t('common.add')}</button>
                </div>
                <div className="space-y-1">
                  {links.map((link, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input type="url" value={link} onChange={e => updateLink(i, e.target.value)} placeholder="https://..." className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />
                      {links.length > 1 && (
                        <button type="button" onClick={() => removeLink(i)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
