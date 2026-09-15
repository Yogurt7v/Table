export function toFixed2(n: number) {
  const parts = n.toFixed(2).split('.');
  const spaced = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${spaced}.${parts[1]} ₽`;
}

export function cleanInput(raw: string): string {
  let result = '';
  let hasDecimal = false;
  let decimalDigits = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === ' ') continue;
    if (ch === '-' && result === '') {
      result += '-';
    } else if (ch >= '0' && ch <= '9') {
      if (hasDecimal && decimalDigits >= 2) continue;
      result += ch;
      if (hasDecimal) decimalDigits++;
    } else if ((ch === '.' || ch === ',') && !hasDecimal) {
      hasDecimal = true;
      result += ',';
    }
  }
  return result;
}

export function formatForDisplay(value: string): string {
  const commaIdx = value.indexOf(',');
  if (commaIdx === -1) {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  const intPart = value.slice(0, commaIdx);
  const decPart = value.slice(commaIdx + 1);
  const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${spaced},${decPart}`;
}

export function parseToNumber(value: string): number {
  const num = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}