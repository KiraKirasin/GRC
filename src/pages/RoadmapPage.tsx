import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { Milestone, FRAMEWORKS } from '../types';

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700', delayed: 'bg-red-100 text-red-700',
};

export default function RoadmapPage() {
  const { t } = useTranslation();
  const { milestones, addMilestone, updateMilestone } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', status: 'not_started' as Milestone['status'], framework: 'All', progress: 0 });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); addMilestone(form); setShowForm(false); setForm({ title: '', description: '', dueDate: '', status: 'not_started', framework: 'All', progress: 0 }); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('roadmap.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('roadmap.description')}</p></div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">+ {t('roadmap.addMilestone')}</button>
      </div>
      {milestones.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200"><p className="text-gray-400 text-lg">{t('common.noResults')}</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milestones.map(m => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{m.title}</h3>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[m.status]}`}>{t(`roadmap.statuses.${m.status}`)}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{m.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span>{m.framework}</span>
                {m.dueDate && <span>{t('roadmap.dueDate')}: {m.dueDate}</span>}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">{t('roadmap.progress')}</span>
                  <span className="text-gray-700 font-medium">{m.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${m.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{t('roadmap.addMilestone')}</h3><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('policies.title_')}</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.framework')}</label><select value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="All">All</option>{FRAMEWORKS.map(fw => <option key={fw.name} value={fw.name}>{fw.shortName}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('roadmap.dueDate')}</label><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('roadmap.progress')} ({form.progress}%)</label><input type="range" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} className="w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Milestone['status'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">{(Object.keys(t('roadmap.statuses', { returnObjects: true }) as object)).map(s => <option key={s} value={s}>{t(`roadmap.statuses.${s}`)}</option>)}</select></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">{t('common.cancel')}</button><button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
