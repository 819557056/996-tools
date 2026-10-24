<script setup lang="ts">
import EncodedOutput from "@/components/crypto/EncodedOutput.vue";
import EncodedInputFormat from "@/components/crypto/EncodedInputFormat.vue";
import { Copy, ArrowRight } from 'lucide-vue-next';
import useSm2Encrypt from './useSm2Encrypt';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseLabel from '@/components/ui/BaseLabel.vue';
import { useToast } from '@/composables/useToast';

const {
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
} = useSm2Encrypt();

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

const handleCopyToDecrypt = () => {
    copyToDecrypt();
    toast.success('已复制到解密输入框');
};
</script>

<template>
  <div class="h-full flex flex-col gap-6">
    <BaseCard class="p-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 class="text-2xl font-bold">SM2 加密解密</h1>
      </div>

      <!-- Key Management -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-6 border-b border-border">
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <BaseLabel>公钥 (Hex)</BaseLabel>
            <BaseButton size="sm" variant="outline" @click="generateKeyPair">生成密钥对</BaseButton>
          </div>
          <BaseTextarea
            v-model="publicKey"
            placeholder="请输入公钥..."
            class="font-mono text-sm"
            :rows="3"
          />
          <EncodedOutput v-if="publicKey" :value="publicKey" label="公钥" kind="sm2-public" collapsible :rows="3" />
        </div>
        <div class="space-y-3">
          <BaseLabel>私钥 (Hex)</BaseLabel>
          <BaseTextarea
            v-model="privateKey"
            placeholder="请输入私钥..."
            class="font-mono text-sm"
            :rows="3"
          />
          <EncodedOutput v-if="privateKey" :value="privateKey" label="私钥" kind="sm2-private" collapsible :rows="3" />
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <!-- Left: Encrypt -->
        <div class="space-y-6">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            加密区
          </h2>
          
          <div class="space-y-2">
            <BaseLabel>加密模式</BaseLabel>
            <div class="flex gap-4 p-2 bg-muted/50 rounded-md">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="cipherMode" :value="1" class="accent-primary" />
                <span class="text-sm">C1C3C2 (新标准)</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="cipherMode" :value="0" class="accent-primary" />
                <span class="text-sm">C1C2C3 (旧标准)</span>
              </label>
            </div>
          </div>

          <div class="space-y-2">
            <BaseLabel>输出格式</BaseLabel>
            <div class="flex gap-4 p-2 bg-muted/50 rounded-md">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="outputFormat" value="hex" class="accent-primary" />
                <span class="text-sm">Hex (原始格式)</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="outputFormat" value="asn1" class="accent-primary" />
                <span class="text-sm">ASN.1 DER</span>
              </label>
            </div>
          </div>

          <div class="space-y-2">
            <BaseLabel>待加密内容</BaseLabel>
            <BaseTextarea
              v-model="encryptInput"
              placeholder="请输入需要加密的内容..."
              :rows="5"
            />
          </div>

          <BaseButton class="w-full" @click="doEncrypt">执行加密</BaseButton>

          <div class="space-y-2">
            <EncodedOutput :value="encryptOutput" label="加密结果" kind="ciphertext" :rows="6">
              <template #actions><BaseButton size="sm" variant="outline" @click="handleCopyToDecrypt"><ArrowRight class="w-4 h-4 mr-1" />去解密</BaseButton></template>
            </EncodedOutput>
            <div v-if="encryptError" class="text-sm text-red-600 break-all">
              {{ encryptError }}
            </div>
          </div>
        </div>

        <!-- Right: Decrypt -->
        <div class="space-y-6 lg:border-l lg:pl-8 border-border">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            解密区
          </h2>

          <div class="space-y-2">
             <!-- Mode display or selection mirrored? Usually decryption needs to know mode too unless auto-detected. sm-crypto needs mode passed. -->
            <BaseLabel>解密模式</BaseLabel>
            <div class="flex gap-4 p-2 bg-muted/50 rounded-md">
               <!-- Sync with encryption mode for convenience, or allow separate selection? 
                    Usually for a tool, it's better to allow separate or sync. 
                    The useSm2Encrypt has a single `cipherMode` variable. 
                    So changing it on left changes it on right. This is fine for now as usually you encrypt then decrypt with same params. 
               -->
               <span class="text-sm text-muted-foreground">当前模式: {{ cipherMode === 1 ? 'C1C3C2' : 'C1C2C3' }} (与左侧同步)</span>
            </div>
          </div>

          <div class="space-y-2">
            <BaseLabel>密文 (Hex / Base64 / BEGIN-END)</BaseLabel>
            <EncodedInputFormat v-model="decryptEncoding" />
            <BaseTextarea
              v-model="decryptInput"
              placeholder="请输入需要解密的密文..."
              class="font-mono text-sm"
              :rows="5"
            />
          </div>

          <BaseButton class="w-full" variant="outline" @click="doDecrypt">执行解密</BaseButton>

          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <BaseLabel>解密结果</BaseLabel>
              <BaseButton size="sm" variant="ghost" @click="copyToClipboard(decryptOutput)">
                <Copy class="w-4 h-4 mr-1" /> 复制
              </BaseButton>
            </div>
            <BaseTextarea
              readonly
              :model-value="decryptOutput"
              class="bg-muted text-sm"
              :rows="6"
            />
            <div v-if="decryptError" class="text-sm text-red-600 break-all">
              {{ decryptError }}
            </div>
          </div>
        </div>

      </div>
    </BaseCard>
  </div>
</template>
