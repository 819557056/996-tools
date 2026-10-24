<script setup lang="ts">
import EncodedOutput from "@/components/crypto/EncodedOutput.vue";
import EncodedInputFormat from "@/components/crypto/EncodedInputFormat.vue";
import { Copy } from 'lucide-vue-next';
import useDigitalEnvelope from './useDigitalEnvelope';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseLabel from '@/components/ui/BaseLabel.vue';
import { useToast } from '@/composables/useToast';

const {
  operationMode,
  envelopePublicKey,
  envelopeData,
  envelopeResult,
  generateEnvelope,
  envelopeDecryptPrivateKey,
  envelopeDecryptInput,
  envelopeEncoding,
  envelopeDecryptResult,
  openEnvelope,
} = useDigitalEnvelope();

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
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 class="text-2xl font-bold">数字信封工具</h1>
        <div class="flex items-center gap-4">
          <div class="flex bg-muted rounded-lg p-1">
            <button
              v-for="mode in ['envelope', 'envelope-decrypt']"
              :key="mode"
              @click="operationMode = mode as any"
              :class="[
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                operationMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              {{ mode === 'envelope' ? '数字信封' : '解数字信封' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Digital Envelope Mode -->
      <div v-if="operationMode === 'envelope'" class="max-w-3xl mx-auto space-y-6">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <p class="font-semibold mb-1">数字信封流程：</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>生成随机 SM4 会话密钥 (Session Key)</li>
            <li>使用 SM4 会话密钥加密数据 (Data)</li>
            <li>使用接收方 SM2 公钥加密会话密钥</li>
            <li>打包输出加密后的会话密钥和加密后的数据</li>
          </ol>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>接收方公钥 (SM2 Public Key)</BaseLabel>
            <BaseInput
              v-model="envelopePublicKey"
              placeholder="请输入接收方 Hex 公钥..."
              class="font-mono"
            />
          </div>

          <div class="space-y-2">
            <BaseLabel>待加密数据</BaseLabel>
            <BaseTextarea
              v-model="envelopeData"
              placeholder="请输入需要加密的数据..."
              :rows="4"
            />
          </div>

          <BaseButton class="w-full" @click="generateEnvelope">生成数字信封</BaseButton>

          <div v-if="envelopeResult" class="mt-8 space-y-6 border-t pt-6">
            <div class="grid gap-4">
              <EncodedOutput :value="envelopeResult.asn1" label="GM/T 0010 数字信封" kind="envelope" :rows="6" />

              <EncodedOutput :value="envelopeResult.sessionKey" label="SM4 会话密钥" kind="sm4-key" :rows="2" />

              <EncodedOutput :value="envelopeResult.encryptedSessionKey" label="加密后的会话密钥" kind="ciphertext" :rows="2" />

              <EncodedOutput :value="envelopeResult.encryptedData" label="加密后的数据" kind="ciphertext" :rows="4" />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Digital Envelope Decrypt Mode -->
      <div v-if="operationMode === 'envelope-decrypt'" class="max-w-3xl mx-auto space-y-6">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <p class="font-semibold mb-1">解数字信封流程：</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>解析 GM/T 0010 ASN.1 结构</li>
            <li>提取加密的会话密钥，使用私钥 (SM2) 解密得到 SM4 会话密钥</li>
            <li>提取加密内容和 IV，使用 SM4 会话密钥解密得到原始内容</li>
          </ol>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>接收方私钥 (SM2 Private Key)</BaseLabel>
            <BaseInput
              v-model="envelopeDecryptPrivateKey"
              placeholder="请输入接收方 Hex 私钥..."
              class="font-mono"
            />
          </div>

          <div class="space-y-2">
            <BaseLabel>数字信封数据 (Hex / Base64 / BEGIN-END)</BaseLabel>
            <EncodedInputFormat v-model="envelopeEncoding" />
            <BaseTextarea
              v-model="envelopeDecryptInput"
              placeholder="请输入 GM/T 0010 数字信封..."
              class="font-mono text-sm"
              :rows="6"
            />
          </div>

          <BaseButton class="w-full" @click="openEnvelope">解开数字信封</BaseButton>

          <div v-if="envelopeDecryptResult" class="mt-8 space-y-6 border-t pt-6">
            <div class="grid gap-4">
              <EncodedOutput :value="envelopeDecryptResult.sessionKey" label="SM4 会话密钥" kind="sm4-key" :rows="2" />

              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <BaseLabel>解密出的原始内容 (Decrypted Data)</BaseLabel>
                  <BaseButton size="sm" variant="ghost" @click="copyToClipboard(envelopeDecryptResult.decryptedData)">
                    <Copy class="w-4 h-4" />
                  </BaseButton>
                </div>
                <BaseTextarea
                  readonly
                  :model-value="envelopeDecryptResult.decryptedData"
                  class="bg-muted font-mono text-sm"
                  :rows="4"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
/* Scoped styles if needed, but Tailwind classes cover most */
</style>

