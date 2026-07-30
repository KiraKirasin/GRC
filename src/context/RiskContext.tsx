import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  RiskItem,
  genRiskEntityId,
  nextRiskCode,
  normalizeRiskItem,
} from '../types';

interface RiskContextType {
  risks: RiskItem[];
  addRisk: (risk: Omit<RiskItem, 'id' | 'createdAt' | 'updatedAt' | 'riskCode'> & { riskCode?: string }) => RiskItem;
  updateRisk: (id: string, risk: Partial<RiskItem>) => RiskItem | undefined;
  deleteRisk: (id: string) => void;
  getRisk: (id: string) => RiskItem | undefined;
}

const RiskContext = createContext<RiskContextType | undefined>(undefined);

function loadRisks(): RiskItem[] {
  try {
    const saved = localStorage.getItem('grc-risks');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: Partial<RiskItem>) => normalizeRiskItem(r));
  } catch {
    return [];
  }
}

export function RiskProvider({ children }: { children: ReactNode }) {
  const [risks, setRisks] = useState<RiskItem[]>(loadRisks);

  useEffect(() => {
    localStorage.setItem('grc-risks', JSON.stringify(risks));
  }, [risks]);

  const addRisk = useCallback((data: Omit<RiskItem, 'id' | 'createdAt' | 'updatedAt' | 'riskCode'> & { riskCode?: string }) => {
    const now = new Date().toISOString();
    const created = normalizeRiskItem({
      ...data,
      id: genRiskEntityId(),
      riskCode: data.riskCode?.trim() || nextRiskCode(risks),
      createdAt: now,
      updatedAt: now,
    });
    setRisks((prev) => [created, ...prev]);
    return created;
  }, [risks]);

  const updateRisk = useCallback((id: string, data: Partial<RiskItem>) => {
    let updated: RiskItem | undefined;
    setRisks((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        updated = normalizeRiskItem({
          ...r,
          ...data,
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: new Date().toISOString(),
        });
        return updated;
      }),
    );
    return updated;
  }, []);

  const deleteRisk = useCallback((id: string) => {
    setRisks((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRisk = useCallback(
    (id: string) => risks.find((r) => r.id === id),
    [risks],
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
