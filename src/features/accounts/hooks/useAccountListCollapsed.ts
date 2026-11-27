import { useCallback, useState } from 'react';

const STORAGE_KEY = 'account-list-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Хранит свёрнутость секции «Расчётные счета» и переживает перезагрузку страницы. */
export function useAccountListCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // приватный режим или переполнение — состояние живёт только в памяти
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
