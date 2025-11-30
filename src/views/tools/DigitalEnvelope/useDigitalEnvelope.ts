import { ref } from 'vue';
import { sm2, sm4 } from 'sm-crypto';
import forge from 'node-forge';

export default function useDigitalEnvelope() {
  // GM/T 0010 OIDs
  const OID = {
    envelopedData: '1.2.156.10197.6.1.4.2.3',
    data: '1.2.156.10197.6.1.4.2.1',
    sm2: '1.2.156.10197.1.301',
    sm4cbc: '1.2.156.10197.1.104',
  };

  const operationMode = ref<'envelope' | 'envelope-decrypt'>('envelope');

  // 数字信封
  const envelopePublicKey = ref('');
  const envelopeData = ref('');
  const envelopeResult = ref<{ sessionKey: string; encryptedSessionKey: string; encryptedData: string; asn1: string } | null>(null);

  // 解数字信封相关状态
  const envelopeDecryptPrivateKey = ref('');
  const envelopeDecryptInput = ref('');
  const envelopeDecryptResult = ref<{ sessionKey: string; decryptedData: string } | null>(null);

  function generateRandomHex(length: number) {
    const arr = new Uint8Array(length / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // 生成数字信封
  function generateEnvelope() {
    try {
      if (!envelopeData.value || !envelopePublicKey.value) return;

      // 1. Generate Session Key (SM4 Key - 16 bytes / 32 hex chars)
      const sessionKey = generateRandomHex(32);
      
      // 2. Encrypt Data with Session Key using SM4-CBC (GM/T 0010 requires CBC usually)
      const iv = generateRandomHex(32); // 16 bytes IV
      const encryptedData = sm4.encrypt(envelopeData.value, sessionKey, { mode: 'cbc', iv }); // Returns hex string

      // 3. Encrypt Session Key with SM2 Public Key
      const encryptedSessionKey = sm2.doEncrypt(sessionKey, envelopePublicKey.value, 1); // Default C1C3C2

      // 4. Construct GM/T 0010 EnvelopedData ASN.1 Structure
      // KeyTransRecipientInfo
      // EnvelopedData
      
      const asn1 = forge.asn1;
      
      // We use SubjectKeyIdentifier for RecipientIdentifier as we don't have Issuer/Serial
      // SKI is usually Hash(PublicKey). sm-crypto keys are 04+X+Y.
      // We can use a dummy hash or real SHA1 hash of the public key bytes.
      // For simplicity/demo, we use a random octet string or part of pubkey.
      const ski = forge.util.hexToBytes(envelopePublicKey.value.substring(2, 42)); // Just take some bytes

      const recipientInfos = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, forge.util.hexToBytes('02')), // Version 2 for SKI
          // RecipientIdentifier -> [0] SubjectKeyIdentifier
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, false, ski), 
          // KeyEncryptionAlgorithmIdentifier (SM2)
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, forge.asn1.oidToDer(OID.sm2).getBytes()),
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
          ]),
          // EncryptedKey (OCTET STRING)
          // Note: sm2.doEncrypt returns hex string. We put it in OCTET STRING.
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, forge.util.hexToBytes(encryptedSessionKey))
        ])
      ]);

      // EncryptedContentInfo
      const encryptedContentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, forge.asn1.oidToDer(OID.data).getBytes()),
        // ContentEncryptionAlgorithmIdentifier (SM4-CBC)
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, forge.asn1.oidToDer(OID.sm4cbc).getBytes()),
          // Parameters: IV (OCTET STRING)
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, forge.util.hexToBytes(iv))
        ]),
        // EncryptedContent ([0] IMPLICIT OCTET STRING)
        // forge specific: Class Context, Tag 0, Constructed false (primitive), value bytes
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, false, forge.util.hexToBytes(encryptedData))
      ]);

      const envelopedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, forge.util.hexToBytes('02')), // Version 2
        recipientInfos,
        encryptedContentInfo
      ]);

      const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, forge.asn1.oidToDer(OID.envelopedData).getBytes()),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [envelopedData])
      ]);

      const asn1Der = forge.asn1.toDer(contentInfo);
      const asn1Hex = forge.util.bytesToHex(asn1Der.getBytes());
      // const asn1Base64 = forge.util.encode64(asn1Der.getBytes()); // If needed

      envelopeResult.value = {
        sessionKey,
        encryptedSessionKey,
        encryptedData,
        asn1: asn1Hex
      };
    }
    catch (e) {
      console.error(e);
      alert(`Envelope generation failed: ${(e as Error).message}`);
    }
  }

  // 解数字信封
  function openEnvelope() {
    try {
      if (!envelopeDecryptInput.value || !envelopeDecryptPrivateKey.value) return;

      const asn1 = forge.asn1;
      // 1. Parse ASN.1 DER (Hex input)
      const inputBytes = forge.util.hexToBytes(envelopeDecryptInput.value.replace(/\s/g, ''));
      const contentInfo = asn1.fromDer(forge.util.createBuffer(inputBytes));

      // 2. Validate ContentType OID (EnvelopedData)
      const contentType = forge.asn1.derToOid(contentInfo.value[0].value);
      if (contentType !== OID.envelopedData) {
        throw new Error('Invalid ContentType: Not a valid GM/T 0010 EnvelopedData');
      }

      // EnvelopedData is in [0] EXPLICIT
      const envelopedData = contentInfo.value[1].value[0];
      
      // Structure: Version, RecipientInfos, EncryptedContentInfo
      const recipientInfos = envelopedData.value[1];
      const encryptedContentInfo = envelopedData.value[2];

      // 3. Extract Encrypted Session Key
      // Assuming single recipient KeyTransRecipientInfo for simplicity
      // KeyTransRecipientInfo: Version, RecipientIdentifier, KeyEncryptionAlgorithmIdentifier, EncryptedKey
      const recipientInfo = recipientInfos.value[0];
      // EncryptedKey is the 4th element (index 3) - OCTET STRING
      const encryptedSessionKeyOctet = recipientInfo.value[3]; 
      const encryptedSessionKey = forge.util.bytesToHex(encryptedSessionKeyOctet.value);

      // 4. Decrypt Session Key using SM2 Private Key
      // SM2 Decrypt returns hex string
      const sessionKey = sm2.doDecrypt(encryptedSessionKey, envelopeDecryptPrivateKey.value, 1); // Default C1C3C2
      if (!sessionKey) {
        throw new Error('Failed to decrypt session key. Check private key.');
      }

      // 5. Extract IV and Encrypted Data
      // EncryptedContentInfo: ContentType, ContentEncryptionAlgorithmIdentifier, EncryptedContent
      // ContentEncryptionAlgorithmIdentifier: Algorithm (OID), Parameters (IV)
      const contentEncryptionAlgorithm = encryptedContentInfo.value[1];
      const ivOctet = contentEncryptionAlgorithm.value[1];
      const iv = forge.util.bytesToHex(ivOctet.value);

      // EncryptedContent is [0] IMPLICIT OCTET STRING
      // In forge, when implicit tagging is parsed without schema, it might appear as Context(0)
      // value[2] is the encrypted content
      const encryptedContentContext = encryptedContentInfo.value[2];
      const encryptedData = forge.util.bytesToHex(encryptedContentContext.value);

      // 6. Decrypt Data using SM4-CBC
      const decryptedData = sm4.decrypt(encryptedData, sessionKey, { mode: 'cbc', iv });

      envelopeDecryptResult.value = {
        sessionKey,
        decryptedData
      };
    } catch (e) {
      console.error(e);
      alert(`Envelope decryption failed: ${(e as Error).message}`);
    }
  }

  return {
    operationMode,
    envelopePublicKey,
    envelopeData,
    envelopeResult,
    generateEnvelope,
    envelopeDecryptPrivateKey,
    envelopeDecryptInput,
    envelopeDecryptResult,
    openEnvelope,
  };
}

