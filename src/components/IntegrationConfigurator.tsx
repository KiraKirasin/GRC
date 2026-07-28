import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Integration, ConnectorConfig, ConnectorType } from '../types';

interface Props {
  integration: Integration;
  onSave: (id: string, config: ConnectorConfig) => void;
  onTest: (id: string, config: ConnectorConfig) => Promise<boolean>;
  onDisconnect: (id: string) => void;
  onClose: () => void;
}

const PASSWORD_FIELDS = new Set([
  'awsSecretAccessKey', 'm365ClientSecret', 'azureClientSecret',
  'githubToken', 'gitlabToken', 'jiraApiToken', 'gcpServiceAccountKey', 'googleSpacesServiceAccount',
]);

const CONNECTOR_FIELDS: Record<ConnectorType, { key: keyof ConnectorConfig; label: string; type?: string }[]> = {
  aws: [
    { key: 'awsAccessKeyId', label: 'integrations.fields.awsAccessKeyId' },
    { key: 'awsSecretAccessKey', label: 'integrations.fields.awsSecretAccessKey', type: 'password' },
    { key: 'awsRegion', label: 'integrations.fields.awsRegion' },
    { key: 'awsRoleArn', label: 'integrations.fields.awsRoleArn' },
  ],
  github: [
    { key: 'githubToken', label: 'integrations.fields.githubToken', type: 'password' },
    { key: 'githubOrganization', label: 'integrations.fields.githubOrganization' },
    { key: 'githubRepository', label: 'integrations.fields.githubRepository' },
  ],
  gitlab: [
    { key: 'gitlabToken', label: 'integrations.fields.gitlabToken', type: 'password' },
    { key: 'gitlabUrl', label: 'integrations.fields.gitlabUrl' },
    { key: 'gitlabProjectId', label: 'integrations.fields.gitlabProjectId' },
  ],
  m365: [
    { key: 'm365TenantId', label: 'integrations.fields.m365TenantId' },
    { key: 'm365ClientId', label: 'integrations.fields.m365ClientId' },
    { key: 'm365ClientSecret', label: 'integrations.fields.m365ClientSecret', type: 'password' },
  ],
  azure: [
    { key: 'azureTenantId', label: 'integrations.fields.azureTenantId' },
    { key: 'azureSubscriptionId', label: 'integrations.fields.azureSubscriptionId' },
    { key: 'azureClientId', label: 'integrations.fields.azureClientId' },
    { key: 'azureClientSecret', label: 'integrations.fields.azureClientSecret', type: 'password' },
  ],
  jira: [
    { key: 'jiraUrl', label: 'integrations.fields.jiraUrl' },
    { key: 'jiraUsername', label: 'integrations.fields.jiraUsername' },
    { key: 'jiraApiToken', label: 'integrations.fields.jiraApiToken', type: 'password' },
    { key: 'jiraProject', label: 'integrations.fields.jiraProject' },
  ],
  google_spaces: [
    { key: 'googleSpacesServiceAccount', label: 'integrations.fields.googleSpacesServiceAccount', type: 'password' },
    { key: 'googleSpacesDomain', label: 'integrations.fields.googleSpacesDomain' },
  ],
  gcp: [
    { key: 'gcpProjectId', label: 'integrations.fields.gcpProjectId' },
    { key: 'gcpServiceAccountKey', label: 'integrations.fields.gcpServiceAccountKey', type: 'password' },
    { key: 'gcpRegion', label: 'integrations.fields.gcpRegion' },
  ],
};

const iconMap: Record<string, string> = {
  Cloud: '☁️', 'Code Repository': '💻', 'Project Management': '📋', Productivity: '📧', ITSM: '🔧', 'Vulnerability Scanner': '🔍',
};

export default function IntegrationConfigurator({ integration, onSave, onTest, onDisconnect, onClose }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ConnectorConfig>({ ...integration.config });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [saving, setSaving] = useState(false);

  const fields = CONNECTOR_FIELDS[integration.connectorType] || [];

  const handleChange = (key: keyof ConnectorConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    const ok = await onTest(integration.id, config);
    setTestResult(ok ? 'success' : 'fail');
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    onSave(integration.id, config);
    setSaving(false);
  };

  const maskValue = (key: string, val: string) => {
    if (PASSWORD_FIELDS.has(key) && val.length > 8) {
      return val.slice(0, 4) + '••••' + val.slice(-4);
    }
    return val;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{iconMap[integration.type] || '🔌'}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('integrations.configTitle', { name: integration.name })}</h3>
              <p className="text-xs text-gray-400">{integration.name} — {integration.connectorType} {integration.version ? `v${integration.version}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-3 mb-6">
          {integration.lastError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <span className="font-medium">{t('integrations.lastError')}:</span> {integration.lastError}
            </div>
          )}

          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t(field.label)}</label>
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                value={(config[field.key] as string) || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              {field.type === 'password' && config[field.key] && (
                <p className="text-xs text-gray-400 mt-0.5">Current: {maskValue(field.key as string, config[field.key] as string)}</p>
              )}
            </div>
          ))}
        </div>

        {testResult === 'success' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 mb-4">{t('integrations.connectionTested')}</div>
        )}
        {testResult === 'fail' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-4">{t('integrations.connectionFailed')}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? '...' : t('integrations.testConnection')}
            </button>
            {integration.status === 'connected' && (
              <button
                onClick={() => { onDisconnect(integration.id); onClose(); }}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                {t('integrations.disconnect')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600">{t('common.cancel')}</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? '...' : integration.status === 'disconnected' || integration.status === 'configuring'
                ? t('integrations.saveConfig')
                : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
