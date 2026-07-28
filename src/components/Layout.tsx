import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

const NAV_ITEMS = [
  { to: '/', label: 'nav.dashboard', end: true },
  { to: '/projects', label: 'nav.projects' },
  { to: '/risks', label: 'nav.riskRegister' },
  { to: '/tasks', label: 'nav.tasks' },
  { to: '/controls', label: 'nav.controls' },
  { to: '/evidence-database', label: 'nav.evidenceDatabase' },
  { to: '/policies', label: 'nav.policies' },
  { to: '/documents', label: 'nav.documents' },
  { to: '/roadmap', label: 'nav.roadmap' },
  { to: '/integrations', label: 'nav.integrations' },
  { to: '/copilot', label: 'nav.copilot' },
] as const;

export default function Layout() {
  const { t } = useTranslation();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-600/20 text-brand-600'
        : 'text-neutral-310 hover:text-neutral-340 hover:bg-neutral-20'
    }`;

  return (
    <div className="min-h-screen bg-neutral-20">
      <header className="bg-white border-b border-neutral-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6 min-w-0">
              <a href="https://novapay.ua" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src="https://novapay.ua/wp-content/uploads/2023/11/novapay-new.svg"
                  alt="NovaPay"
                  className="h-7 w-auto"
                />
              </a>
              <nav className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : undefined} className={linkClass}>
                    {t(item.label)}
                  </NavLink>
                ))}
              </nav>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
