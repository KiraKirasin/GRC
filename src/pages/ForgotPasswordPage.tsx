import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  if (user) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDevResetUrl('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('auth.resetRequestFailed'));
        return;
      }
      setMessage(typeof data.message === 'string' ? data.message : t('auth.resetRequestSent'));
      if (typeof data.resetUrl === 'string') setDevResetUrl(data.resetUrl);
    } catch {
      setError(t('auth.resetRequestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-20 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-30 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.forgotPasswordTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('auth.forgotPasswordDescription')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {devResetUrl && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 break-all">
              <p className="font-medium mb-1">{t('auth.devResetLink')}</p>
              <a href={devResetUrl} className="text-brand-700 underline">
                {devResetUrl}
              </a>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? t('common.saving') : t('auth.sendResetLink')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-brand-600 hover:underline">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
