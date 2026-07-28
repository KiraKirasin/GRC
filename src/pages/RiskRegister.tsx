import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRisks } from '../context/RiskContext';
import { CRITERIA, getCategories, getCategorySubcategories } from '../data/criteria';
import { calculateRiskLevel, getRiskLevelLabel, getRiskLevelColor, RiskItem, RiskStatus } from '../types';

const LIKERT = [1, 2, 3, 4, 5];

const initialForm = {
  criterionId: 0,
  inherentLikelihood: 1,
  inherentImpact: 1,
  residualLikelihood: 1,
  residualImpact: 1,
  owner: '',
  treatmentPlan: '',
  notes: '',
  status: 'identified' as RiskStatus,
};

export default function RiskRegister() {
  const { t } = useTranslation();
  const { risks, addRisk, updateRisk, deleteRisk } = useRisks();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isEditing = !!editingId;

  const filtered = risks.filter((r) => {
    const crit = CRITERIA.find((c) => c.id === r.criterionId);
    const matchesSearch =
      !search ||
      (crit?.criterion || '').toLowerCase().includes(search.toLowerCase()) ||
      r.owner.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !filterCat || crit?.category === filterCat;
    const matchesStatus = !filterStatus || r.status === filterStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const openAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (r: RiskItem) => {
    setForm({
      criterionId: r.criterionId,
      inherentLikelihood: r.inherentLikelihood,
      inherentImpact: r.inherentImpact,
      residualLikelihood: r.residualLikelihood,
      residualImpact: r.residualImpact,
      owner: r.owner,
      treatmentPlan: r.treatmentPlan,
      notes: r.notes,
      status: r.status,
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.criterionId) return;

    if (isEditing && editingId) {
      updateRisk(editingId, form);
    } else {
      addRisk(form);
    }
    setShowForm(false);
    setForm(initialForm);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteRisk(id);
    setDeleteConfirm(null);
  };

  const statusColors: Record<string, string> = {
    identified: 'bg-gray-100 text-gray-700',
    assessing: 'bg-blue-100 text-blue-700',
    mitigating: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    monitoring: 'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('riskRegister.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('riskRegister.description')}</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm"
        >
          + {t('riskRegister.addRisk')}
        </button>
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
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('riskRegister.category')}</option>
          {getCategories().map((cat) => (
            <option key={cat} value={cat}>{t(`categories.${cat}`, cat)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('riskRegister.status')}</option>
          {Object.keys(t('riskRegister.statuses', { returnObjects: true }) as object).length > 0 &&
            (Object.keys(t('riskRegister.statuses', { returnObjects: true }) as Record<string, string>)).map((s) => (
              <option key={s} value={s}>{t(`riskRegister.statuses.${s}`)}</option>
            ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('riskRegister.noRisks')}</p>
          <p className="text-gray-400 text-sm mt-1">{t('riskRegister.addFirst')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('criteria.id')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.criterion')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.category')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.inherent')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.residual')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.owner')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.status')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const crit = CRITERIA.find((c) => c.id === r.criterionId);
                const inScore = calculateRiskLevel(r.inherentLikelihood, r.inherentImpact);
                const resScore = calculateRiskLevel(r.residualLikelihood, r.residualImpact);
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">{r.criterionId}</td>
                    <td className="py-3 px-4 text-gray-900 max-w-xs truncate">{crit?.criterion || `—`}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {crit ? t(`categories.${crit.category}`, crit.category) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(inScore)}`}>
                        {inScore} · {t(`riskLevels.${getRiskLevelLabel(inScore)}`, getRiskLevelLabel(inScore))}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(resScore)}`}>
                        {resScore} · {t(`riskLevels.${getRiskLevelLabel(resScore)}`, getRiskLevelLabel(resScore))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-[120px] truncate">{r.owner || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status]}`}>
                        {t(`riskRegister.statuses.${r.status}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(r)} className="text-brand-600 hover:text-brand-800 text-xs font-medium">
                          {t('common.edit')}
                        </button>
                        <button onClick={() => setDeleteConfirm(r.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <p className="text-gray-900 font-medium mb-4">{t('riskRegister.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? t('riskRegister.editRisk') : t('riskRegister.addRisk')}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.selectCriterion')}</label>
                <select
                  value={form.criterionId}
                  onChange={(e) => setForm({ ...form, criterionId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">— {t('riskRegister.selectCriterion')} —</option>
                  {CRITERIA.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.id}] {c.criterion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <fieldset className="border border-gray-200 rounded-lg p-4">
                  <legend className="text-sm font-semibold text-gray-700 px-2">{t('riskRegister.inherentAssessment')}</legend>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.likelihood')}</label>
                      <div className="flex gap-1">
                        {LIKERT.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setForm({ ...form, inherentLikelihood: v })}
                            className={`flex-1 py-1.5 text-xs rounded border ${
                              form.inherentLikelihood === v
                                ? 'bg-brand-200 border-brand-400 text-brand-700'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.impact')}</label>
                      <div className="flex gap-1">
                        {LIKERT.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setForm({ ...form, inherentImpact: v })}
                            className={`flex-1 py-1.5 text-xs rounded border ${
                              form.inherentImpact === v
                                ? 'bg-brand-200 border-brand-400 text-brand-700'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('riskRegister.score')}: {calculateRiskLevel(form.inherentLikelihood, form.inherentImpact)} · {t('riskRegister.riskLevel')}:{' '}
                      <span className="font-medium">{t(`riskLevels.${getRiskLevelLabel(calculateRiskLevel(form.inherentLikelihood, form.inherentImpact))}`)}</span>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="border border-gray-200 rounded-lg p-4">
                  <legend className="text-sm font-semibold text-gray-700 px-2">{t('riskRegister.residualAssessment')}</legend>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.likelihood')}</label>
                      <div className="flex gap-1">
                        {LIKERT.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setForm({ ...form, residualLikelihood: v })}
                            className={`flex-1 py-1.5 text-xs rounded border ${
                              form.residualLikelihood === v
                                ? 'bg-brand-200 border-brand-400 text-brand-700'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.impact')}</label>
                      <div className="flex gap-1">
                        {LIKERT.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setForm({ ...form, residualImpact: v })}
                            className={`flex-1 py-1.5 text-xs rounded border ${
                              form.residualImpact === v
                                ? 'bg-brand-200 border-brand-400 text-brand-700'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('riskRegister.score')}: {calculateRiskLevel(form.residualLikelihood, form.residualImpact)} · {t('riskRegister.riskLevel')}:{' '}
                      <span className="font-medium">{t(`riskLevels.${getRiskLevelLabel(calculateRiskLevel(form.residualLikelihood, form.residualImpact))}`)}</span>
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.owner')}</label>
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder={t('riskRegister.owner')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.status')}</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as RiskStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="identified">{t('riskRegister.statuses.identified')}</option>
                    <option value="assessing">{t('riskRegister.statuses.assessing')}</option>
                    <option value="mitigating">{t('riskRegister.statuses.mitigating')}</option>
                    <option value="accepted">{t('riskRegister.statuses.accepted')}</option>
                    <option value="monitoring">{t('riskRegister.statuses.monitoring')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.treatmentPlan')}</label>
                <textarea
                  value={form.treatmentPlan}
                  onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  placeholder={t('riskRegister.treatmentPlan')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  placeholder={t('riskRegister.notes')}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  {isEditing ? t('common.save') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
