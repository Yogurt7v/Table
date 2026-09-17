/** Форматирует сумму без символа валюты (ru-RU). */
export function formatAmountNumber(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Форматирует сумму в рублях с копейками (ru-RU). */
export function formatAmountRub(amount: number): string {
  return `${formatAmountNumber(amount)} ₽`;
}
