const rotateLeft = (value: number, bits: number) =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0;

const add32 = (...values: number[]) => {
  let result = 0;

  for (const value of values) {
    result = (result + value) >>> 0;
  }

  return result;
};

const createMd5PaddedBytes = (bytes: Uint8Array) => {
  const bitLength = BigInt(bytes.length) * 8n;
  const paddingLength = (56 - ((bytes.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(bytes.length + 1 + paddingLength + 8);

  padded.set(bytes);
  padded[bytes.length] = 0x80;

  for (let index = 0; index < 8; index += 1) {
    padded[padded.length - 8 + index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  }

  return padded;
};

export const hashMd5 = (bytes: Uint8Array) => {
  const padded = createMd5PaddedBytes(bytes);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const k = Array.from({ length: 64 }, (_, index) =>
    Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0,
  );

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new Uint32Array(16);

    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;

      words[index] =
        (padded[base] ?? 0) |
        ((padded[base + 1] ?? 0) << 8) |
        ((padded[base + 2] ?? 0) << 16) |
        ((padded[base + 3] ?? 0) << 24);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f = 0;
      let g = 0;

      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }

      const nextD = d;
      const nextB = add32(
        b,
        rotateLeft(add32(a, f >>> 0, k[index] ?? 0, words[g] ?? 0), s[index] ?? 0),
      );

      d = c;
      c = b;
      b = nextB;
      a = nextD;
    }

    a0 = add32(a0, a);
    b0 = add32(b0, b);
    c0 = add32(c0, c);
    d0 = add32(d0, d);
  }

  const output = new Uint8Array(16);
  const values = [a0, b0, c0, d0];

  values.forEach((value, index) => {
    const base = index * 4;

    output[base] = value & 0xff;
    output[base + 1] = (value >>> 8) & 0xff;
    output[base + 2] = (value >>> 16) & 0xff;
    output[base + 3] = (value >>> 24) & 0xff;
  });

  return output;
};

const createSm3PaddedBytes = (bytes: Uint8Array) => {
  const bitLength = BigInt(bytes.length) * 8n;
  const paddingLength = (56 - ((bytes.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(bytes.length + 1 + paddingLength + 8);

  padded.set(bytes);
  padded[bytes.length] = 0x80;

  for (let index = 0; index < 8; index += 1) {
    padded[padded.length - 1 - index] = Number(
      (bitLength >> BigInt(index * 8)) & 0xffn,
    );
  }

  return padded;
};

const p0 = (value: number) =>
  value ^ rotateLeft(value, 9) ^ rotateLeft(value, 17);

const p1 = (value: number) =>
  value ^ rotateLeft(value, 15) ^ rotateLeft(value, 23);

const ff = (x: number, y: number, z: number, round: number) =>
  round <= 15 ? x ^ y ^ z : (x & y) | (x & z) | (y & z);

const gg = (x: number, y: number, z: number, round: number) =>
  round <= 15 ? x ^ y ^ z : (x & y) | (~x & z);

export const hashSm3 = (bytes: Uint8Array) => {
  const padded = createSm3PaddedBytes(bytes);
  const vector: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ] = [
    0x7380166f,
    0x4914b2b9,
    0x172442d7,
    0xda8a0600,
    0xa96f30bc,
    0x163138aa,
    0xe38dee4d,
    0xb0fb0e4e,
  ];

  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Uint32Array(68);
    const wPrime = new Uint32Array(64);

    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;

      w[index] =
        ((padded[base] ?? 0) << 24) |
        ((padded[base + 1] ?? 0) << 16) |
        ((padded[base + 2] ?? 0) << 8) |
        (padded[base + 3] ?? 0);
    }

    for (let index = 16; index < 68; index += 1) {
      w[index] = (
        p1(
          (w[index - 16] ?? 0) ^
            (w[index - 9] ?? 0) ^
            rotateLeft(w[index - 3] ?? 0, 15),
        ) ^
        rotateLeft(w[index - 13] ?? 0, 7) ^
        (w[index - 6] ?? 0)
      ) >>> 0;
    }

    for (let index = 0; index < 64; index += 1) {
      wPrime[index] = ((w[index] ?? 0) ^ (w[index + 4] ?? 0)) >>> 0;
    }

    let a = vector[0];
    let b = vector[1];
    let c = vector[2];
    let d = vector[3];
    let e = vector[4];
    let f = vector[5];
    let g = vector[6];
    let h = vector[7];

    for (let index = 0; index < 64; index += 1) {
      const t = index <= 15 ? 0x79cc4519 : 0x7a879d8a;
      const ss1 = rotateLeft(
        add32(rotateLeft(a ?? 0, 12), e ?? 0, rotateLeft(t, index % 32)),
        7,
      );
      const ss2 = ss1 ^ rotateLeft(a ?? 0, 12);
      const tt1 = add32(ff(a ?? 0, b ?? 0, c ?? 0, index), d ?? 0, ss2, wPrime[index] ?? 0);
      const tt2 = add32(gg(e ?? 0, f ?? 0, g ?? 0, index), h ?? 0, ss1, w[index] ?? 0);

      d = c ?? 0;
      c = rotateLeft(b ?? 0, 9);
      b = a ?? 0;
      a = tt1;
      h = g ?? 0;
      g = rotateLeft(f ?? 0, 19);
      f = e ?? 0;
      e = p0(tt2);
    }

    vector[0] = (vector[0] ^ a) >>> 0;
    vector[1] = (vector[1] ^ b) >>> 0;
    vector[2] = (vector[2] ^ c) >>> 0;
    vector[3] = (vector[3] ^ d) >>> 0;
    vector[4] = (vector[4] ^ e) >>> 0;
    vector[5] = (vector[5] ^ f) >>> 0;
    vector[6] = (vector[6] ^ g) >>> 0;
    vector[7] = (vector[7] ^ h) >>> 0;
  }

  const output = new Uint8Array(32);

  vector.forEach((value, index) => {
    const base = index * 4;

    output[base] = (value >>> 24) & 0xff;
    output[base + 1] = (value >>> 16) & 0xff;
    output[base + 2] = (value >>> 8) & 0xff;
    output[base + 3] = value & 0xff;
  });

  return output;
};
