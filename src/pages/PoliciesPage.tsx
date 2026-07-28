import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { Policy, PolicyStatus, FRAMEWORKS } from '../types';

const emptyForm = { title: '', version: '1.0', status: 'draft' as PolicyStatus, framework: '', owner: '', description: '', lastReviewed: '' };

const statusColors: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700', in_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-700', archived: 'bg-purple-100 text-purple-700',
};

export default function PoliciesPage() {
  const { t } = useTranslation();
  const { policies, addPolicy, updatePolicy, deletePolicy } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = policies.filter(p => {
    const mSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const mStatus = !filterStatus || p.status === filterStatus;
    return mSearch && mStatus;
  });

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (p: Policy) => { setForm({ title: p.title, version: p.version, status: p.status, framework: p.framework, owner: p.owner, description: p.description, lastReviewed: p.lastReviewed }); setEditingId(p.id); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editingId) updatePolicy(editingId, form); else addPolicy(form); setShowForm(false); setForm(emptyForm); setEditingId(null); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('policies.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('policies.description')}</p></div>
        <button onClick={openAdd} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">+ {t('policies.addPolicy')}</button>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('policies.statuses', { returnObjects: true }) as object).map(s => <option key={s} value={s}>{t(`policies.statuses.${s}`)}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('policies.noPolicies')}</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('policies.title_')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('policies.version')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.framework')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.owner')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('controls.lastReviewed')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.status')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.actions')}</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 max-w-xs truncate font-medium">{p.title}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{p.version}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{p.framework}</td>
                  <td className="py-3 px-4 text-gray-600">{p.owner}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{p.lastReviewed}</td>
                  <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status]}`}>{t(`policies.statuses.${p.status}`)}</span></td>
                  <td className="py-3 px-4"><div className="flex gap-2"><button onClick={() => openEdit(p)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{t('common.edit')}</button><button onClick={() => setDeleteConfirm(p.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">{t('common.delete')}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('policies.deleteConfirm')}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button onClick={() => { deletePolicy(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button></div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{editingId ? t('policies.editPolicy') : t('policies.addPolicy')}</h3><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.title_')}</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.version')}</label><input type="text" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label><select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{FRAMEWORKS.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.owner')}</label><input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('controls.lastReviewed')}</label><input type="date" value={form.lastReviewed} onChange={e => setForm({ ...form, lastReviewed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PolicyStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('policies.statuses', { returnObjects: true }) as object)).map(s => <option key={s} value={s}>{t(`policies.statuses.${s}`)}</option>)}</select></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{editingId ? t('common.save') : t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
