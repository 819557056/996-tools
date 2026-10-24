import { ref } from 'vue';
import { materialToHex, type InputEncoding } from '@/utils/crypto/material-format';
import { sm2 } from 'sm-crypto';
import { convertRawCipherToAsn1, convertAsn1ToRawCipher, Sm2Asn1Error } from '@/utils/crypto/asn1/sm2';

export default function useSm2Encrypt() {
  // 密钥管理
  const publicKey = ref('');
  const privateKey = ref('');

  // 生成密钥对
  function generateKeyPair() {
    const keypair = sm2.generateKeyPairHex();
    publicKey.value = keypair.publicKey;
    privateKey.value = keypair.privateKey;
  }

  // 加密/解密
  const cipherMode = ref<0 | 1>(1); // 1: C1C3C2 (新标准), 0: C1C2C3 (旧标准)
  const outputFormat = ref<'hex' | 'asn1'>('hex');

  const encryptInput = ref('');
  const encryptOutput = ref('');
  const encryptError = ref('');

  const decryptInput = ref('');
  const decryptEncoding = ref<InputEncoding>('auto');
  const decryptOutput = ref('');
  const decryptError = ref('');

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

  // 执行加密
  function doEncrypt() {
    encryptError.value = '';
    try {
      if (!publicKey.value.trim()) {
        encryptError.value = '请先生成或输入公钥';
        return;
      }
      if (!encryptInput.value) {
        encryptError.value = '请输入要加密的内容';
        return;
      }

      const rawHex = sm2.doEncrypt(encryptInput.value, publicKey.value.trim(), cipherMode.value);

      if (outputFormat.value === 'asn1') {
        // sm-crypto omits the uncompressed-point marker; the DER adapter requires it.
        const rawBytes = hexToUint8Array(`04${rawHex}`);
        const asn1Der = convertRawCipherToAsn1(rawBytes, cipherMode.value === 1 ? 'C1C3C2' : 'C1C2C3');
        encryptOutput.value = uint8ArrayToHex(asn1Der);
      } else {
        encryptOutput.value = rawHex;
      }
    }
    catch (error: unknown) {
      if (error instanceof Sm2Asn1Error) {
         encryptError.value = `ASN.1 编码错误: ${error.message}`;
      } else {
         encryptError.value = `加密失败: ${(error as Error).message}`;
      }
    }
  }

  // 执行解密
  function doDecrypt() {
    decryptError.value = '';
    try {
      if (!privateKey.value.trim()) {
        decryptError.value = '请先生成或输入私钥';
        return;
      }
      if (!decryptInput.value.trim()) {
        decryptError.value = '请输入要解密的密文';
        return;
      }

      let inputHex = materialToHex(decryptInput.value, decryptEncoding.value);

      // 尝试自动检测是否为 ASN.1 格式（严格校验）
      try {
        const inputBytes = hexToUint8Array(inputHex);
        // ASN.1 SEQUENCE tag is 0x30
        if (inputBytes.length > 0 && inputBytes[0] === 0x30) {
          // 尝试完整解码并校验 schema
          const rawBytes = convertAsn1ToRawCipher(inputBytes, cipherMode.value === 1 ? 'C1C3C2' : 'C1C2C3');
          inputHex = uint8ArrayToHex(rawBytes.subarray(1));
        }
      } catch (e) {
        // 如果 ASN.1 解码失败，继续作为普通 hex 处理
        // 不抛出错误，让 sm2.doDecrypt 处理
      }

      decryptOutput.value = sm2.doDecrypt(inputHex, privateKey.value.trim(), cipherMode.value);
    }
    catch (error: unknown) {
      if (error instanceof Sm2Asn1Error) {
         decryptError.value = `ASN.1 解码错误: ${error.message}`;
      } else {
         decryptError.value = `解密失败: ${(error as Error).message}`;
      }
    }
  }

  // 复制加密结果到解密输入
  function copyToDecrypt() {
    if (encryptOutput.value && !encryptError.value) {
      decryptInput.value = encryptOutput.value;
      decryptEncoding.value = 'hex';
    }
  }

  return {
    publicKey,
    privateKey,
    generateKeyPair,
    cipherMode,
    outputFormat,
    encryptInput,
    encryptOutput,
    encryptError,
    decryptInput,
    decryptEncoding,
    decryptOutput,
    decryptError,
    doEncrypt,
    doDecrypt,
    copyToDecrypt,
  };
}
