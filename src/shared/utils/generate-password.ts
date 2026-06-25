export function generatePassword(length = 8): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';

  const rand = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0]! % chars.length]!;

  let password = rand(upper) + rand(lower) + rand(digits);
  const all = upper + lower + digits;
  for (let i = password.length; i < length; i++) {
    password += rand(all);
  }

  const arr = [...password];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }

  return arr.join('');
}
