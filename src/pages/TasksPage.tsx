import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { usePermission } from '../context/AuthContext';
import { GRCTask, TaskStatus, TaskPriority, FRAMEWORKS } from '../types';

const emptyForm = { title: '', description: '', status: 'remaining' as TaskStatus, priority: 'medium' as TaskPriority, framework: '', category: '', assignee: '', dueDate: '' };

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-blue-100 text-blue-700',
  remaining: 'bg-gray-100 text-gray-700', due_soon: 'bg-amber-100 text-amber-700', overdue: 'bg-red-100 text-red-700',
};
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-600', high: 'bg-orange-100 text-orange-600', critical: 'bg-red-100 text-red-600',
};

export default function TasksPage() {
  const { t } = useTranslation();
  const { tasks, addTask, updateTask, deleteTask } = useCompliance();
  const canWrite = usePermission('tasks:write');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFramework, setFilterFramework] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = tasks.filter(t => {
    const mSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.assignee.toLowerCase().includes(search.toLowerCase());
    const mStatus = !filterStatus || t.status === filterStatus;
    const mFw = !filterFramework || t.framework === filterFramework;
    return mSearch && mStatus && mFw;
  });

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (t: GRCTask) => { setForm({ title: t.title, description: t.description, status: t.status, priority: t.priority, framework: t.framework, category: t.category, assignee: t.assignee, dueDate: t.dueDate }); setEditingId(t.id); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateTask(editingId, form);
    else addTask(form);
    setShowForm(false); setForm(emptyForm); setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('tasks.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('tasks.description')}</p></div>
        {canWrite && (
          <button onClick={openAdd} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">+ {t('tasks.addTask')}</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(t('tasks.statuses', { returnObjects: true }) as object).map(s => <option key={s} value={s}>{t(`tasks.statuses.${s}`)}</option>)}
        </select>
        <select value={filterFramework} onChange={e => setFilterFramework(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('common.all')} — {t('common.framework')}</option>
          {FRAMEWORKS.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('tasks.noTasks')}</p><p className="text-gray-400 text-sm mt-1">{t('tasks.addFirst')}</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('tasks.title_')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.framework')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('tasks.assignee')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('tasks.priority')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('tasks.dueDate')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.status')}</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.actions')}</th>
            </tr></thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 max-w-xs">
                    <div className="font-medium truncate">{task.title}</div>
                    {task.sourceControlCode && (
                      <div className="text-[11px] text-amber-700 mt-0.5">Mitigation · {task.sourceControlCode}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{task.framework}</td>
                  <td className="py-3 px-4 text-gray-600">{task.assignee}</td>
                  <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${priorityColors[task.priority]}`}>{t(`tasks.priorities.${task.priority}`)}</span></td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{task.dueDate}</td>
                  <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[task.status]}`}>{t(`tasks.statuses.${task.status}`)}</span></td>
                  <td className="py-3 px-4">
                    {canWrite && (
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(task)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">{t('common.edit')}</button>
                        <button onClick={() => setDeleteConfirm(task.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">{t('common.delete')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('tasks.deleteConfirm')}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button onClick={() => { deleteTask(deleteConfirm); setDeleteConfirm(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{t('common.delete')}</button></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{editingId ? t('tasks.editTask') : t('tasks.addTask')}</h3><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.title_')}</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label><select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{FRAMEWORKS.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label><input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.assignee')}</label><input type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.dueDate')}</label><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.priority')}</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('tasks.priorities', { returnObjects: true }) as object)).map(p => <option key={p} value={p}>{t(`tasks.priorities.${p}`)}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('tasks.statuses', { returnObjects: true }) as object)).map(s => <option key={s} value={s}>{t(`tasks.statuses.${s}`)}</option>)}</select></div>
              </div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{editingId ? t('common.save') : t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
