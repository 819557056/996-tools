import { ref } from 'vue';
import { materialToHex, type InputEncoding } from '@/utils/crypto/material-format';
import { sm2 } from 'sm-crypto';

export default function useSm2Tool() {
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
  const operationMode = ref<'encrypt' | 'decrypt' | 'sign' | 'verify'>('encrypt');
  const cipherMode = ref<0 | 1>(1); // 1: C1C3C2 (新标准), 0: C1C2C3 (旧标准)

  const encryptInput = ref('Hello, SM2!');
  const encryptOutput = ref('');

  const decryptInput = ref('');
  const decryptEncoding = ref<InputEncoding>('auto');
  const decryptOutput = ref('');

  const signInput = ref('Message to sign');
  const signOutput = ref('');

  const verifyMessage = ref('');
  const verifySignature = ref('');
  const verifyEncoding = ref<InputEncoding>('auto');
  const verifyResult = ref<boolean | null>(null);

  // 执行加密
  function doEncrypt() {
    try {
      if (!publicKey.value.trim()) {
        encryptOutput.value = '错误: 请先生成或输入公钥';
        return;
      }
      if (!encryptInput.value.trim()) {
        encryptOutput.value = '错误: 请输入要加密的内容';
        return;
      }
      encryptOutput.value = sm2.doEncrypt(encryptInput.value.trim(), publicKey.value.trim(), cipherMode.value);
    }
    catch (error: unknown) {
      encryptOutput.value = `错误: ${(error as Error).message}`;
    }
  }

  // 执行解密
  function doDecrypt() {
    try {
      if (!privateKey.value.trim()) {
        decryptOutput.value = '错误: 请先生成或输入私钥';
        return;
      }
      if (!decryptInput.value.trim()) {
        decryptOutput.value = '错误: 请输入要解密的密文';
        return;
      }
      decryptOutput.value = sm2.doDecrypt(materialToHex(decryptInput.value, decryptEncoding.value), privateKey.value.trim(), cipherMode.value);
    }
    catch (error: unknown) {
      decryptOutput.value = `错误: ${(error as Error).message}`;
    }
  }

  // 执行签名
  function doSign() {
    try {
      if (!privateKey.value.trim()) {
        signOutput.value = '错误: 请先生成或输入私钥';
        return;
      }
      if (!signInput.value.trim()) {
        signOutput.value = '错误: 请输入待签名的消息';
        return;
      }
      // 对输入进行 trim 处理，去除多余空格和换行
      signOutput.value = sm2.doSignature(signInput.value.trim(), privateKey.value.trim());
    }
    catch (error: unknown) {
      signOutput.value = `错误: ${(error as Error).message}`;
    }
  }

  // 执行验签
  function doVerify() {
    try {
      if (!publicKey.value.trim()) {
        verifyResult.value = null;
        return;
      }
      if (!verifyMessage.value.trim()) {
        verifyResult.value = null;
        return;
      }
      if (!verifySignature.value.trim()) {
        verifyResult.value = null;
        return;
      }
      // 对所有输入进行 trim 处理
      verifyResult.value = sm2.doVerifySignature(
        verifyMessage.value.trim(),
        materialToHex(verifySignature.value, verifyEncoding.value),
        publicKey.value.trim(),
      );
    }
    catch (error: unknown) {
      console.error('验签错误:', error);
      verifyResult.value = false;
    }
  }

  // 复制加密结果到解密输入
  function copyToDecrypt() {
    decryptInput.value = encryptOutput.value;
    decryptEncoding.value = 'hex';
    operationMode.value = 'decrypt';
  }

  // 复制签名到验签
  function copyToVerify() {
    verifyMessage.value = signInput.value;
    verifySignature.value = signOutput.value;
    verifyEncoding.value = 'hex';
    operationMode.value = 'verify';
  }

  const modeOptions = [
    { label: '加密', value: 'encrypt' },
    { label: '解密', value: 'decrypt' },
    { label: '签名', value: 'sign' },
    { label: '验签', value: 'verify' },
  ];

  const cipherModeOptions = [
    { label: 'C1C3C2 (新标准/常用)', value: 1 },
    { label: 'C1C2C3 (旧标准)', value: 0 },
  ];

  return {
    publicKey,
    privateKey,
    generateKeyPair,
    operationMode,
    cipherMode,
    encryptInput,
    encryptOutput,
    decryptInput,
    decryptEncoding,
    decryptOutput,
    signInput,
    signOutput,
    verifyMessage,
    verifySignature,
    verifyEncoding,
    verifyResult,
    doEncrypt,
    doDecrypt,
    doSign,
    doVerify,
    copyToDecrypt,
    copyToVerify,
    modeOptions,
    cipherModeOptions,
  };
}