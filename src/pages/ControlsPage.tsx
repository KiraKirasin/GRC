import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { GRCControl, ControlStatus, FRAMEWORKS, frameworksFromControls } from '../types';

const emptyForm: Omit<GRCControl, 'id' | 'createdAt' | 'updatedAt'> = { title: '', description: '', framework: '', category: '', status: 'pending', owner: '', evidence: [], evidenceLinks: [], attachments: [], controlDesign: '', source: '', accessList: [], lastReviewed: '' };

const statusColors: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-700', not_applicable: 'bg-purple-100 text-purple-700',
};

export default function ControlsPage() {
  const { t } = useTranslation();
  const { controls, addControl, updateControl, deleteControl } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFramework, setFilterFramework] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const frameworkOptions = useMemo(() => {
    const fromData = frameworksFromControls(controls);
    return fromData.length > 0 ? fromData : FRAMEWORKS.map(f => ({ name: f.name, shortName: f.shortName }));
  }, [controls]);

  const filtered = controls.filter(c => {
    const q = search.toLowerCase();
    const mSearch = !search ||
      c.title.toLowerCase().includes(q) ||
      c.owner.toLowerCase().includes(q) ||
      (c.controlCode || '').toLowerCase().includes(q) ||
      c.source.toLowerCase().includes(q);
    const mStatus = !filterStatus || c.status === filterStatus;
    const mFw = !filterFramework || c.framework === filterFramework;
    return mSearch && mStatus && mFw;
  });

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (c: GRCControl) => { setForm({ title: c.title, description: c.description, framework: c.framework, category: c.category, status: c.status, owner: c.owner, evidence: c.evidence, evidenceLinks: c.evidenceLinks, attachments: c.attachments, controlDesign: c.controlDesign, source: c.source, accessList: c.accessList, lastReviewed: c.lastReviewed, controlCode: c.controlCode }); setEditingId(c.id); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editingId) updateControl(editingId, form); else addControl(form); setShowForm(false); setForm(emptyForm); setEditingId(null); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('controls.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('controls.description')}</p></div>
        <button onClick={openAdd} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">+ {t('controls.addControl')}</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('controls.statuses', { returnObjects: true }) as object).map(s => <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>)}
        </select>
        <select value={filterFramework} onChange={e => setFilterFramework(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.framework')}</option>
          {frameworkOptions.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('controls.noControls')}</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('controls.code')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('controls.title_')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.framework')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.owner')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('controls.evidence')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('controls.lastReviewed')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.status')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.actions')}</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">{c.controlCode || '—'}</td>
                  <td className="py-3 px-4 text-gray-900 max-w-xs truncate font-medium">{c.title}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{c.framework}</td>
                  <td className="py-3 px-4 text-gray-600">{c.owner}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{c.evidence.length > 0 ? c.evidence.length : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{c.lastReviewed}</td>
                  <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status]}`}>{t(`controls.statuses.${c.status}`)}</span></td>
                  <td className="py-3 px-4"><div className="flex gap-2"><button onClick={() => openEdit(c)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{t('common.edit')}</button><button onClick={() => setDeleteConfirm(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">{t('common.delete')}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('controls.deleteConfirm')}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button onClick={() => { deleteControl(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{editingId ? t('controls.editControl') : t('controls.addControl')}</h3><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.title_')}</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label><select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required><option value="">—</option>{frameworkOptions.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label><input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label><input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.lastReviewed')}</label><input type="date" value={form.lastReviewed} onChange={e => setForm({ ...form, lastReviewed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ControlStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('controls.statuses', { returnObjects: true }) as object)).map(s => <option key={s} value={s}>{t(`controls.statuses.${s}`)}</option>)}</select></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{editingId ? t('common.save') : t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
