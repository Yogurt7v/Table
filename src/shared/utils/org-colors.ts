export interface OrgColorOption {
  value: string;
  label: string;
  name: string;
}

/**
 * Цвета организации — это всегда цвета лежит в палитре Mantine.
 * `name` — имя токена Mantine, чтобы primaryColor темы мог следовать
 * за цветом организации (см. OrgPrimaryProvider).
 */
export const ORG_COLORS: OrgColorOption[] = [
  { value: '#228be6', label: 'Синий', name: 'blue' },
  { value: '#40c057', label: 'Зелёный', name: 'green' },
  { value: '#fa5252', label: 'Красный', name: 'red' },
  { value: '#fab005', label: 'Жёлтый', name: 'yellow' },
  { value: '#7950f2', label: 'Фиолетовый', name: 'violet' },
  { value: '#fd7e14', label: 'Оранжевый', name: 'orange' },
  { value: '#15aabf', label: 'Голубой', name: 'cyan' },
  { value: '#e64980', label: 'Розовый', name: 'pink' },
];

const COLOR_TO_MANTINE: Record<string, string> = Object.fromEntries(
  ORG_COLORS.map((c) => [c.value, c.name]),
);

/** Имя токена Mantine по hex-цвету организации (фолбэк — 'blue'). */
export function orgToMantineColor(hex: string | null | undefined): string {
  return (hex && COLOR_TO_MANTINE[hex]) || 'blue';
}

export const ORG_COLOR_NAME: Record<string, string> = Object.fromEntries(
  ORG_COLORS.map((c) => [c.value, c.label]),
);