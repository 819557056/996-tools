import { ref } from 'vue';
import { decodeMaterial, materialToHex, type InputEncoding } from '@/utils/crypto/material-format';
import { sm2 } from 'sm-crypto';
import { encodeSm2SignatureDer, decodeSm2SignatureDer, Sm2Asn1Error } from '@/utils/crypto/asn1/sm2';
import { generateP7SignedData, verifyP7SignedData, isP7SignedData, P7Error } from '@/utils/crypto/asn1/signed-data';

export default function useSm2Sign() {
  // 密钥管理
  const publicKey = ref('');
  const privateKey = ref('');

  // 生成密钥对
  function generateKeyPair() {
    const keypair = sm2.generateKeyPairHex();
    publicKey.value = keypair.publicKey;
    privateKey.value = keypair.privateKey;
  }

  const signatureFormat = ref<'hex' | 'asn1' | 'p7'>('hex');

  // P7 相关配置
  const p7Mode = ref<'attached' | 'detached'>('attached');
  const p7Certificate = ref('');
  const p7IncludeSigningTime = ref(true);
  const signInput = ref('');
  const signOutput = ref('');
  const signResultKind = ref<'signature' | 'pkcs7'>('signature');
  const signError = ref('');

  const verifyMessage = ref('');
  const verifySignature = ref('');
  const verifyEncoding = ref<InputEncoding>('auto');
  const verifyResult = ref<boolean | null>(null);
  const verifyError = ref('');
  const verifyDetectedFormat = ref('');
  const verifySigningTime = ref<Date | null>(null);

  // 辅助函数
  function hexToUint8Array(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length % 2 !== 0) throw new Error('Hex string length must be even');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
    }
    return bytes;
  }

  function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 执行签名
  function doSign() {
    signError.value = '';
    try {
      if (!privateKey.value.trim()) {
        signError.value = '请先生成或输入私钥';
        return;
      }
      if (!signInput.value) {
        signError.value = '请输入待签名的消息';
        return;
      }

      if (signatureFormat.value === 'p7') {
        // P7 SignedData 格式
        const p7Der = generateP7SignedData({
          message: signInput.value,
          privateKey: privateKey.value.trim(),
          certificate: p7Certificate.value.trim() || undefined,
          mode: p7Mode.value,
          includeSigningTime: p7IncludeSigningTime.value
        });

        signOutput.value = uint8ArrayToHex(p7Der);
      } else {
        // P1 格式（原有逻辑）
        const rawSig = sm2.doSignature(signInput.value, privateKey.value.trim());

        if (signatureFormat.value === 'asn1') {
          // sm-crypto 签名结果是 r||s (128 hex chars = 64 bytes)
          if (rawSig.length !== 128) {
            signError.value = `签名格式错误: 期望 128 个 hex 字符，实际 ${rawSig.length} 个`;
            return;
          }
          const r = hexToUint8Array(rawSig.slice(0, 64));
          const s = hexToUint8Array(rawSig.slice(64, 128));
          const asn1Der = encodeSm2SignatureDer({ r, s });
          signOutput.value = uint8ArrayToHex(asn1Der);
        } else {
          signOutput.value = rawSig;
        }
      }
      signResultKind.value = signatureFormat.value === 'p7' ? 'pkcs7' : 'signature';
    }
    catch (error: unknown) {
      if (error instanceof P7Error) {
        signError.value = `P7 生成错误: ${error.message}`;
      } else if (error instanceof Sm2Asn1Error) {
        signError.value = `ASN.1 编码错误: ${error.message}`;
      } else {
        signError.value = `签名失败: ${(error as Error).message}`;
      }
    }
  }

  // 执行验签
  function doVerify() {
    verifyError.value = '';
    verifyDetectedFormat.value = '';
    verifySigningTime.value = null;

    try {
      if (!verifySignature.value.trim()) {
        verifyError.value = '请输入签名值';
        verifyResult.value = null;
        return;
      }

      const sigInput = materialToHex(verifySignature.value, verifyEncoding.value);

      const p7Bytes = decodeMaterial(sigInput, 'hex');
      if (isP7SignedData(p7Bytes) || verifySignature.value.trim().startsWith('-----BEGIN PKCS7-----')) {
        verifyDetectedFormat.value = 'P7 SignedData';
        const result = verifyP7SignedData({ p7Der: p7Bytes,
          message: verifyMessage.value || undefined, publicKey: publicKey.value.trim() || undefined });
        verifyResult.value = result.valid;
        verifyError.value = result.error || '';
        verifySigningTime.value = result.signingTime ?? null;
        return;
      }

      // P1 格式验证（原有逻辑）
      if (!publicKey.value.trim()) {
        verifyError.value = '请先输入公钥';
        verifyResult.value = null;
        return;
      }
      if (!verifyMessage.value) {
        verifyError.value = '请输入待验签消息';
        verifyResult.value = null;
        return;
      }

      let sigHex = sigInput;

      // 尝试自动检测是否为 ASN.1 P1 格式（严格校验）
      try {
        const sigBytes = hexToUint8Array(sigHex);
        // ASN.1 SEQUENCE tag is 0x30
        if (sigBytes.length > 0 && sigBytes[0] === 0x30) {
          // 尝试完整解码并校验 schema
          const { r, s } = decodeSm2SignatureDer(sigBytes);
          sigHex = uint8ArrayToHex(r) + uint8ArrayToHex(s);
          verifyDetectedFormat.value = 'ASN.1 DER (P1)';
        } else {
          verifyDetectedFormat.value = 'Hex (原始格式)';
        }
      } catch (e) {
        // 如果 ASN.1 解码失败，继续作为普通 hex 处理
        verifyDetectedFormat.value = 'Hex (原始格式)';
      }

      verifyResult.value = sm2.doVerifySignature(
        verifyMessage.value,
        sigHex,
        publicKey.value.trim(),
      );
    }
    catch (error: unknown) {

      if (error instanceof P7Error) {
        verifyError.value = `P7 验证错误: ${error.message}`;
      } else if (error instanceof Sm2Asn1Error) {
        verifyError.value = `ASN.1 解码错误: ${error.message}`;
      } else {
        verifyError.value = '验签失败：签名格式或密钥可能不正确';
      }
      verifyResult.value = false;
    }
  }

  // 复制签名到验签
  function copyToVerify() {
    if (signOutput.value && !signError.value) {
      verifyMessage.value = signInput.value;
      verifySignature.value = signOutput.value;
      verifyEncoding.value = 'hex';
    }
  }

  return {
    publicKey,
    privateKey,
    generateKeyPair,
    signatureFormat,
    signInput,
    signOutput,
    signResultKind,
    signError,
    verifyMessage,
    verifySignature,
    verifyEncoding,
    verifyResult,
    verifyError,
    verifyDetectedFormat,
    verifySigningTime,
    doSign,
    doVerify,
    copyToVerify,
    // P7 相关
    p7Mode,
    p7Certificate,
    p7IncludeSigningTime,
  };
}
