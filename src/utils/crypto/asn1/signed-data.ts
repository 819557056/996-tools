/** SM2/SM3 CMS SignedData. Binary input and DER attributes follow RFC 5652. */
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { sm2, sm3 } from 'sm-crypto';
import { OID } from './oid';
import { decodeSm2SignatureDer, encodeSm2SignatureDer } from './sm2';
import { bytesToHex, decodeMaterial, formatMaterial } from '../material-format';

export class P7Error extends Error {
  constructor(message: string) { super(message); this.name = 'P7Error'; }
}
export interface P7SignOptions {
  message: string;
  privateKey: string;
  certificate?: string;
  mode: 'attached' | 'detached';
  includeSigningTime?: boolean;
  userId?: string;
}
export interface P7VerifyOptions { p7Der: Uint8Array; message?: string; publicKey?: string; userId?: string; }
export interface P7VerifyResult { valid: boolean; signerCert?: pkijs.Certificate; signingTime?: Date; error?: string; }

function buffer(bytes: Uint8Array): ArrayBuffer { return Uint8Array.from(bytes).buffer; }
function digest(bytes: Uint8Array): Uint8Array { return decodeMaterial(sm3(Array.from(bytes)), 'hex'); }
function equal(a: Uint8Array, b: Uint8Array): boolean { return a.length === b.length && a.every((byte, i) => byte === b[i]); }
function parseCertificate(pem: string): pkijs.Certificate {
  const bytes = decodeMaterial(pem, 'pem');
  const parsed = asn1js.fromBER(buffer(bytes));
  if (parsed.offset !== bytes.length) throw new P7Error('Invalid certificate');
  return new pkijs.Certificate({ schema: parsed.result });
}
function publicKeyOf(cert: pkijs.Certificate): string {
  const spki = cert.subjectPublicKeyInfo;
  if (spki.algorithm.algorithmId !== '1.2.840.10045.2.1'
      || !(spki.algorithm.algorithmParams instanceof asn1js.ObjectIdentifier)
      || spki.algorithm.algorithmParams.valueBlock.toString() !== '1.2.156.10197.1.301') {
    throw new P7Error('Only SM2 certificates are supported');
  }
  const bytes = spki.subjectPublicKey.valueBlock.valueHexView;
  if (bytes.length !== 65 || bytes[0] !== 4) throw new P7Error('Unsupported SM2 public key encoding');
  return bytesToHex(bytes);
}
function sortedAttributes(attributes: pkijs.Attribute[]): pkijs.Attribute[] {
  return attributes.map(attribute => ({ attribute, hex: bytesToHex(new Uint8Array(attribute.toSchema().toBER(false))) }))
    .sort((a, b) => a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0).map(entry => entry.attribute);
}
function attributeBytes(attributes: pkijs.Attribute[]): Uint8Array {
  return new Uint8Array(new asn1js.Set({ value: attributes.map(attribute => attribute.toSchema()) }).toBER(false));
}

export function generateP7SignedData(options: P7SignOptions): Uint8Array {
  const content = new TextEncoder().encode(options.message);
  const publicKey = sm2.getPublicKeyFromPrivateKey(options.privateKey);
  const cert = options.certificate ? parseCertificate(options.certificate) : undefined;
  if (cert && publicKeyOf(cert) !== publicKey.toLowerCase()) throw new P7Error('Certificate does not match private key');
  const attributes = [
    new pkijs.Attribute({ type: OID.CMS_CONTENT_TYPE, values: [new asn1js.ObjectIdentifier({ value: OID.CMS_DATA })] }),
    new pkijs.Attribute({ type: OID.CMS_MESSAGE_DIGEST, values: [new asn1js.OctetString({ valueHex: buffer(digest(content)) })] }),
  ];
  if (options.includeSigningTime) attributes.push(new pkijs.Attribute({
    type: OID.CMS_SIGNING_TIME, values: [new asn1js.UTCTime({ valueDate: new Date() })],
  }));
  const attrs = sortedAttributes(attributes);
  // SM2 signs SM3(ZA || DER SET OF attributes), not a hex string or a prehashed digest.
  const raw = sm2.doSignature(Array.from(attributeBytes(attrs)), options.privateKey, {
    hash: true, publicKey, userId: options.userId,
  });
  const signature = encodeSm2SignatureDer({ r: decodeMaterial(raw.slice(0, 64), 'hex'), s: decodeMaterial(raw.slice(64), 'hex') });
  const signer = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({
      issuer: cert?.issuer ?? new pkijs.RelativeDistinguishedNames(),
      serialNumber: cert?.serialNumber ?? new asn1js.Integer({ value: 1 }),
    }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.SM3 }),
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.SM2_SIGN_WITH_SM3 }),
    signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: attrs }),
    signature: new asn1js.OctetString({ valueHex: buffer(signature) }),
  });
  const encap = new pkijs.EncapsulatedContentInfo({ eContentType: OID.CMS_DATA });
  if (options.mode === 'attached') encap.eContent = new asn1js.OctetString({ valueHex: buffer(content) });
  const signed = new pkijs.SignedData({ version: 1, encapContentInfo: encap, signerInfos: [signer],
    digestAlgorithms: [new pkijs.AlgorithmIdentifier({ algorithmId: OID.SM3 })],
    ...(cert ? { certificates: [cert] } : {}),
  });
  const schema = signed.toSchema(true);
  if (options.mode === 'attached' && content.length === 0) {
    // PKIjs omits its default empty OCTET STRING. CMS must distinguish empty attached content from detached content.
    schema.valueBlock.value[2] = new asn1js.Sequence({ value: [
      new asn1js.ObjectIdentifier({ value: OID.CMS_DATA }),
      new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 0 }, value: [new asn1js.OctetString()] }),
    ] });
  }
  return new Uint8Array(new pkijs.ContentInfo({ contentType: OID.CMS_SIGNED_DATA, content: schema }).toSchema().toBER(false));
}

/** Identify the container before verification; an invalid P7 must not fall back to raw signatures. */
export function isP7SignedData(bytes: Uint8Array): boolean {
  try {
    const parsed = asn1js.fromBER(buffer(bytes));
    return parsed.offset !== -1 && new pkijs.ContentInfo({ schema: parsed.result }).contentType === OID.CMS_SIGNED_DATA;
  } catch { return false; }
}

export function verifyP7SignedData(options: P7VerifyOptions): P7VerifyResult {
  try {
    const parsed = asn1js.fromBER(buffer(options.p7Der));
    if (parsed.offset !== options.p7Der.length) throw new P7Error('Invalid P7 structure or trailing data');
    const info = new pkijs.ContentInfo({ schema: parsed.result });
    if (info.contentType !== OID.CMS_SIGNED_DATA) throw new P7Error('Not a SignedData structure');
    const signed = new pkijs.SignedData({ schema: info.content });
    if (signed.signerInfos.length !== 1) throw new P7Error('This P7 tool supports exactly one signer; multi-signer P7 is not supported');
    const signer = signed.signerInfos[0];
    if (signer.digestAlgorithm.algorithmId !== OID.SM3 || signer.signatureAlgorithm.algorithmId !== OID.SM2_SIGN_WITH_SM3) {
      throw new P7Error('Unsupported P7 algorithm');
    }
    if (!(signer.sid instanceof pkijs.IssuerAndSerialNumber)) throw new P7Error('Unsupported signer identifier');
    let signerCert: pkijs.Certificate | undefined;
    const sid = signer.sid;
    for (const cert of signed.certificates ?? []) {
      if (cert instanceof pkijs.Certificate && cert.issuer.isEqual(sid.issuer)
          && cert.serialNumber.isEqual(sid.serialNumber)) { signerCert = cert; break; }
    }
    const certificateKey = signerCert ? publicKeyOf(signerCert) : undefined;
    const publicKey = options.publicKey?.trim().toLowerCase() || certificateKey;
    if (!publicKey) throw new P7Error('No matching signer certificate or public key');
    if (certificateKey && publicKey !== certificateKey) throw new P7Error('Public key does not match signer certificate');
    let content: Uint8Array;
    if (signed.encapContentInfo.eContent) {
      // BER constructed OCTET STRINGs from BouncyCastle must be flattened.
      content = new Uint8Array(signed.encapContentInfo.eContent.getValue());
      if (options.message !== undefined && !equal(content, new TextEncoder().encode(options.message))) {
        throw new P7Error('Supplied message differs from embedded content');
      }
    } else content = new TextEncoder().encode(options.message ?? '');
    if (!signer.signedAttrs) throw new P7Error('P7 without signed attributes is unsupported');
    const attributes = signer.signedAttrs.attributes;
    const digests = attributes.filter(attr => attr.type === OID.CMS_MESSAGE_DIGEST);
    const types = attributes.filter(attr => attr.type === OID.CMS_CONTENT_TYPE);
    if (digests.length !== 1 || digests[0].values.length !== 1 || !(digests[0].values[0] instanceof asn1js.OctetString)
        || types.length !== 1 || types[0].values.length !== 1 || !(types[0].values[0] instanceof asn1js.ObjectIdentifier)
        || types[0].values[0].valueBlock.toString() !== signed.encapContentInfo.eContentType) {
      throw new P7Error('Invalid required signed attributes');
    }
    if (!equal(new Uint8Array(digests[0].values[0].getValue()), digest(content))) throw new P7Error('Message digest mismatch');
    const encoded = new Uint8Array(signer.signedAttrs.encodedValue);
    const canonical = attributeBytes(sortedAttributes(attributes));
    if (!equal(encoded, canonical)) throw new P7Error('Signed attributes are not canonical DER');
    const { r, s } = decodeSm2SignatureDer(new Uint8Array(signer.signature.getValue()));
    const valid = sm2.doVerifySignature(Array.from(encoded), bytesToHex(r) + bytesToHex(s), publicKey, { hash: true, userId: options.userId });
    const time = attributes.find(attr => attr.type === OID.CMS_SIGNING_TIME)?.values[0];
    return { valid, signerCert, signingTime: time instanceof asn1js.UTCTime || time instanceof asn1js.GeneralizedTime ? time.toDate() : undefined,
      ...(valid ? {} : { error: 'Signature verification failed' }) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'P7 verification failed' };
  }
}
export function p7DerToPem(der: Uint8Array): string {
  return formatMaterial(der, { encoding: 'base64', header: 'PKCS7', lineLength: 64 });
}
export function p7PemToDer(pem: string): Uint8Array { return decodeMaterial(pem, 'pem'); }
