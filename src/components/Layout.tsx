import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useAuth, usePermission } from '../context/AuthContext';
import { roleLabel } from '../lib/permissions';
import { APP_VERSION } from '../version';

const NAV_ITEMS = [
  { to: '/', label: 'nav.dashboard', end: true, icon: '📊' },
  { to: '/projects', label: 'nav.projects', icon: '📁' },
  { to: '/risks', label: 'nav.riskRegister', icon: '⚠️' },
  { to: '/tasks', label: 'nav.tasks', icon: '✅' },
  { to: '/controls', label: 'nav.controls', icon: '🛡️' },
  { to: '/evidence-database', label: 'nav.evidenceDatabase', icon: '🗄️' },
  { to: '/policies', label: 'nav.policies', icon: '📜' },
  { to: '/documents', label: 'nav.documents', icon: '📄' },
  { to: '/roadmap', label: 'nav.roadmap', icon: '🗺️' },
  { to: '/copilot', label: 'nav.copilot', icon: '🤖' },
] as const;

const ADMIN_NAV_ITEMS = [
  { to: '/users', label: 'nav.users', icon: '👥' },
  { to: '/integrations', label: 'nav.integrations', icon: '🔗' },
] as const;

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const isAdmin = usePermission('users:manage');

  const sideLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-600/15 text-brand-600'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen flex bg-neutral-20">
      {/* Left sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <a href="https://novapay.ua" target="_blank" rel="noopener noreferrer">
            <img
              src="https://novapay.ua/wp-content/uploads/2023/11/novapay-new.svg"
              alt="NovaPay"
              className="h-7 w-auto"
            />
          </a>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium">GRC Platform</p>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              className={sideLink}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {t(item.label)}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('nav.admin')}</p>
              </div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={sideLink}>
                  <span className="text-base leading-none">{item.icon}</span>
                  {t(item.label)}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        {user && (
          <div className="border-t border-gray-100 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center text-brand-600 text-xs font-bold">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                <p className="text-[11px] text-gray-400 capitalize">{roleLabel(user.role)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={logout}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-center"
              >
                {t('auth.logout')}
              </button>
            </div>
            <div className="pt-2 border-t border-gray-50 text-center">
              <p className="text-[10px] text-gray-400 leading-tight">© {new Date().getFullYear()} NovaPay</p>
              <p className="text-[10px] text-gray-300 mt-0.5">v{APP_VERSION}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
