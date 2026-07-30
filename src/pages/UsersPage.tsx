import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { usePermission } from '../context/AuthContext';
import {
  COMPANIES,
  PERMISSIONS,
  ROLE_CAPABILITY_MATRIX,
  USER_ROLES,
  type AuthUser,
  type CompanyName,
  type Permission,
  type UserRole,
} from '../lib/permissions';

const emptyForm = {
  email: '',
  name: '',
  password: '',
  role: 'auditor' as UserRole,
  companies: [] as CompanyName[],
  active: true,
};

function capabilityCell(value: boolean | string, t: (k: string) => string) {
  if (value === true) return <span className="text-emerald-600 font-medium">✓</span>;
  if (value === false) return <span className="text-gray-300">✗</span>;
  return <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{t(`auth.cap.${value}`)}</span>;
}

function permissionsForRole(role: UserRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(p =>
    (PERMISSIONS[p] as readonly string[]).includes(role),
  );
}

export default function UsersPage() {
  const { t } = useTranslation();
  const canManage = usePermission('users:manage');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) loadUsers();
  }, [canManage]);

  const rolePerms = useMemo(() => permissionsForRole(form.role), [form.role]);

  if (!canManage) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t('auth.accessDenied')}</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const openEdit = (user: AuthUser) => {
    setEditing(user);
    setForm({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      companies: user.role === 'admin' ? [...COMPANIES] : [...(user.companies || [])],
      active: user.active,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const setRole = (role: UserRole) => {
    setForm(f => ({
      ...f,
      role,
      companies: role === 'admin'
        ? [...COMPANIES]
        : (f.companies.length ? f.companies.filter(c => COMPANIES.includes(c)) : [...COMPANIES]),
    }));
  };

  const toggleCompany = (company: CompanyName) => {
    if (form.role === 'admin') return;
    setForm(f => ({
      ...f,
      companies: f.companies.includes(company)
        ? f.companies.filter(c => c !== company)
        : [...f.companies, company],
    }));
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setError('');
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.role !== 'admin' && form.companies.length === 0) {
      setError(t('auth.selectCompanyRequired'));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          name: form.name,
          role: form.role,
          companies: form.companies,
          active: form.active,
        };
        if (form.password.trim()) body.password = form.password;
        const res = await apiFetch(`/api/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || t('auth.updateFailed'));
          return;
        }
        setSuccess(t('auth.updateSuccess'));
      } else {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            name: form.name,
            password: form.password,
            role: form.role,
            companies: form.companies,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || t('auth.createFailed'));
          return;
        }
        setSuccess(t('auth.createSuccess'));
      }

      await loadUsers();
      setTimeout(() => closeForm(), 400);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: AuthUser) => {
    setError('');
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !user.active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t('auth.updateFailed'));
      return;
    }
    loadUsers();
  };

  const companyLabel = (c: string) => t(`auth.companies.${c}`, { defaultValue: c });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('auth.usersTitle')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('auth.usersDescription')}</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          + {t('auth.addUser')}
        </button>
      </div>

      {error && !showForm && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {success && !showForm && <p className="text-sm text-emerald-600 mb-4">{success}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t('auth.permissionsMatrix')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('auth.permissionsMatrixHint')}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">{t('auth.permission')}</th>
              {USER_ROLES.map(role => (
                <th key={role} className="text-center py-2.5 px-3 text-gray-500 font-medium capitalize">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_CAPABILITY_MATRIX.map(row => (
              <tr key={row.key} className="border-b border-gray-100">
                <td className="py-2.5 px-4 text-gray-800">{t(`auth.cap.${row.key}`)}</td>
                {USER_ROLES.map(role => (
                  <td key={role} className="py-2.5 px-3 text-center">
                    {capabilityCell(row[role], t)}
                  </td>
                ))}
              </tr>
            ))}
            {COMPANIES.map(company => (
              <tr key={company} className="border-b border-gray-100 bg-brand-50/30">
                <td className="py-2.5 px-4 text-gray-800 font-medium">{companyLabel(company)}</td>
                {USER_ROLES.map(role => (
                  <td key={role} className="py-2.5 px-3 text-center">
                    {role === 'admin' ? (
                      <span className="text-emerald-600 font-medium">✓</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">{t('auth.perUserCheckbox')}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('auth.name')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('auth.email')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('auth.role')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('auth.companiesLabel')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.status')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="py-3 px-4 font-medium text-gray-900">{u.name}</td>
                  <td className="py-3 px-4 text-gray-600">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700">
                      {t(`auth.roles.${u.role}`, { defaultValue: u.role })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.role === 'admin' ? COMPANIES : (u.companies || [])).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {companyLabel(c)}
                        </span>
                      ))}
                      {u.role !== 'admin' && !(u.companies || []).length && (
                        <span className="text-xs text-red-500">{t('auth.noCompanies')}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.active ? t('auth.active') : t('auth.inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                      >
                        {t('auth.editAccess')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {u.active ? t('auth.deactivate') : t('auth.activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 my-8">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? t('auth.editUserAccess') : t('auth.addUser')}
                </h3>
                {editing && (
                  <p className="text-xs text-gray-500 mt-1">{editing.email}</p>
                )}
              </div>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing ? t('auth.passwordOptional') : t('auth.password')}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={!editing}
                  minLength={editing && !form.password ? undefined : 6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Privileges = role */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('auth.privilegesSection')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('auth.privilegesHint')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.role')}</label>
                  <select
                    value={form.role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {USER_ROLES.map(role => (
                      <option key={role} value={role}>
                        {t(`auth.roles.${role}`, { defaultValue: role })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rolePerms.map(p => (
                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Company access */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('auth.companyAccessSection')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.role === 'admin' ? t('auth.adminAllCompanies') : t('auth.selectCompanies')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {COMPANIES.map(company => {
                    const checked = form.role === 'admin' || form.companies.includes(company);
                    return (
                      <label
                        key={company}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded bg-white border border-gray-100 ${form.role === 'admin' ? 'opacity-70' : 'cursor-pointer hover:border-brand-200'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={form.role === 'admin'}
                          onChange={() => toggleCompany(company)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-gray-800">{companyLabel(company)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  {t('auth.active')}
                </label>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-gray-600">
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? t('common.loading') : editing ? t('auth.saveAccess') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
