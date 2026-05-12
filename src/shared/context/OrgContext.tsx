import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useOrganizations } from '@/shared/hooks/useOrganizations';
import type { IOrganization } from '@/shared/types';

interface OrgContextValue {
  currentOrgId: string;
  setCurrentOrgId: (id: string) => void;
  currentOrg: IOrganization | undefined;
  organizations: IOrganization[];
}

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = 'currentOrgId';

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrgId, setCurrentOrgIdState] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCurrentOrgIdState(saved);
  }, []);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const { data: organizations = [] } = useOrganizations();

  useEffect(() => {
    if (!currentOrgId && organizations.length > 0) {
      setCurrentOrgId(organizations[0]!.id);
    }
  }, [organizations, currentOrgId, setCurrentOrgId]);

  const currentOrg = organizations.find((o) => o.id === currentOrgId);

  return (
    <OrgContext.Provider value={{ currentOrgId, setCurrentOrgId, currentOrg, organizations }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
