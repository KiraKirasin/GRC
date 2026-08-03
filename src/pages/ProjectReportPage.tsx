import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../context/ProjectContext';
import { apiFetch } from '../lib/api';
import {
  ControlAttachment,
  ControlStatus,
  Project,
  ProjectControl,
  compareControlCodes,
  compareDomainsByStandard,
} from '../types';

const statusColors: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-700',
  not_applicable: 'bg-purple-100 text-purple-700',
};

type ReportSections = {
  summary: boolean;
  controls: boolean;
  evidence: boolean;
  findings: boolean;
  tasks: boolean;
};

const DEFAULT_SECTIONS: ReportSections = {
  summary: true,
  controls: true,
  evidence: true,
  findings: true,
  tasks: false,
};

async function downloadAttachment(
  projectId: string,
  controlId: string,
  att: ControlAttachment,
) {
  const res = await apiFetch(
    `/api/projects/${projectId}/controls/${controlId}/attachments/${att.id}`,
  );
  if (!res.ok) throw new Error('download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.name;
  a.click();
  URL.revokeObjectURL(url);
}

function hasEvidence(c: ProjectControl) {
  return c.evidence.length > 0 || c.evidenceLinks.length > 0 || c.attachments.length > 0;
}

export default function ProjectReportPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading } = useProjects();
  const [apiProject, setApiProject] = useState<Project | null>(null);
  const fromContext = projects.find(p => p.id === id);
  const project = fromContext || apiProject;

  const [controls, setControls] = useState<ProjectControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadError, setDownloadError] = useState('');
  const [packaging, setPackaging] = useState(false);
  const [packageInfo, setPackageInfo] = useState('');
  const [sections, setSections] = useState<ReportSections>(() => ({
    ...DEFAULT_SECTIONS,
    findings: searchParams.get('findings') !== '0',
    tasks: searchParams.get('tasks') === '1',
    evidence: searchParams.get('evidence') !== '0',
    controls: searchParams.get('controls') !== '0',
    summary: searchParams.get('summary') !== '0',
  }));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ctrlRes = await apiFetch(`/api/projects/${id}/controls`);
        const ctrlData = ctrlRes.ok ? await ctrlRes.json() : [];
        if (!cancelled) setControls(ctrlData as ProjectControl[]);

        if (!fromContext) {
          const projRes = await apiFetch(`/api/projects/${id}`);
          if (projRes.ok && !cancelled) {
            setApiProject((await projRes.json()) as Project);
          }
        }
      } catch {
        if (!cancelled) setControls([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fromContext]);

  const attachmentCount = useMemo(
    () => controls.reduce((n, c) => n + c.attachments.length, 0),
    [controls],
  );

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    let withEvidence = 0;
    for (const c of controls) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      if (hasEvidence(c)) withEvidence += 1;
    }
    return { byStatus, withEvidence, total: controls.length };
  }, [controls]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectControl[]>();
    for (const c of controls) {
      const key = c.category || t('reports.uncategorized');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) {
      list.sort((a, b) => compareControlCodes(a.controlCode, b.controlCode));
    }
    return [...map.entries()].sort(([a], [b]) => compareDomainsByStandard(a, b));
  }, [controls, t]);

  const generatedAt = useMemo(
    () => new Date().toLocaleString(i18n.language === 'uk' ? 'uk-UA' : 'en-GB'),
    [i18n.language],
  );

  const downloadEvidencePackage = async () => {
    if (!id || !project) return;
    setDownloadError('');
    setPackageInfo('');
    setPackaging(true);
    try {
      const res = await apiFetch(`/api/projects/${id}/evidence-package`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'package failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/i.exec(disposition);
      const filename = match?.[1] || `evidence-package_${project.id}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setPackageInfo(t('reports.packageReady', { count: attachmentCount }));
    } catch {
      setDownloadError(t('reports.packageFailed'));
    } finally {
      setPackaging(false);
    }
  };

  const onDownload = async (controlId: string, att: ControlAttachment) => {
    if (!id) return;
    setDownloadError('');
    try {
      await downloadAttachment(id, controlId, att);
    } catch {
      setDownloadError(t('reports.downloadFailed'));
    }
  };

  if (projectsLoading && !project) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-gray-600">{t('reports.projectNotFound')}</p>
        <Link to="/reports" className="text-brand-600 underline text-sm mt-2 inline-block">
          {t('reports.backToReports')}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 hover:text-gray-800 mb-1"
          >
            ← {t('common.back')}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.projectReport')}</h1>
          <p className="text-sm text-gray-500">{project.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/projects/${project.id}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('reports.openProject')}
          </Link>
          <button
            type="button"
            onClick={() => void downloadEvidencePackage()}
            disabled={packaging}
            className="px-4 py-2 text-sm border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-50 font-medium disabled:opacity-50"
          >
            {packaging ? t('reports.packaging') : t('reports.downloadPackage')}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium"
          >
            {t('reports.printPdf')}
          </button>
        </div>
      </div>

      <div className="print:hidden bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-gray-800 mb-2">{t('reports.sections')}</p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(DEFAULT_SECTIONS) as (keyof ReportSections)[]).map(key => (
            <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={e => setSections(s => ({ ...s, [key]: e.target.checked }))}
                className="rounded border-gray-300"
              />
              {t(`reports.section.${key}`)}
            </label>
          ))}
        </div>
        {downloadError && <p className="text-sm text-red-600 mt-2">{downloadError}</p>}
        {packageInfo && <p className="text-sm text-emerald-700 mt-2">{packageInfo}</p>}
        <p className="text-xs text-gray-500 mt-3">{t('reports.packageHint', { count: attachmentCount })}</p>
      </div>

      <article
        id="project-report"
        className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8 print:border-0 print:shadow-none print:rounded-none"
      >
        <header className="border-b border-gray-200 pb-4 mb-6">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">NovaPay GRC</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">{project.title}</h2>
          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm">
            <div>
              <dt className="text-gray-400">{t('projects.company')}</dt>
              <dd className="font-medium text-gray-900">{project.company}</dd>
            </div>
            <div>
              <dt className="text-gray-400">{t('common.framework')}</dt>
              <dd className="font-medium text-gray-900">{project.framework}</dd>
            </div>
            <div>
              <dt className="text-gray-400">{t('common.status')}</dt>
              <dd className="font-medium text-gray-900">{t(`projects.statuses.${project.status}`)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">{t('common.owner')}</dt>
              <dd className="font-medium text-gray-900">{project.owner}</dd>
            </div>
            <div>
              <dt className="text-gray-400">{t('reports.period')}</dt>
              <dd className="font-medium text-gray-900">
                {project.startDate || '—'} → {project.targetDate || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">{t('reports.generatedAt')}</dt>
              <dd className="font-medium text-gray-900">{generatedAt}</dd>
            </div>
          </dl>
        </header>

        {loading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}

        {!loading && sections.summary && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('reports.section.summary')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{t('reports.controlsTotal')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-xs text-emerald-700">{t('controls.statuses.implemented')}</p>
                <p className="text-2xl font-bold text-emerald-800">{stats.byStatus.implemented || 0}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs text-blue-700">{t('controls.statuses.in_progress')}</p>
                <p className="text-2xl font-bold text-blue-800">{stats.byStatus.in_progress || 0}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-700">{t('reports.withEvidence')}</p>
                <p className="text-2xl font-bold text-amber-800">
                  {stats.withEvidence}/{stats.total}
                </p>
              </div>
            </div>
          </section>
        )}

        {!loading && sections.controls && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('reports.section.controls')}</h3>
            {grouped.length === 0 ? (
              <p className="text-sm text-gray-500">{t('reports.noControls')}</p>
            ) : (
              <div className="space-y-6">
                {grouped.map(([domain, list]) => (
                  <div key={domain}>
                    <h4 className="text-sm font-semibold text-brand-700 mb-2 border-b border-brand-100 pb-1">
                      {domain}
                    </h4>
                    <div className="space-y-3">
                      {list.map(c => (
                        <div key={c.id} className="border border-gray-200 rounded-lg p-3 break-inside-avoid">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {c.controlCode ? `${c.controlCode} — ` : ''}
                                {c.title}
                              </p>
                              {c.owner && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {t('common.owner')}: {c.owner}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                statusColors[c.status] || statusColors.pending
                              }`}
                            >
                              {t(`controls.statuses.${c.status as ControlStatus}`)}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{c.description}</p>
                          )}
                          {sections.evidence && (
                            <div className="mt-3 pt-2 border-t border-gray-100 space-y-1.5">
                              <p className="text-xs font-medium text-gray-700">{t('reports.evidence')}</p>
                              {!hasEvidence(c) && (
                                <p className="text-xs text-gray-400">{t('reports.noEvidence')}</p>
                              )}
                              {c.evidence.length > 0 && (
                                <ul className="text-xs text-gray-600 list-disc pl-4">
                                  {c.evidence.map((e, i) => (
                                    <li key={`${c.id}-ev-${i}`}>{e}</li>
                                  ))}
                                </ul>
                              )}
                              {c.evidenceLinks.length > 0 && (
                                <ul className="text-xs list-disc pl-4">
                                  {c.evidenceLinks.map((link, i) => (
                                    <li key={`${c.id}-link-${i}`}>
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand-600 underline break-all"
                                      >
                                        {link}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {c.attachments.length > 0 && (
                                <ul className="text-xs text-gray-700 space-y-1">
                                  {c.attachments.map(att => (
                                    <li key={att.id} className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{att.name}</span>
                                      <span className="text-gray-400">
                                        ({Math.round(att.size / 1024)} KB)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => onDownload(c.id, att)}
                                        className="print:hidden text-brand-600 underline"
                                      >
                                        {t('reports.download')}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && sections.findings && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('reports.section.findings')}</h3>
            {project.findings.length === 0 ? (
              <p className="text-sm text-gray-500">{t('reports.noFindings')}</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2 pr-2">{t('common.title')}</th>
                    <th className="py-2 pr-2">{t('common.severity')}</th>
                    <th className="py-2 pr-2">{t('common.status')}</th>
                    <th className="py-2">{t('common.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {project.findings.map(f => (
                    <tr key={f.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-2 font-medium">{f.title}</td>
                      <td className="py-2 pr-2">{f.severity}</td>
                      <td className="py-2 pr-2">{f.status}</td>
                      <td className="py-2 text-gray-600">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {!loading && sections.tasks && (
          <section className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('reports.section.tasks')}</h3>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-gray-500">{t('reports.noTasks')}</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2 pr-2">{t('common.title')}</th>
                    <th className="py-2 pr-2">{t('common.status')}</th>
                    <th className="py-2 pr-2">{t('projects.assignee')}</th>
                    <th className="py-2">{t('reports.dueDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map(task => (
                    <tr key={task.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{task.title}</td>
                      <td className="py-2 pr-2">{task.status}</td>
                      <td className="py-2 pr-2">{task.assignee || '—'}</td>
                      <td className="py-2">{task.dueDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <footer className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400">
          {t('reports.footerNote')}
        </footer>
      </article>

      <style>{`
        @media print {
          body { background: white !important; }
          aside, header.sticky, .print\\:hidden { display: none !important; }
          #project-report { box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
}
