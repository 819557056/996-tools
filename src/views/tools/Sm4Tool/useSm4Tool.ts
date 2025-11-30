import { ref, computed } from 'vue';
import { sm4 } from 'sm-crypto';

export default function useSm4Tool() {
  // 加密部分
  const encryptInput = ref('Hello, SM4!');
  const encryptKey = ref('0123456789abcdeffedcba9876543210'); // 128位密钥 (32个hex字符)
  const encryptMode = ref<'ecb' | 'cbc'>('ecb');
  const encryptIv = ref('0123456789abcdeffedcba9876543210'); // CBC模式需要IV
  
  const encryptResult = computed(() => {
    try {
      if (!encryptInput.value) return '';

      const options: any = {
        mode: encryptMode.value,
        padding: 'pkcs#7',
      };
      
      if (encryptMode.value === 'cbc')
        options.iv = encryptIv.value;

      return sm4.encrypt(encryptInput.value, encryptKey.value, options) as string;
    }
    catch (error: unknown) {
      return `错误: ${(error as Error).message}`;
    }
  });

  // 解密部分
  const decryptInput = ref('');
  const decryptKey = ref('0123456789abcdeffedcba9876543210');
  const decryptMode = ref<'ecb' | 'cbc'>('ecb');
  const decryptIv = ref('0123456789abcdeffedcba9876543210');
  
  const decryptResult = computed(() => {
    try {
      if (!decryptInput.value) return '';

      const options: any = {
        mode: decryptMode.value,
        padding: 'pkcs#7',
      };
      
      if (decryptMode.value === 'cbc')
        options.iv = decryptIv.value;

      return sm4.decrypt(decryptInput.value, decryptKey.value, options) as string;
    }
    catch (error: unknown) {
      return `错误: ${(error as Error).message}`;
    }
  });

  // 生成随机密钥
  function generateRandomKey() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const key = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    encryptKey.value = key;
    decryptKey.value = key;
  }

  // 生成随机IV
  function generateRandomIv() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const iv = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    encryptIv.value = iv;
    decryptIv.value = iv;
  }

  // 复制加密结果到解密输入
  function copyToDecrypt() {
    decryptInput.value = encryptResult.value;
    decryptKey.value = encryptKey.value;
    decryptMode.value = encryptMode.value;
    decryptIv.value = encryptIv.value;
  }

  const modeOptions = [
    { label: 'ECB (电子密码本模式)', value: 'ecb' },
    { label: 'CBC (密码分组链接模式)', value: 'cbc' },
  ];

  return {
    encryptInput,
    encryptKey,
    encryptMode,
    encryptIv,
    encryptResult,
    decryptInput,
    decryptKey,
    decryptMode,
    decryptIv,
    decryptResult,
    generateRandomKey,
    generateRandomIv,
    copyToDecrypt,
    modeOptions
  };
}

