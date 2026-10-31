// Pix "copia e cola" code (static BR Code, EMV QR format) for a key, to show as text and as a QR code.
// Banks read the receiver from the key itself; the name and city fields are required by the format.

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE, the checksum the BR Code ends with. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const plain = (s: string, max: number) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max);

export function pixPayload({ key, name, city }: { key: string; name: string; city: string }): string {
  const body =
    field('00', '01') +
    field('01', '11') + // static: the same code can be paid many times
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') + // BRL
    field('58', 'BR') +
    field('59', plain(name, 25)) +
    field('60', plain(city, 15)) +
    field('62', field('05', '***')) +
    '6304';
  return body + crc16(body);
}
