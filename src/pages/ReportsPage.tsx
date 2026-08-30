import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../context/ProjectContext';

export default function ReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading } = useProjects();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [includeEvidence, setIncludeEvidence] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.framework.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const openReport = (projectId: string) => {
    const params = new URLSearchParams();
    if (!includeFindings) params.set('findings', '0');
    if (includeTasks) params.set('tasks', '1');
    if (!includeEvidence) params.set('evidence', '0');
    const qs = params.toString();
    navigate(`/projects/${projectId}/report${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('reports.description')}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">{t('reports.buildReport')}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reports.selectProject')}
            </label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t('reports.chooseProject')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.company}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={e => setIncludeEvidence(e.target.checked)}
              />
              {t('reports.section.evidence')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeFindings}
                onChange={e => setIncludeFindings(e.target.checked)}
              />
              {t('reports.section.findings')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeTasks}
                onChange={e => setIncludeTasks(e.target.checked)}
              />
              {t('reports.section.tasks')}
            </label>
          </div>
        </div>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => openReport(selectedId)}
          className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 font-medium"
        >
          {t('reports.generate')}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-gray-900">{t('reports.projectsList')}</h2>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('reports.searchProjects')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full max-w-xs"
          />
        </div>
        {projectsLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">{t('reports.noProjects')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(p => (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.company} · {p.framework} · {t(`projects.statuses.${p.status}`)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/projects/${p.id}`}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {t('reports.openProject')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => openReport(p.id)}
                    className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                  >
                    {t('reports.generate')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
