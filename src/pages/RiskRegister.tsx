import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRisks } from '../context/RiskContext';
import { useCompliance } from '../context/ComplianceContext';
import {
  COMPANIES,
  CONTROL_FRAMEWORKS,
  EMPTY_RISK_ACCEPTANCE,
  FRAMEWORKS,
  RISK_CATEGORIES,
  RISK_DOMAINS,
  RiskExistingControl,
  RiskFrameworkMapping,
  RiskItem,
  RiskMitigationAction,
  RiskStatus,
  TaskStatus,
  calculateRiskLevel,
  genRiskEntityId,
  getRiskLevelColor,
  getRiskLevelLabel,
  nextRiskCode,
  normalizeRiskItem,
} from '../types';

const LIKERT = [1, 2, 3, 4, 5];

const ALL_FRAMEWORKS = [
  ...CONTROL_FRAMEWORKS,
  ...FRAMEWORKS.filter((f) => !CONTROL_FRAMEWORKS.some((c) => c.name === f.name)),
];

const statusColors: Record<string, string> = {
  identified: 'bg-gray-100 text-gray-700',
  assessing: 'bg-blue-100 text-blue-700',
  mitigating: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  monitoring: 'bg-purple-100 text-purple-700',
};

type RiskFormState = Omit<RiskItem, 'id' | 'createdAt' | 'updatedAt'>;

function emptyForm(riskCode = ''): RiskFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    riskCode,
    title: '',
    assets: '',
    category: '',
    domain: '',
    businessUnit: '',
    riskOwner: '',
    technicalOwner: '',
    status: 'identified',
    createdDate: today,
    lastAssessment: today,
    inherentLikelihood: 1,
    inherentImpact: 1,
    residualLikelihood: 1,
    residualImpact: 1,
    existingControls: [],
    mitigationsEnabled: false,
    mitigations: [],
    frameworkMappings: [],
    acceptance: { ...EMPTY_RISK_ACCEPTANCE },
    notes: '',
  };
}

function ScoreTable({
  likelihood,
  impact,
  t,
}: {
  likelihood: number;
  impact: number;
  t: (k: string, d?: string) => string;
}) {
  const score = calculateRiskLevel(likelihood, impact);
  const rating = getRiskLevelLabel(score);
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-500">{t('riskRegister.metric')}</th>
            <th className="text-left py-2 px-3 font-medium text-gray-500">{t('riskRegister.value')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-2 px-3 text-gray-600">{t('riskRegister.likelihood')}</td>
            <td className="py-2 px-3 font-medium">{likelihood}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 px-3 text-gray-600">{t('riskRegister.impact')}</td>
            <td className="py-2 px-3 font-medium">{impact}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2 px-3 text-gray-600">{t('riskRegister.score')}</td>
            <td className="py-2 px-3 font-medium">{score}</td>
          </tr>
          <tr>
            <td className="py-2 px-3 text-gray-600">{t('riskRegister.rating')}</td>
            <td className="py-2 px-3">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(score)}`}>
                {t(`riskLevels.${rating}`)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LikertRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex gap-1">
        {LIKERT.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-1.5 text-xs rounded border ${
              value === v
                ? 'bg-brand-200 border-brand-400 text-brand-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RiskRegister() {
  const { t } = useTranslation();
  const { risks, addRisk, updateRisk, deleteRisk } = useRisks();
  const { controls, addTask, updateTask } = useCompliance();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RiskFormState>(() => emptyForm());
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [controlQuery, setControlQuery] = useState('');
  const [mitigationQuery, setMitigationQuery] = useState('');

  const isEditing = !!editingId;

  const filtered = risks.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(q) ||
      r.riskCode.toLowerCase().includes(q) ||
      r.riskOwner.toLowerCase().includes(q) ||
      r.domain.toLowerCase().includes(q) ||
      r.assets.toLowerCase().includes(q);
    const matchesCat = !filterCat || r.category === filterCat;
    const matchesStatus = !filterStatus || r.status === filterStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const controlSuggestions = useMemo(() => {
    const q = controlQuery.trim().toLowerCase();
    if (!q) return controls.slice(0, 8);
    return controls
      .filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.controlCode || '').toLowerCase().includes(q) ||
          c.framework.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [controls, controlQuery]);

  const mitigationSuggestions = useMemo(() => {
    const q = mitigationQuery.trim().toLowerCase();
    if (!q) return controls.slice(0, 8);
    return controls
      .filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.controlCode || '').toLowerCase().includes(q) ||
          c.framework.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [controls, mitigationQuery]);

  const openAdd = () => {
    setForm(emptyForm(nextRiskCode(risks)));
    setEditingId(null);
    setControlQuery('');
    setMitigationQuery('');
    setShowForm(true);
  };

  const openEdit = (r: RiskItem) => {
    const n = normalizeRiskItem(r);
    setForm({
      riskCode: n.riskCode,
      title: n.title,
      assets: n.assets,
      category: n.category,
      domain: n.domain,
      businessUnit: n.businessUnit,
      riskOwner: n.riskOwner,
      technicalOwner: n.technicalOwner,
      status: n.status,
      createdDate: n.createdDate,
      lastAssessment: n.lastAssessment,
      inherentLikelihood: n.inherentLikelihood,
      inherentImpact: n.inherentImpact,
      residualLikelihood: n.residualLikelihood,
      residualImpact: n.residualImpact,
      existingControls: n.existingControls,
      mitigationsEnabled: n.mitigationsEnabled,
      mitigations: n.mitigations,
      frameworkMappings: n.frameworkMappings,
      acceptance: { ...n.acceptance },
      notes: n.notes,
      criterionId: n.criterionId,
    });
    setEditingId(r.id);
    setControlQuery('');
    setMitigationQuery('');
    setShowForm(true);
  };

  const syncMitigationTasks = (
    riskId: string,
    riskCode: string,
    mitigations: RiskMitigationAction[],
    enabled: boolean,
    mappings: RiskFrameworkMapping[],
  ): RiskMitigationAction[] => {
    if (!enabled) return mitigations;
    const defaultFw = mappings[0]?.framework || '';
    return mitigations.map((m) => {
      if (!m.title.trim()) return m;
      const payload = {
        title: m.title.trim(),
        description: m.description || `Risk mitigation for ${riskCode}`,
        category: 'Risk Mitigation',
        assignee: m.owner,
        dueDate: m.dueDate,
        priority: 'high' as const,
        status: m.status,
        framework: m.framework || defaultFw,
        sourceRiskId: riskId,
        sourceRiskCode: riskCode,
      };
      if (m.taskId) {
        updateTask(m.taskId, payload);
        return m;
      }
      const created = addTask(payload);
      return { ...m, taskId: created.id };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isEditing && editingId) {
      const withTasks = syncMitigationTasks(
        editingId,
        form.riskCode,
        form.mitigations,
        form.mitigationsEnabled,
        form.frameworkMappings,
      );
      updateRisk(editingId, { ...form, mitigations: withTasks, owner: form.riskOwner });
    } else {
      const created = addRisk({ ...form, owner: form.riskOwner });
      const withTasks = syncMitigationTasks(
        created.id,
        created.riskCode,
        form.mitigations,
        form.mitigationsEnabled,
        form.frameworkMappings,
      );
      if (withTasks.some((m, i) => m.taskId !== form.mitigations[i]?.taskId)) {
        updateRisk(created.id, { mitigations: withTasks });
      }
    }
    setShowForm(false);
    setForm(emptyForm());
    setEditingId(null);
  };

  const addExistingFromRepo = (controlId: string) => {
    const c = controls.find((x) => x.id === controlId);
    if (!c) return;
    const row: RiskExistingControl = {
      id: genRiskEntityId(),
      source: 'repository',
      controlId: c.id,
      controlCode: c.controlCode,
      title: c.title,
      framework: c.framework,
    };
    setForm((f) => ({ ...f, existingControls: [...f.existingControls, row] }));
    setControlQuery('');
  };

  const addExistingManual = () => {
    setForm((f) => ({
      ...f,
      existingControls: [
        ...f.existingControls,
        { id: genRiskEntityId(), source: 'manual', title: '', controlCode: '', framework: '', notes: '' },
      ],
    }));
  };

  const addMitigationFromRepo = (controlId: string) => {
    const c = controls.find((x) => x.id === controlId);
    if (!c) return;
    const row: RiskMitigationAction = {
      id: genRiskEntityId(),
      source: 'repository',
      controlId: c.id,
      controlCode: c.controlCode,
      title: `Mitigate: ${c.controlCode || ''} ${c.title}`.trim(),
      description: c.description || '',
      owner: form.riskOwner || form.technicalOwner || '',
      dueDate: '',
      status: 'remaining',
      framework: c.framework,
    };
    setForm((f) => ({ ...f, mitigationsEnabled: true, mitigations: [...f.mitigations, row] }));
    setMitigationQuery('');
  };

  const addMitigationManual = () => {
    setForm((f) => ({
      ...f,
      mitigationsEnabled: true,
      mitigations: [
        ...f.mitigations,
        {
          id: genRiskEntityId(),
          source: 'manual',
          title: '',
          description: '',
          owner: f.riskOwner || f.technicalOwner || '',
          dueDate: '',
          status: 'remaining' as TaskStatus,
        },
      ],
    }));
  };

  const addMapping = () => {
    setForm((f) => ({
      ...f,
      frameworkMappings: [
        ...f.frameworkMappings,
        { id: genRiskEntityId(), framework: '', requirement: '' },
      ],
    }));
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
          {RISK_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('riskRegister.status')}</option>
          {(Object.keys(t('riskRegister.statuses', { returnObjects: true }) as object)).map((s) => (
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
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.riskId')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.riskTitle')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.category')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.domain')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.inherent')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.residual')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.riskOwner')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.status')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('riskRegister.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const inScore = calculateRiskLevel(r.inherentLikelihood, r.inherentImpact);
                const resScore = calculateRiskLevel(r.residualLikelihood, r.residualImpact);
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{r.riskCode || '—'}</td>
                    <td className="py-3 px-4 text-gray-900 max-w-xs truncate font-medium">{r.title || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{r.category || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{r.domain || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(inScore)}`}>
                        {inScore} · {t(`riskLevels.${getRiskLevelLabel(inScore)}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(resScore)}`}>
                        {resScore} · {t(`riskLevels.${getRiskLevelLabel(resScore)}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-[120px] truncate">{r.riskOwner || '—'}</td>
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
              <button
                onClick={() => { deleteRisk(deleteConfirm); setDeleteConfirm(null); }}
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
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-4xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? t('riskRegister.editRisk') : t('riskRegister.addRisk')}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Identity */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1">{t('riskRegister.sectionIdentity')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.riskId')}</label>
                    <input type="text" value={form.riskCode} onChange={(e) => setForm({ ...form, riskCode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.riskTitle')}</label>
                    <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required placeholder={t('riskRegister.titlePlaceholder')} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.assets')}</label>
                    <input type="text" value={form.assets} onChange={(e) => setForm({ ...form, assets: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('riskRegister.assetsPlaceholder')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.category')}</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">—</option>
                      {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.domain')}</label>
                    <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">—</option>
                      {RISK_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.businessUnit')}</label>
                    <select value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">—</option>
                      {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="IT">IT</option>
                      <option value="Security">Security</option>
                      <option value="Risk">Risk</option>
                      <option value="All">All</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.status')}</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RiskStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {(Object.keys(t('riskRegister.statuses', { returnObjects: true }) as object)).map((s) => (
                        <option key={s} value={s}>{t(`riskRegister.statuses.${s}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.riskOwner')}</label>
                    <input type="text" value={form.riskOwner} onChange={(e) => setForm({ ...form, riskOwner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.technicalOwner')}</label>
                    <input type="text" value={form.technicalOwner} onChange={(e) => setForm({ ...form, technicalOwner: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.created')}</label>
                    <input type="date" value={form.createdDate} onChange={(e) => setForm({ ...form, createdDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.lastAssessment')}</label>
                    <input type="date" value={form.lastAssessment} onChange={(e) => setForm({ ...form, lastAssessment: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              </section>

              {/* 2. Inherent */}
              <section>
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1 mb-3">{t('riskRegister.inherentAssessment')}</h4>
                <p className="text-xs text-gray-500 mb-3">{t('riskRegister.scoreFormula')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <LikertRow label={`${t('riskRegister.likelihood')} (1–5)`} value={form.inherentLikelihood} onChange={(v) => setForm({ ...form, inherentLikelihood: v })} />
                    <LikertRow label={`${t('riskRegister.impact')} (1–5)`} value={form.inherentImpact} onChange={(v) => setForm({ ...form, inherentImpact: v })} />
                  </div>
                  <ScoreTable likelihood={form.inherentLikelihood} impact={form.inherentImpact} t={(k) => t(k)} />
                </div>
              </section>

              {/* 3. Existing controls */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1">{t('riskRegister.existingControls')}</h4>
                <p className="text-xs text-gray-500">{t('riskRegister.existingControlsHint')}</p>
                <div className="relative">
                  <input
                    type="text"
                    value={controlQuery}
                    onChange={(e) => setControlQuery(e.target.value)}
                    placeholder={t('riskRegister.searchControls')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {controlQuery.trim() && controlSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {controlSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => addExistingFromRepo(c.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="font-mono text-brand-700">{c.controlCode || '—'}</span>
                          <span className="text-gray-700 ml-2">{c.title}</span>
                          <span className="text-gray-400 ml-2">{c.framework}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={addExistingManual} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                  + {t('riskRegister.addManualControl')}
                </button>
                {form.existingControls.length > 0 && (
                  <div className="space-y-2">
                    {form.existingControls.map((ec, idx) => (
                      <div key={ec.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-gray-50 rounded-lg p-2">
                        <input
                          className="md:col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                          placeholder={t('riskRegister.controlCode')}
                          value={ec.controlCode || ''}
                          onChange={(e) => setForm({
                            ...form,
                            existingControls: form.existingControls.map((x, i) => i === idx ? { ...x, controlCode: e.target.value } : x),
                          })}
                        />
                        <input
                          className="md:col-span-4 px-2 py-1.5 border border-gray-300 rounded text-xs"
                          placeholder={t('riskRegister.controlTitle')}
                          value={ec.title}
                          onChange={(e) => setForm({
                            ...form,
                            existingControls: form.existingControls.map((x, i) => i === idx ? { ...x, title: e.target.value } : x),
                          })}
                        />
                        <select
                          className="md:col-span-3 px-2 py-1.5 border border-gray-300 rounded text-xs"
                          value={ec.framework || ''}
                          onChange={(e) => setForm({
                            ...form,
                            existingControls: form.existingControls.map((x, i) => i === idx ? { ...x, framework: e.target.value } : x),
                          })}
                        >
                          <option value="">—</option>
                          {ALL_FRAMEWORKS.map((f) => <option key={f.name} value={f.name}>{f.shortName}</option>)}
                        </select>
                        <input
                          className="md:col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs"
                          placeholder={t('riskRegister.notes')}
                          value={ec.notes || ''}
                          onChange={(e) => setForm({
                            ...form,
                            existingControls: form.existingControls.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x),
                          })}
                        />
                        <button
                          type="button"
                          className="md:col-span-1 text-red-600 text-xs"
                          onClick={() => setForm({ ...form, existingControls: form.existingControls.filter((_, i) => i !== idx) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 4. Mitigations */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1">{t('riskRegister.mitigationSection')}</h4>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <span>{t('riskRegister.mitigationAction')}?</span>
                  <select
                    value={form.mitigationsEnabled ? 'yes' : 'no'}
                    onChange={(e) => setForm({ ...form, mitigationsEnabled: e.target.value === 'yes' })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="no">{t('common.no')}</option>
                    <option value="yes">{t('common.yes')}</option>
                  </select>
                </label>
                {form.mitigationsEnabled && (
                  <>
                    <p className="text-xs text-gray-500">{t('riskRegister.mitigationHint')}</p>
                    <div className="relative">
                      <input
                        type="text"
                        value={mitigationQuery}
                        onChange={(e) => setMitigationQuery(e.target.value)}
                        placeholder={t('riskRegister.searchControls')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      {mitigationQuery.trim() && mitigationSuggestions.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {mitigationSuggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => addMitigationFromRepo(c.id)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 border-b border-gray-50 last:border-0"
                            >
                              <span className="font-mono text-brand-700">{c.controlCode || '—'}</span>
                              <span className="text-gray-700 ml-2">{c.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={addMitigationManual} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                      + {t('riskRegister.addManualMitigation')}
                    </button>
                    <div className="space-y-3">
                      {form.mitigations.map((m, idx) => (
                        <div key={m.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-amber-50/40">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-600">
                              {m.source === 'repository' ? t('riskRegister.fromRepository') : t('riskRegister.manual')}
                              {m.controlCode ? ` · ${m.controlCode}` : ''}
                            </span>
                            <button
                              type="button"
                              className="text-red-600 text-xs"
                              onClick={() => setForm({ ...form, mitigations: form.mitigations.filter((_, i) => i !== idx) })}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                          <input
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            placeholder={t('riskRegister.mitigationTitle')}
                            value={m.title}
                            onChange={(e) => setForm({
                              ...form,
                              mitigations: form.mitigations.map((x, i) => i === idx ? { ...x, title: e.target.value } : x),
                            })}
                          />
                          <textarea
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            rows={2}
                            placeholder={t('common.description')}
                            value={m.description}
                            onChange={(e) => setForm({
                              ...form,
                              mitigations: form.mitigations.map((x, i) => i === idx ? { ...x, description: e.target.value } : x),
                            })}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.timeline')}</label>
                              <input
                                type="date"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                value={m.dueDate}
                                onChange={(e) => setForm({
                                  ...form,
                                  mitigations: form.mitigations.map((x, i) => i === idx ? { ...x, dueDate: e.target.value } : x),
                                })}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.status')}</label>
                              <select
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                value={m.status}
                                onChange={(e) => setForm({
                                  ...form,
                                  mitigations: form.mitigations.map((x, i) => i === idx ? { ...x, status: e.target.value as TaskStatus } : x),
                                })}
                              >
                                {(Object.keys(t('tasks.statuses', { returnObjects: true }) as object)).map((s) => (
                                  <option key={s} value={s}>{t(`tasks.statuses.${s}`)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">{t('riskRegister.owner')}</label>
                              <input
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                value={m.owner}
                                onChange={(e) => setForm({
                                  ...form,
                                  mitigations: form.mitigations.map((x, i) => i === idx ? { ...x, owner: e.target.value } : x),
                                })}
                              />
                            </div>
                          </div>
                          {m.taskId && (
                            <p className="text-xs text-emerald-700">{t('riskRegister.linkedTask')}: {m.taskId.slice(0, 8)}…</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* 5. Framework mapping */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1">{t('riskRegister.frameworkMapping')}</h4>
                <p className="text-xs text-gray-500">{t('riskRegister.frameworkMappingHint')}</p>
                <button type="button" onClick={addMapping} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                  + {t('riskRegister.addMapping')}
                </button>
                {form.frameworkMappings.length > 0 && (
                  <div className="space-y-2">
                    <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                      <span className="col-span-5">{t('riskRegister.framework')}</span>
                      <span className="col-span-6">{t('riskRegister.requirement')}</span>
                    </div>
                    {form.frameworkMappings.map((m, idx) => (
                      <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <select
                          className="md:col-span-5 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          value={m.framework}
                          onChange={(e) => setForm({
                            ...form,
                            frameworkMappings: form.frameworkMappings.map((x, i) => i === idx ? { ...x, framework: e.target.value } : x),
                          })}
                        >
                          <option value="">—</option>
                          {ALL_FRAMEWORKS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                          <option value="NIS2">NIS2</option>
                          <option value="CRA">CRA</option>
                          <option value="CIS Controls">CIS Controls</option>
                          <option value="NIST CSF">NIST CSF</option>
                        </select>
                        <input
                          className="md:col-span-6 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="e.g. A.8.16"
                          value={m.requirement}
                          onChange={(e) => setForm({
                            ...form,
                            frameworkMappings: form.frameworkMappings.map((x, i) => i === idx ? { ...x, requirement: e.target.value } : x),
                          })}
                        />
                        <button
                          type="button"
                          className="md:col-span-1 text-red-600 text-sm"
                          onClick={() => setForm({ ...form, frameworkMappings: form.frameworkMappings.filter((_, i) => i !== idx) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 6. Residual */}
              <section>
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1 mb-3">{t('riskRegister.residualAssessment')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <LikertRow label={`${t('riskRegister.likelihood')} (1–5)`} value={form.residualLikelihood} onChange={(v) => setForm({ ...form, residualLikelihood: v })} />
                    <LikertRow label={`${t('riskRegister.impact')} (1–5)`} value={form.residualImpact} onChange={(v) => setForm({ ...form, residualImpact: v })} />
                  </div>
                  <ScoreTable likelihood={form.residualLikelihood} impact={form.residualImpact} t={(k) => t(k)} />
                </div>
              </section>

              {/* 7. Acceptance */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-1">{t('riskRegister.riskAcceptance')}</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-500 w-40">{t('riskRegister.accepted')}</td>
                        <td className="py-2 px-3">
                          <select
                            value={form.acceptance.accepted ? 'yes' : 'no'}
                            onChange={(e) => setForm({
                              ...form,
                              acceptance: { ...form.acceptance, accepted: e.target.value === 'yes' },
                              status: e.target.value === 'yes' ? 'accepted' : form.status,
                            })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="no">{t('common.no')}</option>
                            <option value="yes">{t('common.yes')}</option>
                          </select>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-500">{t('riskRegister.acceptedBy')}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={form.acceptance.acceptedBy}
                            onChange={(e) => setForm({ ...form, acceptance: { ...form.acceptance, acceptedBy: e.target.value } })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="CISO"
                          />
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-500">{t('riskRegister.expiration')}</td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={form.acceptance.expiration}
                            onChange={(e) => setForm({ ...form, acceptance: { ...form.acceptance, expiration: e.target.value } })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-gray-500">{t('riskRegister.exception')}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={form.acceptance.exception}
                            onChange={(e) => setForm({ ...form, acceptance: { ...form.acceptance, exception: e.target.value } })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="EXC-0012"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('riskRegister.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
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
