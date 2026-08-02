import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (user && !token) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('auth.resetTokenMissing'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('auth.resetFailed'));
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      setError(t('auth.resetFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-20 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-30 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.resetPasswordTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('auth.resetPasswordDescription')}</p>
        </div>

        {!token ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{t('auth.resetTokenMissing')}</p>
            <Link to="/forgot-password" className="block text-center text-sm text-brand-600 hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-emerald-700">{t('auth.resetSuccess')}</p>
            <Link to="/login" className="text-sm text-brand-600 hover:underline">{t('auth.backToLogin')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? t('common.saving') : t('auth.resetPassword')}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-brand-600 hover:underline">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
