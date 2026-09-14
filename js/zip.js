/* Minimaler ZIP-Schreiber (Methode 0 = stored, keine Kompression) — die
   Fotos sind bereits als JPEG komprimiert, Deflate brächte hier nichts. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosStamp(date) {
  const d = date || new Date();
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
  const dosDate = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
  return { time, dosDate };
}

export function zipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const records = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const { time, dosDate } = dosStamp(entry.date);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    records.push({ nameBytes, crc, size: data.length, time, dosDate, localHeaderOffset: offset });
    localParts.push(new Uint8Array(local.buffer), nameBytes, data);
    offset += 30 + nameBytes.length + data.length;
  }

  const centralDirStart = offset;
  for (const r of records) {
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, r.time, true);
    central.setUint16(14, r.dosDate, true);
    central.setUint32(16, r.crc, true);
    central.setUint32(20, r.size, true);
    central.setUint32(24, r.size, true);
    central.setUint16(28, r.nameBytes.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, r.localHeaderOffset, true);
    centralParts.push(new Uint8Array(central.buffer), r.nameBytes);
    offset += 46 + r.nameBytes.length;
  }
  const centralDirSize = offset - centralDirStart;

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, records.length, true);
  end.setUint16(10, records.length, true);
  end.setUint32(12, centralDirSize, true);
  end.setUint32(16, centralDirStart, true);
  end.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
