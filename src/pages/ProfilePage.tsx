import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  COMPANIES,
  PERMISSIONS,
  ROLE_CAPABILITY_MATRIX,
  companyNamesFromAccess,
  normalizeUserAccess,
  roleLabel,
  userHasPermission,
  type Permission,
} from '../lib/permissions';

function capabilityCell(value: boolean | string, t: (k: string) => string) {
  if (value === true) return <span className="text-emerald-600 font-medium">✓</span>;
  if (value === false) return <span className="text-gray-300">—</span>;
  if (value === 'most') return <span className="text-xs text-brand-700">{t('auth.cap.most')}</span>;
  if (value === 'createEdit') return <span className="text-xs text-brand-700">{t('auth.cap.createEdit')}</span>;
  if (value === 'review') return <span className="text-xs text-brand-700">{t('auth.cap.review')}</span>;
  return <span className="text-xs text-gray-500">{String(value)}</span>;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const access = useMemo(() => (user ? normalizeUserAccess(user) : {}), [user]);
  const companies = useMemo(() => companyNamesFromAccess(access), [access]);
  const myPermissions = useMemo(() => {
    if (!user) return [] as Permission[];
    return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => userHasPermission(user, p));
  }, [user]);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('auth.passwordChangeFailed'));
        return;
      }
      setSuccess(t('auth.passwordChangeSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
    } catch {
      setError(t('auth.passwordChangeFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('auth.profileTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('auth.profileDescription')}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('auth.accountSection')}</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">{t('auth.name')}</dt>
            <dd className="font-medium text-gray-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('auth.email')}</dt>
            <dd className="font-medium text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('auth.role')}</dt>
            <dd className="font-medium text-gray-900 capitalize">{roleLabel(user.role)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('auth.status')}</dt>
            <dd>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {user.active ? t('auth.active') : t('auth.inactive')}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('auth.companyAccessSection')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('auth.profileCompaniesHint')}</p>
        {companies.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t('auth.noCompanyAccess')}</p>
        ) : (
          <ul className="space-y-2">
            {COMPANIES.filter((c) => access[c]).map((company) => (
              <li key={company} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-800">{t(`auth.companies.${company}`, company)}</span>
                <span className="capitalize text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                  {access[company]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t('auth.yourPermissions')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('auth.yourPermissionsHint')}</p>
        </div>
        <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-50">
          {myPermissions.map((p) => (
            <span key={p} className="inline-flex px-2 py-1 rounded bg-brand-50 text-brand-800 text-xs font-mono">
              {p}
            </span>
          ))}
          {myPermissions.length === 0 && (
            <span className="text-sm text-gray-400">{t('auth.noPermissions')}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2.5 px-4 text-gray-500 font-medium">{t('auth.permission')}</th>
                <th className="text-center py-2.5 px-3 text-gray-500 font-medium capitalize">{user.role}</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_CAPABILITY_MATRIX.map((row) => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="py-2.5 px-4 text-gray-800">{t(`auth.cap.${row.key}`)}</td>
                  <td className="py-2.5 px-3 text-center">{capabilityCell(row[user.role], t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('auth.changePassword')}</h3>
        <p className="text-xs text-gray-500 mb-4">{t('auth.changePasswordHint')}</p>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('auth.savePassword')}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4">
          {t('auth.forgotPasswordProfileHint')}{' '}
          <Link to="/forgot-password" className="text-brand-600 hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </p>
      </div>
    </div>
  );
}
