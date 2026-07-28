import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompliance } from '../context/ComplianceContext';

const BOT_RESPONSES: Record<string, string> = {
  compliance: 'Based on the current data, your main compliance gaps are: 1) NBU Resolution №143 — only 35% complete, 2) PCI DSS — 15% complete, 3) DORA vendor risk assessments not started. I recommend focusing on gap analysis for NBU №143 first as it has the nearest regulatory deadline.',
  iso: 'Preparing for ISO 27001 audit involves: 1) Complete gap analysis against Annex A controls, 2) Ensure all required policies are documented and approved, 3) Conduct internal audit, 4) Review management review meeting minutes, 5) Prepare evidence for each control. Your current progress is 35% — I recommend prioritizing the Statement of Applicability (SoA).',
  pci: 'PCI DSS Requirement 10: Track and monitor all access to network resources and cardholder data. Key sub-requirements: 10.1 Audit trails, 10.2 Automated audit trails, 10.3 Audit trail protection, 10.4 Log reviews, 10.5 Retention (12 months), 10.6 Time synchronization, 10.7 Incident response. Your organization currently has 3 failed checks related to logging.',
  tasks: 'Here\'s the current task status: Completed: 2, In Progress: 3, Due Soon: 1, Overdue: 1, Remaining: 3. The overdue task is "Vulnerability scan - Q3" assigned to Dmytro Kovalenko. Would you like me to send a reminder?',
  general: 'I\'m your CISO Copilot. I can help with compliance questions across ISO 27001, PCI DSS, GDPR, DORA, NIS2, SOC 2, HIPAA, NIST CSF, and Ukrainian regulations (NBU №143, NBU №95, NBU №187, NBU №43). Try asking about compliance gaps, audit preparation, or specific requirements.',
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('gap') || lower.includes('compliance')) return BOT_RESPONSES.compliance;
  if (lower.includes('iso') || lower.includes('27001') || lower.includes('audit')) return BOT_RESPONSES.iso;
  if (lower.includes('pci') || lower.includes('requirement')) return BOT_RESPONSES.pci;
  if (lower.includes('task') || lower.includes('status')) return BOT_RESPONSES.tasks;
  return BOT_RESPONSES.general;
}

export default function CopilotPage() {
  const { t } = useTranslation();
  const { chatMessages, addChatMessage, clearChat } = useCompliance();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    addChatMessage({ role: 'user', content: input });
    setTimeout(() => {
      addChatMessage({ role: 'assistant', content: getBotResponse(input) });
    }, 500);
    setInput('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">{t('copilot.title')}</h2><p className="text-sm text-gray-500 mt-1">{t('copilot.description')}</p></div>
        {chatMessages.length > 0 && <button onClick={clearChat} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">{t('copilot.clearChat')}</button>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-gray-400 mb-6">{t('copilot.description')}</p>
              <div className="space-y-2 max-w-md mx-auto">
                {(t('copilot.suggestions', { returnObjects: true }) as string[]).map((s, i) => (
                  <button key={i} onClick={() => { addChatMessage({ role: 'user', content: s }); setTimeout(() => addChatMessage({ role: 'assistant', content: getBotResponse(s) }), 500); }} className="block w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors">{s}</button>
                ))}
              </div>
            </div>
          )}
          {chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-brand-200' : 'text-gray-400'}`}>{new Date(msg.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t('copilot.placeholder')}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <button onClick={handleSend} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">{t('copilot.send')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
