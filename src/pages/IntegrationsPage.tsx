import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { Integration, ConnectorConfig } from '../types';
import IntegrationConfigurator from '../components/IntegrationConfigurator';

const statusColors: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-700',
  disconnected: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-700',
  configuring: 'bg-amber-100 text-amber-700',
};
const statusDots: Record<string, string> = {
  connected: 'bg-emerald-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
  configuring: 'bg-amber-500',
};

const iconMap: Record<string, string> = {
  Cloud: '☁️',
  'Code Repository': '💻',
  'Project Management': '📋',
  Productivity: '📧',
  ITSM: '🔧',
  'Vulnerability Scanner': '🔍',
};

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { integrations, updateIntegration } = useCompliance();
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const configuringIntegration = integrations.find(i => i.id === configuringId) || null;

  const filtered = integrations.filter(i => {
    const mSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase());
    const mStatus = !filterStatus || i.status === filterStatus;
    return mSearch && mStatus;
  });

  const handleSaveConfig = (id: string, config: ConnectorConfig) => {
    updateIntegration(id, {
      config,
      status: 'connected',
      lastSync: new Date().toISOString(),
      lastError: undefined,
    });
    setConfiguringId(null);
  };

  const handleTestConnection = async (id: string, config: ConnectorConfig): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 800));
    const integ = integrations.find(i => i.id === id);
    if (integ?.connectorType === 'm365') {
      return false;
    }
    return true;
  };

  const handleDisconnect = (id: string) => {
    updateIntegration(id, { status: 'disconnected', lastError: undefined });
  };

  const handleReconnect = (id: string) => {
    const integ = integrations.find(i => i.id === id);
    if (integ) {
      setConfiguringId(id);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('integrations.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('integrations.description')}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {Object.keys(statusColors).map(s => (
            <option key={s} value={s}>{t(`integrations.statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-gray-400 text-lg">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(integ => (
            <div
              key={integ.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <span className="text-3xl shrink-0">{iconMap[integ.type] || '🔌'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{integ.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColors[integ.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDots[integ.status]}`} />
                    {t(`integrations.statuses.${integ.status}`)}
                  </span>
                  {integ.version && (
                    <span className="text-xs text-gray-400">v{integ.version}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{integ.type}</p>
                {integ.lastSync && (
                  <p className="text-xs text-gray-400 mt-1">
                    {t('integrations.lastSync')}: {new Date(integ.lastSync).toLocaleString()}
                  </p>
                )}
                {integ.status === 'error' && integ.lastError && (
                  <p className="text-xs text-red-500 mt-1 truncate" title={integ.lastError}>
                    {integ.lastError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => setConfiguringId(integ.id)}
                  className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  {t('integrations.configure')}
                </button>
                {integ.status === 'disconnected' && (
                  <button
                    onClick={() => handleReconnect(integ.id)}
                    className="px-3 py-1.5 text-xs border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-100"
                  >
                    {t('integrations.reConnect')}
                  </button>
                )}
                {integ.status === 'connected' && (
                  <button
                    onClick={() => handleDisconnect(integ.id)}
                    className="px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded-lg hover:bg-red-50"
                  >
                    {t('integrations.disconnect')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {configuringIntegration && (
        <IntegrationConfigurator
          integration={configuringIntegration}
          onSave={handleSaveConfig}
          onTest={handleTestConnection}
          onDisconnect={handleDisconnect}
          onClose={() => setConfiguringId(null)}
        />
      )}
    </div>
  );
}
