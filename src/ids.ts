export function newId(): string {
  try {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj != null && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
    const getRandomValues = cryptoObj?.getRandomValues?.bind(cryptoObj);
    if (getRandomValues) {
      const bytes = getRandomValues(new Uint8Array(16));
      bytes.set([((bytes.at(6) ?? 0) & 0x0f) | 0x40], 6);
      bytes.set([((bytes.at(8) ?? 0) & 0x3f) | 0x80], 8);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    /* Fall through to Math.random fallback. */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
