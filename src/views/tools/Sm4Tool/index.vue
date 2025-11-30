<script setup lang="ts">
import { Copy } from 'lucide-vue-next';
import useSm4Tool from './useSm4Tool';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseLabel from '@/components/ui/BaseLabel.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { useToast } from '@/composables/useToast';

const {
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
} = useSm4Tool();

const toast = useToast();

const copyToClipboard = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  } catch (err) {
    toast.error('复制失败');
  }
};
</script>

<template>
  <div class="h-full flex flex-col gap-6">
    <BaseCard class="p-6">
      <h1 class="text-2xl font-bold mb-4">SM4 加解密工具</h1>
      
      <!-- SM4 Encryption -->
      <div class="mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <h2 class="text-lg font-semibold mb-4">SM4 加密</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="space-y-2">
            <BaseLabel>密钥 (32位十六进制字符):</BaseLabel>
            <div class="flex gap-2">
              <BaseInput
                v-model="encryptKey"
                placeholder="0123456789abcdeffedcba9876543210"
                class="font-mono"
              />
              <BaseButton variant="outline" @click="generateRandomKey" class="whitespace-nowrap">
                生成随机密钥
              </BaseButton>
            </div>
          </div>
          
          <div class="space-y-2">
             <div class="flex gap-4">
               <div class="flex-1 space-y-2">
                 <BaseLabel>加密模式:</BaseLabel>
                 <BaseSelect v-model="encryptMode">
                   <option v-for="opt in modeOptions" :key="opt.value" :value="opt.value">
                     {{ opt.label }}
                   </option>
                 </BaseSelect>
               </div>
               
               <div v-if="encryptMode === 'cbc'" class="flex-1 space-y-2">
                 <BaseLabel>初始向量 IV:</BaseLabel>
                 <div class="flex gap-2">
                    <BaseInput
                      v-model="encryptIv"
                      placeholder="0123456789abcdeffedcba9876543210"
                      class="font-mono"
                    />
                    <BaseButton variant="outline" size="icon" @click="generateRandomIv" title="生成随机IV">
                       R
                    </BaseButton>
                 </div>
               </div>
             </div>
          </div>
        </div>

        <div class="space-y-2 mb-4">
          <BaseLabel>明文:</BaseLabel>
          <BaseTextarea
            v-model="encryptInput"
            placeholder="请输入要加密的文本"
            :rows="4"
          />
        </div>

        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <BaseLabel>密文 (Hex):</BaseLabel>
            <div class="flex gap-2">
              <BaseButton size="sm" variant="ghost" @click="copyToClipboard(encryptResult)">
                <Copy class="w-4 h-4 mr-1" /> 复制
              </BaseButton>
              <BaseButton size="sm" variant="outline" @click="copyToDecrypt">
                复制到解密
              </BaseButton>
            </div>
          </div>
          <BaseTextarea
            readonly
            :model-value="encryptResult"
            class="bg-muted font-mono text-sm"
            :rows="3"
          />
        </div>
      </div>

      <!-- SM4 Decryption -->
      <div class="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <h2 class="text-lg font-semibold mb-4">SM4 解密</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="space-y-2">
            <BaseLabel>密钥 (32位十六进制字符):</BaseLabel>
            <BaseInput
              v-model="decryptKey"
              placeholder="0123456789abcdeffedcba9876543210"
              class="font-mono"
            />
          </div>
          
          <div class="space-y-2">
             <div class="flex gap-4">
               <div class="flex-1 space-y-2">
                 <BaseLabel>解密模式:</BaseLabel>
                 <BaseSelect v-model="decryptMode">
                   <option v-for="opt in modeOptions" :key="opt.value" :value="opt.value">
                     {{ opt.label }}
                   </option>
                 </BaseSelect>
               </div>
               
               <div v-if="decryptMode === 'cbc'" class="flex-1 space-y-2">
                 <BaseLabel>初始向量 IV:</BaseLabel>
                 <BaseInput
                    v-model="decryptIv"
                    placeholder="0123456789abcdeffedcba9876543210"
                    class="font-mono"
                  />
               </div>
             </div>
          </div>
        </div>

        <div class="space-y-2 mb-4">
          <BaseLabel>密文 (Hex):</BaseLabel>
          <BaseTextarea
            v-model="decryptInput"
            placeholder="请输入要解密的密文"
            class="font-mono"
            :rows="4"
          />
        </div>

        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <BaseLabel>明文:</BaseLabel>
            <BaseButton size="sm" variant="ghost" @click="copyToClipboard(decryptResult)">
              <Copy class="w-4 h-4 mr-1" /> 复制
            </BaseButton>
          </div>
          <BaseTextarea
            readonly
            :model-value="decryptResult"
            class="bg-muted text-sm"
            :rows="3"
          />
        </div>
      </div>

      <!-- About -->
      <div class="mt-8 text-sm text-gray-500">
        <h3 class="font-bold mb-2 text-gray-700 dark:text-gray-300">关于 SM4</h3>
        <p>SM4 是中国国家密码管理局发布的分组密码算法标准，也被称为 SMS4。</p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>分组长度：128 位 (16 字节)</li>
          <li>密钥长度：128 位 (16 字节 = 32 个十六进制字符)</li>
          <li>支持模式：ECB、CBC 等</li>
          <li>ECB 模式：简单但不够安全，相同明文块产生相同密文块</li>
          <li>CBC 模式：更安全，需要初始向量 (IV)，相同明文块产生不同密文块</li>
        </ul>
      </div>

    </BaseCard>
  </div>
</template>

