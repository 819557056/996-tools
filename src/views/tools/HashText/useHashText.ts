// @ts-ignore
import { sm3 } from 'sm-crypto';
import { ref } from 'vue';
import { MD5, SHA1, SHA224, SHA256, SHA384, SHA512, SHA3, RIPEMD160, enc, lib } from 'crypto-js';
import { convertHexToBin } from './hash-text.service';
import { useToast } from '@/composables/useToast';

export const algos = {
  SM3: (text: string) => sm3(text),
  MD5,
  SHA1,
  SHA256,
  SHA224,
  SHA512,
  SHA384,
  SHA3,
  RIPEMD160,
} as const;

export type AlgoNames = keyof typeof algos;
export type Encoding = 'Hex' | 'Bin' | 'Base64' | 'Base64url';

export function useHashText() {
  const input = ref('');
  const encoding = ref<Encoding>('Hex');
  const { toast } = useToast();

  const algoNames = Object.keys(algos) as AlgoNames[];

  const formatWithEncoding = (words: lib.WordArray | string, encodingType: Encoding) => {
    // Handle SM3 string output first
    if (typeof words === 'string') {
       if (encodingType === 'Bin') {
         return convertHexToBin(words);
       }
       if (encodingType === 'Hex') {
         return words;
       }
       // Convert hex string to Base64/Base64url
       const hexStr = words;
       const bytes = hexStr.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || [];
       const binaryStr = String.fromCharCode(...bytes);
       const base64 = btoa(binaryStr);
       
       if (encodingType === 'Base64url') {
         return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
       }
       return base64;
    }

    if (encodingType === 'Bin') {
        return convertHexToBin(words.toString(enc.Hex));
    }
    if (encodingType === 'Base64url') {
        const base64 = words.toString(enc.Base64);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    // crypto-js enc types: Hex, Base64, Latin1, Utf8, etc.
    // We only support Hex and Base64 directly via crypto-js enc here based on the Encoding type
    if (encodingType === 'Hex') return words.toString(enc.Hex);
    if (encodingType === 'Base64') return words.toString(enc.Base64);
    
    return words.toString(enc.Hex); // fallback
  };

  const getHash = (algo: AlgoNames) => {
    if (!input.value) return '';
    try {
        // @ts-ignore
        const result = algos[algo](input.value);
        return formatWithEncoding(result, encoding.value);
    } catch (e) {
        console.error(e);
        return 'Error';
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '已复制',
        description: '哈希值已复制到剪贴板',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板',
        variant: 'destructive',
      });
    }
  };

  return {
    input,
    encoding,
    algoNames,
    getHash,
    copyToClipboard
  };
}
