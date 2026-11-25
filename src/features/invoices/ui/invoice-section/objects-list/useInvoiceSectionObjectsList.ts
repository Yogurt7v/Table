import { useEffect, useRef, useState } from 'react';
import { useCollapsedObjects } from '@/shared/context/CollapsedObjectsContext';
import type { IAccountingObject } from '@/shared/types';

/**
 * Состояние списка объектов: сворачивание групп и раскрытие секции
 * «Объекты без счетов». При поиске секция раскрывается, только если
 * в скрытых объектах есть совпадения; сохранённые группы не трогаются.
 */
export function useInvoiceSectionObjectsList(
  objects: IAccountingObject[],
  hiddenObjects: IAccountingObject[],
  hasSearch: boolean,
  hiddenObjectsHaveMatches: boolean,
) {
  const { collapsedIds, collapseAll, expand } = useCollapsedObjects();
  const shouldOpenHidden = hasSearch && hiddenObjectsHaveMatches;
  const [hiddenOpen, setHiddenOpen] = useState(shouldOpenHidden);
  const allCollapsed =
    objects.length > 0 && !hiddenOpen && objects.every((o) => collapsedIds.has(o.id));
  const showCollapseButton = objects.length > 1 || (objects.length > 0 && hiddenObjects.length > 0);

  // Секция «Объекты без счетов» открывается при поиске, только когда в ней есть
  // совпадения; закрыть её пользователь может вручную.
  const prevShouldOpenHiddenRef = useRef(shouldOpenHidden);
  useEffect(() => {
    if (shouldOpenHidden && !prevShouldOpenHiddenRef.current) setHiddenOpen(true);
    prevShouldOpenHiddenRef.current = shouldOpenHidden;
  }, [shouldOpenHidden]);

  const handleCollapseAll = () => {
    collapseAll();
    setHiddenOpen(false);
  };

  const handleExpandAll = () => {
    expand(objects.map((o) => o.id));
  };

  const toggleHiddenOpen = () => setHiddenOpen((v) => !v);

  return {
    hiddenOpen,
    allCollapsed,
    showCollapseButton,
    handleCollapseAll,
    handleExpandAll,
    toggleHiddenOpen,
  };
}
