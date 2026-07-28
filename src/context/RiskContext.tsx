import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RiskItem, RiskStatus } from '../types';

interface RiskContextType {
  risks: RiskItem[];
  addRisk: (risk: Omit<RiskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRisk: (id: string, risk: Partial<RiskItem>) => void;
  deleteRisk: (id: string) => void;
  getRisk: (id: string) => RiskItem | undefined;
}

const RiskContext = createContext<RiskContextType | undefined>(undefined);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function RiskProvider({ children }: { children: ReactNode }) {
  const [risks, setRisks] = useState<RiskItem[]>(() => {
    try {
      const saved = localStorage.getItem('grc-risks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('grc-risks', JSON.stringify(risks));
  }, [risks]);

  const addRisk = useCallback((data: Omit<RiskItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRisk: RiskItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    setRisks((prev) => [newRisk, ...prev]);
  }, []);

  const updateRisk = useCallback((id: string, data: Partial<RiskItem>) => {
    setRisks((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  const deleteRisk = useCallback((id: string) => {
    setRisks((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRisk = useCallback(
    (id: string) => risks.find((r) => r.id === id),
    [risks]
  );

  return (
    <RiskContext.Provider value={{ risks, addRisk, updateRisk, deleteRisk, getRisk }}>
      {children}
    </RiskContext.Provider>
  );
}

export function useRisks() {
  const ctx = useContext(RiskContext);
  if (!ctx) throw new Error('useRisks must be used within RiskProvider');
  return ctx;
}
