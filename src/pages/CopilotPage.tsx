import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';
import { apiFetch } from '../lib/api';

export default function CopilotPage() {
  const { t } = useTranslation();
  const { chatMessages, addChatMessage, clearChat } = useCompliance();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<'azure_openai' | 'local_fallback' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void apiFetch('/api/copilot/status')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setProvider(data.provider);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sending]);

  const askCopilot = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;

    addChatMessage({ role: 'user', content: message });
    setInput('');
    setSending(true);

    try {
      const history = chatMessages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiFetch('/api/copilot/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('copilot.error'));
      }
      if (data.provider) setProvider(data.provider);
      addChatMessage({ role: 'assistant', content: data.reply || t('copilot.error') });
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: err instanceof Error ? err.message : t('copilot.error'),
      });
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    void askCopilot(input);
  };

  const providerLabel =
    provider === 'azure_openai'
      ? t('copilot.providerAzure')
      : provider === 'local_fallback'
        ? t('copilot.providerLocal')
        : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('copilot.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('copilot.description')}</p>
          {providerLabel && (
            <p className="text-xs text-gray-400 mt-1">{providerLabel}</p>
          )}
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
          >
            {t('copilot.clearChat')}
          </button>
        )}
      </div>

      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col"
        style={{ height: 'calc(100vh - 240px)' }}
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-gray-400 mb-6">{t('copilot.description')}</p>
              <div className="space-y-2 max-w-md mx-auto">
                {(t('copilot.suggestions', { returnObjects: true }) as string[]).map((s, i) => (
                  <button
                    key={i}
                    disabled={sending}
                    onClick={() => void askCopilot(s)}
                    className="block w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-brand-200' : 'text-gray-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 rounded-xl px-4 py-3 text-sm">
                {t('copilot.thinking')}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={t('copilot.placeholder')}
              disabled={sending}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
            >
              {t('copilot.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
