import * as asn1js from "asn1js";

export type CipherMode = "C1C3C2" | "C1C2C3";

export interface Sm2CipherStruct {
  x: Uint8Array;   // C1.x (recommended 32 bytes before DER INTEGER encoding)
  y: Uint8Array;   // C1.y
  c3: Uint8Array;  // hash, typically 32 bytes (SM3)
  c2: Uint8Array;  // ciphertext body
}

export interface Sm2SignatureStruct {
  r: Uint8Array;
  s: Uint8Array;
}

export class Sm2Asn1Error extends Error {
  code:
    | "ERR_ASN1_PARSE"
    | "ERR_ASN1_SCHEMA"
    | "ERR_SM2_FIELD_LENGTH"
    | "ERR_SM2_VALUE_RANGE";
  detail?: unknown;

  constructor(
    code: Sm2Asn1Error["code"],
    message: string,
    detail?: unknown,
  ) {
    super(message);
    this.name = "Sm2Asn1Error";
    this.code = code;
    this.detail = detail;
  }
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// DER INTEGER must be signed; prepend 0x00 if MSB is 1 to keep it positive.
function bytesToPositiveDerInteger(bytes: Uint8Array): asn1js.Integer {
  if (bytes.length === 0) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "INTEGER bytes cannot be empty");
  }
  const normalized = stripLeadingZero(bytes);
  const needsPad = (normalized[0] & 0x80) !== 0;
  const value = needsPad ? Uint8Array.from([0x00, ...normalized]) : normalized;
  return new asn1js.Integer({ valueHex: toArrayBuffer(value) });
}

function derIntegerToUnsignedBytes(v: asn1js.Integer): Uint8Array {
  const raw = new Uint8Array(v.valueBlock.valueHex);
  // Remove sign padding 0x00 if present.
  if (raw.length > 1 && raw[0] === 0x00) return raw.slice(1);
  if (raw.length === 0) {
    throw new Sm2Asn1Error("ERR_SM2_VALUE_RANGE", "INTEGER decode produced empty bytes");
  }
  return raw;
}

function stripLeadingZero(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0x00) i++;
  return bytes.slice(i);
}

function leftPad32(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 32) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "Coordinate/signature component longer than 32 bytes");
  }
  if (bytes.length === 32) return bytes;
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function parseUncompressedC1(c1: Uint8Array): { x: Uint8Array; y: Uint8Array } {
  // Uncompressed EC point: 0x04 || X(32) || Y(32)
  if (c1.length !== 65 || c1[0] !== 0x04) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "C1 must be uncompressed point: 65 bytes starting with 0x04");
  }
  return { x: c1.slice(1, 33), y: c1.slice(33, 65) };
}

function buildUncompressedC1(x: Uint8Array, y: Uint8Array): Uint8Array {
  const xx = leftPad32(stripLeadingZero(x));
  const yy = leftPad32(stripLeadingZero(y));
  return Uint8Array.from([0x04, ...xx, ...yy]);
}

export function encodeSm2CipherDer(input: Sm2CipherStruct): Uint8Array {
  if (input.c3.length !== 32) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "c3 must be 32 bytes for SM3");
  }
  if (input.c2.length === 0) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "c2 cannot be empty");
  }

  const seq = new asn1js.Sequence({
    value: [
      bytesToPositiveDerInteger(input.x),
      bytesToPositiveDerInteger(input.y),
      new asn1js.OctetString({ valueHex: toArrayBuffer(input.c3) }),
      new asn1js.OctetString({ valueHex: toArrayBuffer(input.c2) }),
    ],
  });

  return new Uint8Array(seq.toBER(false)); // false => DER-like definite encoding
}

export function decodeSm2CipherDer(der: Uint8Array): Sm2CipherStruct {
  const parsed = asn1js.fromBER(toArrayBuffer(der));
  if (parsed.offset === -1 || !parsed.result) {
    throw new Sm2Asn1Error("ERR_ASN1_PARSE", "Failed to parse SM2Cipher DER");
  }

  const seq = parsed.result;
  if (!(seq instanceof asn1js.Sequence) || seq.valueBlock.value.length !== 4) {
    throw new Sm2Asn1Error("ERR_ASN1_SCHEMA", "SM2Cipher must be SEQUENCE of 4 fields");
  }

  const [xNode, yNode, c3Node, c2Node] = seq.valueBlock.value;
  if (!(xNode instanceof asn1js.Integer) || !(yNode instanceof asn1js.Integer)) {
    throw new Sm2Asn1Error("ERR_ASN1_SCHEMA", "x/y must be INTEGER");
  }
  if (!(c3Node instanceof asn1js.OctetString) || !(c2Node instanceof asn1js.OctetString)) {
    throw new Sm2Asn1Error("ERR_ASN1_SCHEMA", "c3/c2 must be OCTET STRING");
  }

  const x = leftPad32(derIntegerToUnsignedBytes(xNode));
  const y = leftPad32(derIntegerToUnsignedBytes(yNode));
  const c3 = new Uint8Array(c3Node.valueBlock.valueHex);
  const c2 = new Uint8Array(c2Node.valueBlock.valueHex);

  if (c3.length !== 32) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "Decoded c3 length is not 32 bytes");
  }
  if (c2.length === 0) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "Decoded c2 is empty");
  }

  return { x, y, c3, c2 };
}

export function encodeSm2SignatureDer(input: Sm2SignatureStruct): Uint8Array {
  const seq = new asn1js.Sequence({
    value: [
      bytesToPositiveDerInteger(input.r),
      bytesToPositiveDerInteger(input.s),
    ],
  });

  return new Uint8Array(seq.toBER(false));
}

export function decodeSm2SignatureDer(der: Uint8Array): Sm2SignatureStruct {
  const parsed = asn1js.fromBER(toArrayBuffer(der));
  if (parsed.offset === -1 || !parsed.result) {
    throw new Sm2Asn1Error("ERR_ASN1_PARSE", "Failed to parse SM2Signature DER");
  }

  const seq = parsed.result;
  if (!(seq instanceof asn1js.Sequence) || seq.valueBlock.value.length !== 2) {
    throw new Sm2Asn1Error("ERR_ASN1_SCHEMA", "SM2Signature must be SEQUENCE of 2 INTEGER fields");
  }

  const [rNode, sNode] = seq.valueBlock.value;
  if (!(rNode instanceof asn1js.Integer) || !(sNode instanceof asn1js.Integer)) {
    throw new Sm2Asn1Error("ERR_ASN1_SCHEMA", "r/s must be INTEGER");
  }

  // Keep 32-byte normalized form for easier raw interop with sm-crypto
  const r = leftPad32(derIntegerToUnsignedBytes(rNode));
  const s = leftPad32(derIntegerToUnsignedBytes(sNode));

  return { r, s };
}

// Raw layout with an explicit uncompressed-point marker.
// sm-crypto omits 04: callers must add/remove it at the library boundary.
// C1C3C2: 04|x(32)|y(32)|c3(32)|c2
// C1C2C3: 04|x(32)|y(32)|c2|c3(32)
export function convertRawCipherToAsn1(raw: Uint8Array, mode: CipherMode): Uint8Array {
  if (raw.length < 65 + 32 + 1) {
    throw new Sm2Asn1Error("ERR_SM2_FIELD_LENGTH", "Raw cipher is too short");
  }

  const { x, y } = parseUncompressedC1(raw.slice(0, 65));
  let c3: Uint8Array;
  let c2: Uint8Array;

  if (mode === "C1C3C2") {
    c3 = raw.slice(65, 97);
    c2 = raw.slice(97);
  } else {
    c3 = raw.slice(raw.length - 32);
    c2 = raw.slice(65, raw.length - 32);
  }

  return encodeSm2CipherDer({ x, y, c3, c2 });
}

export function convertAsn1ToRawCipher(der: Uint8Array, mode: CipherMode): Uint8Array {
  const { x, y, c3, c2 } = decodeSm2CipherDer(der);
  const c1 = buildUncompressedC1(x, y);

  if (mode === "C1C3C2") {
    return Uint8Array.from([...c1, ...c3, ...c2]);
  }
  return Uint8Array.from([...c1, ...c2, ...c3]);
}
