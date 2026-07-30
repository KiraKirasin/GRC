import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCompliance } from '../context/ComplianceContext';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { COMPANIES, CompanyName } from '../types';

const CROSS_COMPANY = '__cross_company__' as const;

type RoadmapStatus =
  | 'completed'
  | 'in_progress'
  | 'open'
  | 'blocked'
  | 'remaining'
  | 'due_soon'
  | 'overdue';

interface RoadmapTaskItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  assignee: string;
  dueDate: string;
  framework: string;
  company: CompanyName | typeof CROSS_COMPANY;
  projectTitle?: string;
  projectId?: string;
  controlRef?: string;
  source: 'project' | 'grc';
}

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  open: 'bg-gray-100 text-gray-700',
  remaining: 'bg-gray-100 text-gray-700',
  due_soon: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  blocked: 'bg-red-100 text-red-700',
};

function isCompleted(status: RoadmapStatus) {
  return status === 'completed';
}

function isActive(status: RoadmapStatus) {
  return status === 'in_progress' || status === 'open' || status === 'remaining' || status === 'due_soon';
}

function isOverdue(status: RoadmapStatus) {
  return status === 'overdue' || status === 'blocked';
}

function monthKey(dateStr: string) {
  if (!dateStr) return 'no-date';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'no-date';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string, locale: string) {
  if (key === 'no-date') return '';
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export default function RoadmapPage() {
  const { t, i18n } = useTranslation();
  const { tasks } = useCompliance();
  const { projects } = useProjects();
  const { canAccessCompany } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState('');

  const projectById = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p])),
    [projects],
  );

  const accessibleCompanies = useMemo(
    () => COMPANIES.filter(c => canAccessCompany(c)),
    [canAccessCompany],
  );

  const roadmapTasks = useMemo(() => {
    const items: RoadmapTaskItem[] = [];
    const seen = new Set<string>();

    const push = (item: RoadmapTaskItem) => {
      const key = `${item.source}:${item.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    for (const project of projects) {
      if (!canAccessCompany(project.company)) continue;
      for (const task of project.tasks) {
        push({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status === 'open' ? 'open' : task.status,
          assignee: task.assignee,
          dueDate: task.dueDate,
          framework: project.framework,
          company: project.company,
          projectTitle: project.title,
          projectId: project.id,
          controlRef: task.controlRef,
          source: 'project',
        });
      }
    }

    for (const task of tasks) {
      const project = task.sourceProjectId ? projectById[task.sourceProjectId] : undefined;
      const company = project?.company;
      if (company && !canAccessCompany(company)) continue;

      push({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        dueDate: task.dueDate,
        framework: task.framework || project?.framework || '',
        company: company || CROSS_COMPANY,
        projectTitle: project?.title,
        projectId: project?.id,
        controlRef: task.sourceControlCode,
        source: 'grc',
      });
    }

    return items.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [projects, tasks, projectById, canAccessCompany]);

  const filteredTasks = useMemo(() => {
    return roadmapTasks.filter(task => {
      const companyMatch =
        selectedCompany === 'all' ||
        (selectedCompany === CROSS_COMPANY && task.company === CROSS_COMPANY) ||
        task.company === selectedCompany;
      const statusMatch = !filterStatus || task.status === filterStatus;
      return companyMatch && statusMatch;
    });
  }, [roadmapTasks, selectedCompany, filterStatus]);

  const companySections = useMemo(() => {
    const order: Array<CompanyName | typeof CROSS_COMPANY> = [
      ...accessibleCompanies,
      ...(roadmapTasks.some(t => t.company === CROSS_COMPANY) ? [CROSS_COMPANY] : []),
    ];

    return order
      .map(company => {
        const companyTasks = filteredTasks.filter(t => t.company === company);
        if (companyTasks.length === 0) return null;

        const completed = companyTasks.filter(t => isCompleted(t.status)).length;
        const active = companyTasks.filter(t => isActive(t.status)).length;
        const overdue = companyTasks.filter(t => isOverdue(t.status)).length;
        const progress = companyTasks.length
          ? Math.round((completed / companyTasks.length) * 100)
          : 0;

        const byMonth = new Map<string, RoadmapTaskItem[]>();
        for (const task of companyTasks) {
          const key = monthKey(task.dueDate);
          if (!byMonth.has(key)) byMonth.set(key, []);
          byMonth.get(key)!.push(task);
        }

        const months = [...byMonth.entries()].sort(([a], [b]) => {
          if (a === 'no-date') return 1;
          if (b === 'no-date') return -1;
          return a.localeCompare(b);
        });

        return {
          company,
          companyTasks,
          completed,
          active,
          overdue,
          progress,
          months,
        };
      })
      .filter(Boolean) as Array<{
        company: CompanyName | typeof CROSS_COMPANY;
        companyTasks: RoadmapTaskItem[];
        completed: number;
        active: number;
        overdue: number;
        progress: number;
        months: [string, RoadmapTaskItem[]][];
      }>;
  }, [accessibleCompanies, filteredTasks, roadmapTasks]);

  const companyLabel = (company: CompanyName | typeof CROSS_COMPANY) =>
    company === CROSS_COMPANY ? t('roadmap.crossCompany') : company;

  const statusLabel = (status: RoadmapStatus) => {
    const key = status === 'open' ? 'open' : status;
    if (key in (t('tasks.statuses', { returnObjects: true }) as object)) {
      return t(`tasks.statuses.${key}`);
    }
    if (key in (t('projects.taskStatuses', { returnObjects: true }) as object)) {
      return t(`projects.taskStatuses.${key}`);
    }
    return status;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('roadmap.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('roadmap.descriptionByCompany')}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="all">{t('roadmap.allCompanies')}</option>
          {accessibleCompanies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
          {roadmapTasks.some(t => t.company === CROSS_COMPANY) && (
            <option value={CROSS_COMPANY}>{t('roadmap.crossCompany')}</option>
          )}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {['completed', 'in_progress', 'remaining', 'due_soon', 'overdue', 'open', 'blocked'].map(s => (
            <option key={s} value={s}>{statusLabel(s as RoadmapStatus)}</option>
          ))}
        </select>
      </div>

      {roadmapTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('roadmap.noTasks')}</p>
          <p className="text-gray-400 text-sm mt-1">{t('roadmap.noTasksHint')}</p>
        </div>
      ) : companySections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {companySections.map(section => (
            <section key={section.company} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{companyLabel(section.company)}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {t('roadmap.taskSummary', {
                        total: section.companyTasks.length,
                        completed: section.completed,
                        active: section.active,
                        overdue: section.overdue,
                      })}
                    </p>
                  </div>
                  <div className="min-w-[180px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">{t('roadmap.progress')}</span>
                      <span className="text-gray-700 font-medium">{section.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${section.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {section.months.map(([month, monthTasks]) => (
                  <div key={month}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      {month === 'no-date' ? t('roadmap.noDueDate') : formatMonthLabel(month, i18n.language)}
                    </h4>
                    <div className="space-y-2">
                      {monthTasks.map(task => (
                        <div
                          key={`${task.source}-${task.id}`}
                          className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                        >
                          <div className="w-24 shrink-0 text-xs text-gray-500 pt-0.5">
                            {task.dueDate || '—'}
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <div className="font-medium text-gray-900">{task.title}</div>
                            {task.description && (
                              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                              {task.framework && <span>{task.framework}</span>}
                              {task.projectTitle && task.projectId && (
                                <Link to={`/projects/${task.projectId}`} className="text-brand-600 hover:underline">
                                  {task.projectTitle}
                                </Link>
                              )}
                              {task.controlRef && (
                                <span className="text-amber-700">{task.controlRef}</span>
                              )}
                              {task.assignee && <span>{task.assignee}</span>}
                            </div>
                          </div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium shrink-0 ${statusColors[task.status] || statusColors.remaining}`}>
                            {statusLabel(task.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
