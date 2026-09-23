import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../context/ProjectContext';
import { apiFetch } from '../lib/api';
import type { InformationSystem } from '../types';

function csvEscape(value: string | number | undefined) {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ');
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading } = useProjects();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [includeEvidence, setIncludeEvidence] = useState(true);

  const [systems, setSystems] = useState<InformationSystem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsCompany, setSystemsCompany] = useState('');
  const [systemsDeveloper, setSystemsDeveloper] = useState('');
  const [systemsOwner, setSystemsOwner] = useState('');
  const [systemsConsumer, setSystemsConsumer] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/information-systems');
        if (!res.ok) throw new Error('Failed to load systems');
        const data = (await res.json()) as InformationSystem[];
        if (!cancelled) setSystems(data);
      } catch {
        if (!cancelled) setSystems([]);
      } finally {
        if (!cancelled) setSystemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSystems = useMemo(() => {
    const byCompany = systemsCompany ? (item: InformationSystem) => item.company === systemsCompany : () => true;
    const byDeveloper = systemsDeveloper ? (item: InformationSystem) => item.vendor === systemsDeveloper : () => true;
    const byOwner = systemsOwner ? (item: InformationSystem) => item.supportOwner === systemsOwner : () => true;
    const consumerQuery = systemsConsumer.trim().toLowerCase();
    const byConsumer = consumerQuery
      ? (item: InformationSystem) => item.consumers.toLowerCase().includes(consumerQuery)
      : () => true;

    return systems.filter(
      item => byCompany(item) && byDeveloper(item) && byOwner(item) && byConsumer(item),
    );
  }, [systems, systemsCompany, systemsDeveloper, systemsOwner, systemsConsumer]);

  const systemCompanies = useMemo(
    () => [...new Set(systems.map(item => item.company).filter(Boolean))].sort(),
    [systems],
  );
  const systemDevelopers = useMemo(
    () => [...new Set(systems.map(item => item.vendor).filter(Boolean))].sort(),
    [systems],
  );
  const systemOwners = useMemo(
    () => [...new Set(systems.map(item => item.supportOwner).filter(Boolean))].sort(),
    [systems],
  );

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

  const exportSystemsReport = () => {
    const rows = [
      [
        t('reports.systemsReport.columns.systemCode'),
        t('reports.systemsReport.columns.name'),
        t('reports.systemsReport.columns.company'),
        t('reports.systemsReport.columns.vendor'),
        t('reports.systemsReport.columns.supportOwner'),
        t('reports.systemsReport.columns.consumers'),
        t('reports.systemsReport.columns.placement'),
        t('reports.systemsReport.columns.criticality'),
        t('reports.systemsReport.columns.purpose'),
      ],
      ...filteredSystems.map(item => [
        item.systemCode,
        item.name,
        item.company,
        item.vendor,
        item.supportOwner,
        item.consumers,
        item.placement,
        item.criticality,
        item.purpose,
      ]),
    ];

    const csv = rows.map(row => row.map(value => csvEscape(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'systems-registry-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
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

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-gray-900">{t('reports.systemsReport.title')}</h2>
          <button
            type="button"
            onClick={exportSystemsReport}
            disabled={systemsLoading || filteredSystems.length === 0}
            className="px-3 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-40"
          >
            {t('reports.systemsReport.exportCsv')}
          </button>
        </div>

        {systemsLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              <select
                value={systemsCompany}
                onChange={e => setSystemsCompany(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t('reports.systemsReport.allCompanies')}</option>
                {systemCompanies.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={systemsDeveloper}
                onChange={e => setSystemsDeveloper(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t('reports.systemsReport.allDevelopers')}</option>
                {systemDevelopers.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={systemsOwner}
                onChange={e => setSystemsOwner(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t('reports.systemsReport.allOwners')}</option>
                {systemOwners.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input
                type="text"
                value={systemsConsumer}
                onChange={e => setSystemsConsumer(e.target.value)}
                placeholder={t('reports.systemsReport.consumerPlaceholder')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{t('reports.systemsReport.records', { count: filteredSystems.length })}</span>
              <span>{t('reports.systemsReport.criteriaHint')}</span>
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.systemCode')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.name')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.company')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.vendor')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.supportOwner')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.consumers')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.placement')}</th>
                    <th className="px-3 py-2">{t('reports.systemsReport.columns.criticality')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSystems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                        {t('reports.systemsReport.noRecords')}
                      </td>
                    </tr>
                  ) : (
                    filteredSystems.map(item => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-xs">{item.systemCode}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.company}</td>
                        <td className="px-3 py-2">{item.vendor || '—'}</td>
                        <td className="px-3 py-2">{item.supportOwner || '—'}</td>
                        <td className="px-3 py-2">{item.consumers || '—'}</td>
                        <td className="px-3 py-2">{item.placement || '—'}</td>
                        <td className="px-3 py-2">{item.criticality || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
