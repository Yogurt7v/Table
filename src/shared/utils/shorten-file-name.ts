export function shortenFileName(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) {
    return name.length > 20 ? name.slice(0, 20) + '…' : name;
  }
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  return base.length > 16 ? base.slice(0, 16) + '…' + ext : name;
}