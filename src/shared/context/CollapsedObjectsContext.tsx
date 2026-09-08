import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface CollapsedObjectsContextValue {
  collapsedIds: Set<string>;
  isCollapsed: (id: string) => boolean;
  toggle: (id: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  expand: (ids: string[]) => void;
}

const CollapsedObjectsContext = createContext<CollapsedObjectsContextValue | null>(null);

function readStorage(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`collapsed-objects:${orgId}`);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeStorage(orgId: string, ids: Set<string>) {
  localStorage.setItem(`collapsed-objects:${orgId}`, JSON.stringify([...ids]));
}

export function CollapsedObjectsProvider({
  orgId,
  objectIds,
  children,
}: {
  orgId: string;
  objectIds: string[];
  children: ReactNode;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => readStorage(orgId));

  const toggle = useCallback(
    (id: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        writeStorage(orgId, next);
        return next;
      });
    },
    [orgId],
  );

  const collapseAll = useCallback(() => {
    const next = new Set(objectIds);
    setCollapsedIds(next);
    writeStorage(orgId, next);
  }, [orgId, objectIds]);

  const expandAll = useCallback(() => {
    const next = new Set<string>();
    setCollapsedIds(next);
    writeStorage(orgId, next);
  }, [orgId]);

  const expand = useCallback(
    (ids: string[]) => {
      setCollapsedIds((prev) => {
        if (ids.every((id) => !prev.has(id))) return prev;
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        writeStorage(orgId, next);
        return next;
      });
    },
    [orgId],
  );

  const isCollapsed = useCallback((id: string) => collapsedIds.has(id), [collapsedIds]);

  const value = useMemo(
    () => ({ collapsedIds, isCollapsed, toggle, collapseAll, expandAll, expand }),
    [collapsedIds, isCollapsed, toggle, collapseAll, expandAll, expand],
  );

  return (
    <CollapsedObjectsContext.Provider value={value}>{children}</CollapsedObjectsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCollapsedObjects() {
  const ctx = useContext(CollapsedObjectsContext);
  if (!ctx) throw new Error('useCollapsedObjects must be used within CollapsedObjectsProvider');
  return ctx;
}
