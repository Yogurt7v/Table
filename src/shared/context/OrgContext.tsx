import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useOrganizations } from '@/shared/hooks/useOrganizations';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import { useAuth } from '@/shared/context/AuthContext';
import type { IOrganization } from '@/shared/types';

interface OrgContextValue {
  currentOrgId: string;
  setCurrentOrgId: (id: string) => void;
  currentOrg: IOrganization | undefined;
  organizations: IOrganization[];
  organizationsLoading: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = 'currentOrgId';

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrgId, setCurrentOrgIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || '',
  );

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const { user } = useAuth();
  const { data: allOrganizations = [], isLoading: organizationsLoading } = useOrganizations();
  const { data: orgUsers } = useOrganizationUsers();

  const organizations = useMemo(() => {
    if (!user || !orgUsers) return allOrganizations;
    const userOrgIds = new Set(
      orgUsers
        .filter((ou) => ou.user_id === user.id)
        .map((ou) => ou.organization_id),
    );
    return allOrganizations.filter((o) => userOrgIds.has(o.id));
  }, [allOrganizations, user, orgUsers]);

  useEffect(() => {
    if (!currentOrgId && organizations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentOrgId(organizations[0]!.id);
    }
  }, [organizations, currentOrgId, setCurrentOrgId]);

  useEffect(() => {
    if (
      currentOrgId &&
      organizations.length > 0 &&
      !organizations.some((o) => o.id === currentOrgId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentOrgId(organizations[0]!.id);
    }
  }, [currentOrgId, organizations, setCurrentOrgId]);

  const currentOrg = organizations.find((o) => o.id === currentOrgId);

  return (
    <OrgContext.Provider
      value={{ currentOrgId, setCurrentOrgId, currentOrg, organizations, organizationsLoading }}
    >
      {children}
    </OrgContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
