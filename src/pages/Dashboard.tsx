import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRisks } from '../context/RiskContext';
import { useCompliance } from '../context/ComplianceContext';
import { useProjects } from '../context/ProjectContext';
import { calculateRiskLevel, getRiskLevelLabel, getRiskLevelColor, FRAMEWORKS, COMPANIES } from '../types';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { risks } = useRisks();
  const { tasks, controls, policies, checks } = useCompliance();
  const { projects, companies } = useProjects();
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const remaining = tasks.filter(t => ['remaining', 'due_soon'].includes(t.status)).length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  const dueSoon = tasks.filter(t => t.status === 'due_soon').length;
  const total = tasks.length;

  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const errCount = checks.filter(c => c.status === 'error').length;

  const frameworkData = FRAMEWORKS.map(fw => {
    const fwTasks = tasks.filter(t => t.framework === fw.name);
    const done = fwTasks.filter(t => t.status === 'completed').length;
    return { name: fw.shortName, total: fwTasks.length, completed: done, color: fw.color };
  });

  const implementedControls = controls.filter(c => c.status === 'implemented').length;
  const inProgressControls = controls.filter(c => c.status === 'in_progress').length;
  const pendingControls = controls.filter(c => c.status === 'pending').length;
  const totalControls = controls.length;

  const publishedPolicies = policies.filter(p => p.status === 'published').length;
  const inReviewPolicies = policies.filter(p => p.status === 'in_review').length;
  const draftPolicies = policies.filter(p => p.status === 'draft').length;
  const totalPolicies = policies.length;

  const totalRisks = risks.length;
  const assessed = risks.filter(r => r.inherentLikelihood > 0).length;
  let criticalCount = 0;
  let activeTreatments = 0;
  const catCount: Record<string, number> = {};
  const levelCount: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const r of risks) {
    const score = calculateRiskLevel(r.inherentLikelihood, r.inherentImpact);
    const label = getRiskLevelLabel(score);
    if (label === 'critical') criticalCount++;
    levelCount[label] = (levelCount[label] || 0) + 1;
    if (r.category) catCount[r.category] = (catCount[r.category] || 0) + 1;
  }
  activeTreatments = risks.filter(r => r.mitigationsEnabled && r.mitigations.length > 0).length;

  const recent = [...risks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const maxCat = Math.max(...Object.values(catCount), 1);
  const maxLevel = Math.max(...Object.values(levelCount), 1);

  const levelColors: Record<string, string> = { low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-orange-500', critical: 'bg-red-500' };

  const Widget = ({ label, value, total, color, onClick }: { label: string; value: number; total?: number; color: string; onClick?: () => void }) => (
    <div onClick={onClick} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-gray-900">{value}{total !== undefined ? `/${total}` : ''}</span>
        <div className={`w-2 h-2 rounded-full ${color}`} />
      </div>
    </div>
  );

  const Bar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );

  const filteredProjects = selectedCompany ? projects.filter(p => p.company === selectedCompany) : projects;
  const companyProjects = filteredProjects;
  const companyProjectCount = companyProjects.length;
  const companyInProgress = companyProjects.filter(p => p.status === 'execution').length;
  const companyCompleted = companyProjects.filter(p => p.status === 'closure' || p.status === 'lessons_learned').length;
  const companyAvgProgress = companyProjects.length > 0 ? Math.round(companyProjects.reduce((s, p) => s + p.progress, 0) / companyProjects.length) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
        >
          <option value="">{t('common.all')} — {t('projects.company')}</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {companyProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{companyProjectCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('projects.totalProjects')}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{companyInProgress}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('projects.inExecution')}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-2xl font-bold text-emerald-600">{companyCompleted}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('projects.completed')}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-2xl font-bold text-blue-600">{companyAvgProgress}%</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.complianceProgress')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Widget label={t('dashboard.completed')} value={completed} total={total} color="bg-emerald-500" />
        <Widget label={t('dashboard.inProgress')} value={inProgress} color="bg-blue-500" onClick={() => navigate('/tasks')} />
        <Widget label={t('dashboard.remaining')} value={remaining} color="bg-amber-500" />
        <Widget label={t('dashboard.overdue')} value={overdue} color="bg-red-500" onClick={() => navigate('/tasks')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('dashboard.complianceProgress')}</h3>
          <p className="text-sm text-gray-400 mb-4">{total} {t('dashboard.requirementsCompleted')}</p>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{t('dashboard.completed')}</span>
              <span className="text-gray-800 font-medium">{total > 0 ? Math.round((completed / total) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{completed}</p>
              <p className="text-green-600 text-xs">{t('dashboard.completed')}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
              <p className="text-blue-600 text-xs">{t('dashboard.inProgress')}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{remaining}</p>
              <p className="text-amber-600 text-xs">{t('dashboard.remaining')}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{overdue}</p>
              <p className="text-red-600 text-xs">{t('dashboard.overdue')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.frameworkProgress')}</h3>
          <div className="space-y-3">
            {frameworkData.map(fw => (
              <div key={fw.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{fw.name}</span>
                  <span className="text-gray-500">{fw.total > 0 ? Math.round((fw.completed / fw.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`${fw.color} h-2 rounded-full`} style={{ width: `${fw.total > 0 ? (fw.completed / fw.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.automatedChecks')}</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{passed}</p>
              <p className="text-green-600 text-xs">{t('dashboard.passed')}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{failed}</p>
              <p className="text-red-600 text-xs">{t('dashboard.failed')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{errCount}</p>
              <p className="text-gray-600 text-xs">{t('dashboard.error')}</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <p>{t('dashboard.passed')}: {passed}{' '}
              <span className={failed > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                ({checks.length > 0 ? Math.round((passed / checks.length) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.tasks')}</h3>
          <div className="space-y-3">
            <Bar label={t('dashboard.completed')} value={completed} max={Math.max(total, 1)} color="bg-emerald-500" />
            <Bar label={t('dashboard.inProgress')} value={inProgress} max={Math.max(total, 1)} color="bg-blue-500" />
            <Bar label={t('dashboard.dueSoon')} value={dueSoon} max={Math.max(total, 1)} color="bg-amber-500" />
            <Bar label={t('dashboard.overdue')} value={overdue} max={Math.max(total, 1)} color="bg-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.controls')}</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{implementedControls}</p>
              <p className="text-emerald-600 text-xs">{t('controls.statuses.implemented')}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{inProgressControls}</p>
              <p className="text-blue-600 text-xs">{t('controls.statuses.in_progress')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{pendingControls}</p>
              <p className="text-gray-600 text-xs">{t('controls.statuses.pending')}</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${totalControls > 0 ? (implementedControls / totalControls) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.policies')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{publishedPolicies}</p>
              <p className="text-emerald-600 text-xs">{t('policies.statuses.published')}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{inReviewPolicies}</p>
              <p className="text-amber-600 text-xs">{t('policies.statuses.in_review')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{draftPolicies}</p>
              <p className="text-gray-600 text-xs">{t('policies.statuses.draft')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.riskOverview')}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalRisks}</p>
              <p className="text-blue-600 text-xs">{t('dashboard.totalRisks')}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
              <p className="text-red-600 text-xs">{t('dashboard.criticalRisks')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(levelCount).filter(([, v]) => v > 0).map(([level, count]) => (
              <Bar key={level} label={t(`riskLevels.${level}`)} value={count} max={Math.max(totalRisks, 1)} color={levelColors[level]} />
            ))}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.recentUpdates')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('riskRegister.riskTitle')}</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('riskRegister.inherent')}</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('riskRegister.residual')}</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">{t('riskRegister.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => {
                  const inScore = calculateRiskLevel(r.inherentLikelihood, r.inherentImpact);
                  const resScore = calculateRiskLevel(r.residualLikelihood, r.residualImpact);
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/risks')}>
                      <td className="py-2 px-3 text-gray-900 max-w-xs truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">{r.riskCode}</span>
                        {r.title || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(inScore)}`}>{inScore} {getRiskLevelLabel(inScore)}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(resScore)}`}>{resScore} {getRiskLevelLabel(resScore)}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{t(`riskRegister.statuses.${r.status}`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
