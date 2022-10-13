export const sumUint8Array = (v: Uint8Array) => {
  return v.reduce((x, y) => x + y);
};

export const checkSumUint8Array = (v: Uint8Array) => {
  return Uint8Array.of((256 - sumUint8Array(v)) % 256);
};

export const equalsUint8Array = (r: Uint8Array, l: Uint8Array) => {
  if (r.byteLength !== l.byteLength) {
    return false;
  }

  for (let i = 0; i < r.byteLength; ++i) {
    if (r[i] !== l[i]) {
      return false;
    }
  }
  return true;
};

export const asLittleEndian = (v: Number) => {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, v as number, true);
  return new Uint8Array(buffer);
};
