import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { ControlAttachment, FRAMEWORKS, Policy, PolicyStatus } from '../types';
import { apiFetch } from '../lib/api';
import { usePermission } from '../context/AuthContext';

const emptyForm = {
  title: '',
  version: '1.0',
  status: 'draft' as PolicyStatus,
  framework: '',
  owner: '',
  description: '',
  lastReviewed: '',
  links: [''] as string[],
};

const statusColors: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700',
  in_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-700',
  archived: 'bg-purple-100 text-purple-700',
};

type PreviewState =
  | { kind: 'file'; policyId: string; att: ControlAttachment; url: string }
  | { kind: 'link'; url: string }
  | null;

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableMime(mime: string, name: string) {
  const lower = name.toLowerCase();
  if (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/')) return true;
  return /\.(pdf|png|jpe?g|gif|webp|svg|txt|md|csv|json|xml|html?)$/i.test(lower);
}

export default function PoliciesPage() {
  const { t } = useTranslation();
  const canWrite = usePermission('policies:write');
  const { policies, addPolicy, updatePolicy, deletePolicy, refreshPolicy } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState<PreviewState>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const filtered = policies.filter((p) => {
    const mSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const mStatus = !filterStatus || p.status === filterStatus;
    return mSearch && mStatus;
  });

  const closePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setUploadError('');
    setShowForm(true);
  };

  const openEdit = (p: Policy) => {
    setForm({
      title: p.title,
      version: p.version,
      status: p.status,
      framework: p.framework,
      owner: p.owner,
      description: p.description,
      lastReviewed: p.lastReviewed,
      links: p.links?.length ? [...p.links] : [''],
    });
    setEditingId(p.id);
    setUploadError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      version: form.version,
      status: form.status,
      framework: form.framework,
      owner: form.owner,
      description: form.description,
      lastReviewed: form.lastReviewed,
      links: form.links.map((l) => l.trim()).filter(Boolean),
      attachments: [] as ControlAttachment[],
    };
    if (editingId) {
      const { attachments: _a, ...rest } = payload;
      await updatePolicy(editingId, rest);
    } else {
      await addPolicy(payload);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const uploadFiles = async (policyId: string, fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      Array.from(fileList).forEach((f) => body.append('files', f));
      const res = await apiFetch(`/api/policies/${policyId}/attachments`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        setUploadError(t('policies.uploadFailed'));
        return;
      }
      refreshPolicy(await res.json() as Policy);
    } catch {
      setUploadError(t('policies.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (policyId: string, att: ControlAttachment) => {
    setUploadError('');
    try {
      const res = await apiFetch(`/api/policies/${policyId}/attachments/${att.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setUploadError(t('policies.deleteAttachmentFailed'));
        return;
      }
      refreshPolicy(await res.json() as Policy);
    } catch {
      setUploadError(t('policies.deleteAttachmentFailed'));
    }
  };

  const openFilePreview = async (policyId: string, att: ControlAttachment) => {
    closePreview();
    setPreviewLoading(true);
    try {
      const res = await apiFetch(`/api/policies/${policyId}/attachments/${att.id}`);
      if (!res.ok) {
        setUploadError(t('policies.previewFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview({ kind: 'file', policyId, att, url });
    } catch {
      setUploadError(t('policies.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const openLinkPreview = (url: string) => {
    closePreview();
    setPreview({ kind: 'link', url });
  };

  const editingPolicy = editingId ? policies.find((p) => p.id === editingId) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('policies.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('policies.description')}</p>
        </div>
        {canWrite && (
          <button onClick={openAdd} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
            + {t('policies.addPolicy')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('policies.statuses', { returnObjects: true }) as object).map((s) => (
            <option key={s} value={s}>{t(`policies.statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('policies.noPolicies')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const expanded = expandedId === p.id;
            const links = p.links || [];
            const attachments = p.attachments || [];
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="shrink-0 text-xs font-mono w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{p.title}</span>
                      <span className="text-xs text-gray-500">v{p.version}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status]}`}>
                        {t(`policies.statuses.${p.status}`)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.framework || '—'} · {p.owner || '—'} · {p.lastReviewed || '—'}
                      {attachments.length > 0 && ` · ${attachments.length} ${t('policies.files').toLowerCase()}`}
                      {links.length > 0 && ` · ${links.length} ${t('policies.links').toLowerCase()}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canWrite && (
                      <button onClick={() => openEdit(p)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">
                        {t('common.edit')}
                      </button>
                    )}
                    {canWrite && (
                      <button onClick={() => setDeleteConfirm(p.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {p.description && <p className="text-sm text-gray-600 mt-3 mb-3">{p.description}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">📄 {t('policies.files')} ({attachments.length})</p>
                        {attachments.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">{t('policies.noFiles')}</p>
                        ) : (
                          <div className="space-y-1">
                            {attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                                <span className="text-gray-700 truncate flex-1">{att.name}</span>
                                <span className="text-gray-400 shrink-0">{formatSize(att.size)}</span>
                                {isPreviewableMime(att.mimeType, att.name) ? (
                                  <button
                                    type="button"
                                    onClick={() => openFilePreview(p.id, att)}
                                    className="text-brand-600 hover:text-brand-800 font-medium shrink-0"
                                  >
                                    {t('policies.preview')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openFilePreview(p.id, att)}
                                    className="text-brand-600 hover:text-brand-800 font-medium shrink-0"
                                  >
                                    {t('policies.open')}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">🔗 {t('policies.links')} ({links.length})</p>
                        {links.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">{t('policies.noLinks')}</p>
                        ) : (
                          <div className="space-y-1">
                            {links.map((url) => (
                              <div key={url} className="flex items-center gap-2 text-xs bg-brand-50 rounded px-2 py-1.5">
                                <span className="text-brand-800 truncate flex-1">{url}</span>
                                <button
                                  type="button"
                                  onClick={() => openLinkPreview(url)}
                                  className="text-brand-600 hover:text-brand-800 font-medium shrink-0"
                                >
                                  {t('policies.preview')}
                                </button>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-600 hover:text-brand-800 font-medium shrink-0"
                                >
                                  {t('policies.open')}
                                </a>
                              </div>
                            ))}
                          </div>
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
            <p className="text-gray-900 font-medium mb-4">{t('policies.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
              <button
                onClick={() => { void deletePolicy(deleteConfirm); setDeleteConfirm(null); }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? t('policies.editPolicy') : t('policies.addPolicy')}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.title_')}</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.version')}</label>
                  <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label>
                  <select value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">—</option>
                    {FRAMEWORKS.map((fw) => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label>
                  <input type="text" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.lastReviewed')}</label>
                  <input type="date" value={form.lastReviewed} onChange={(e) => setForm({ ...form, lastReviewed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PolicyStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {(Object.keys(t('policies.statuses', { returnObjects: true }) as object)).map((s) => (
                    <option key={s} value={s}>{t(`policies.statuses.${s}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.links')}</label>
                <p className="text-xs text-gray-500 mb-2">{t('policies.linksHint')}</p>
                <div className="space-y-2">
                  {form.links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => setForm({
                          ...form,
                          links: form.links.map((l, idx) => (idx === i ? e.target.value : l)),
                        })}
                        placeholder="https://"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, links: form.links.filter((_, idx) => idx !== i) })}
                        className="px-2 text-red-600 text-sm"
                        disabled={form.links.length <= 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, links: [...form.links, ''] })}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  + {t('policies.addLink')}
                </button>
              </div>

              {editingPolicy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.files')}</label>
                  <p className="text-xs text-gray-500 mb-2">{t('policies.filesHint')}</p>
                  {(editingPolicy.attachments || []).length > 0 && (
                    <div className="space-y-1 mb-2">
                      {editingPolicy.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                          <span className="truncate flex-1">{att.name}</span>
                          <button type="button" onClick={() => openFilePreview(editingPolicy.id, att)} className="text-brand-600 font-medium">
                            {t('policies.preview')}
                          </button>
                          <button type="button" onClick={() => { void deleteAttachment(editingPolicy.id, att); }} className="text-red-600 font-medium">
                            {t('common.delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => { void uploadFiles(editingPolicy.id, e.target.files); }}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                  {uploading && <p className="text-xs text-gray-500 mt-1">{t('policies.uploading')}</p>}
                </div>
              )}

              {!editingId && (
                <p className="text-xs text-gray-500">{t('policies.saveFirstForFiles')}</p>
              )}

              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  {editingId ? t('common.save') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(preview || previewLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 truncate pr-4">
                {previewLoading
                  ? t('policies.loadingPreview')
                  : preview?.kind === 'file'
                    ? preview.att.name
                    : preview?.url}
              </h3>
              <div className="flex items-center gap-3 shrink-0">
                {preview?.kind === 'link' && (
                  <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-medium">
                    {t('policies.openInNewTab')}
                  </a>
                )}
                {preview?.kind === 'file' && (
                  <a href={preview.url} download={preview.att.name} className="text-xs text-brand-600 font-medium">
                    {t('policies.download')}
                  </a>
                )}
                <button type="button" onClick={closePreview} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 min-h-[60vh] bg-gray-100">
              {previewLoading && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">{t('policies.loadingPreview')}</div>
              )}
              {!previewLoading && preview?.kind === 'file' && (
                preview.att.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(preview.att.name) ? (
                  <div className="h-full overflow-auto flex items-center justify-center p-4">
                    <img src={preview.url} alt={preview.att.name} className="max-w-full max-h-[75vh] object-contain" />
                  </div>
                ) : preview.att.mimeType.startsWith('text/') || /\.(txt|md|csv|json|xml|html?)$/i.test(preview.att.name) ? (
                  <iframe title={preview.att.name} src={preview.url} className="w-full h-full min-h-[60vh] bg-white" />
                ) : (
                  <iframe title={preview.att.name} src={preview.url} className="w-full h-full min-h-[60vh] bg-white" />
                )
              )}
              {!previewLoading && preview?.kind === 'link' && (
                <div className="h-full flex flex-col">
                  <iframe title={preview.url} src={preview.url} className="w-full flex-1 min-h-[60vh] bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
                  <p className="text-xs text-gray-500 px-4 py-2 border-t border-gray-200">
                    {t('policies.linkPreviewNote')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
