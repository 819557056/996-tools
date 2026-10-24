<script setup lang="ts">
import EncodedOutput from "@/components/crypto/EncodedOutput.vue";
import EncodedInputFormat from "@/components/crypto/EncodedInputFormat.vue";
import { Copy } from 'lucide-vue-next';
import useSm2Tool from './useSm2Tool';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseLabel from '@/components/ui/BaseLabel.vue';
import { useToast } from '@/composables/useToast';

const {
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
} = useSm2Tool();

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
        <h1 class="text-2xl font-bold">SM2 国密算法工具</h1>
        <div class="flex items-center gap-4">
          <div class="flex bg-muted rounded-lg p-1">
            <button
              v-for="mode in ['encrypt', 'decrypt', 'sign', 'verify']"
              :key="mode"
              @click="operationMode = mode as any"
              :class="[
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                operationMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              {{ mode === 'encrypt' ? '加密' : 
                 mode === 'decrypt' ? '解密' : 
                 mode === 'sign' ? '签名' : '验签' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Common Key Management Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

      <!-- Encrypt Mode -->
      <div v-if="operationMode === 'encrypt'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>加密模式</BaseLabel>
            <div class="flex gap-4">
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
            <BaseLabel>待加密内容</BaseLabel>
            <BaseTextarea
              v-model="encryptInput"
              placeholder="请输入需要加密的内容..."
              :rows="5"
            />
          </div>
          <BaseButton class="w-full" @click="doEncrypt">执行加密</BaseButton>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <EncodedOutput :value="encryptOutput.startsWith('错误:') ? '' : encryptOutput" label="加密结果" kind="ciphertext" :rows="8">
              <template #actions><BaseButton size="sm" variant="outline" @click="copyToDecrypt">去解密</BaseButton></template>
            </EncodedOutput>
            <p v-if="encryptOutput.startsWith('错误:')" role="alert" class="text-red-600 text-sm">{{ encryptOutput }}</p>
          </div>
        </div>
      </div>

      <!-- Decrypt Mode -->
      <div v-if="operationMode === 'decrypt'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>加密模式</BaseLabel>
            <div class="flex gap-4">
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
            <BaseLabel>密文 (Hex / Base64 / BEGIN-END)</BaseLabel>
            <EncodedInputFormat v-model="decryptEncoding" />
            <BaseTextarea
              v-model="decryptInput"
              placeholder="请输入需要解密的密文..."
              class="font-mono text-sm"
              :rows="5"
            />
          </div>
          <BaseButton class="w-full" @click="doDecrypt">执行解密</BaseButton>
        </div>
        <div class="space-y-4">
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
              :rows="8"
            />
          </div>
        </div>
      </div>

      <!-- Sign Mode -->
      <div v-if="operationMode === 'sign'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>待签名内容</BaseLabel>
            <BaseTextarea
              v-model="signInput"
              placeholder="请输入需要签名的内容..."
              :rows="5"
            />
          </div>
          <BaseButton class="w-full" @click="doSign">生成签名</BaseButton>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <EncodedOutput :value="signOutput.startsWith('错误:') ? '' : signOutput" label="签名结果" kind="signature" :rows="8">
              <template #actions><BaseButton size="sm" variant="outline" @click="copyToVerify">去验签</BaseButton></template>
            </EncodedOutput>
            <p v-if="signOutput.startsWith('错误:')" role="alert" class="text-red-600 text-sm">{{ signOutput }}</p>
          </div>
        </div>
      </div>

      <!-- Verify Mode -->
      <div v-if="operationMode === 'verify'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>原始内容</BaseLabel>
            <BaseTextarea
              v-model="verifyMessage"
              placeholder="请输入原始内容..."
              :rows="3"
            />
          </div>
          <div class="space-y-2">
            <BaseLabel>签名值 (Hex / Base64 / BEGIN-END)</BaseLabel>
            <EncodedInputFormat v-model="verifyEncoding" />
            <BaseTextarea
              v-model="verifySignature"
              placeholder="请输入签名值..."
              class="font-mono text-sm"
              :rows="4"
            />
          </div>
          <BaseButton class="w-full" @click="doVerify">验证签名</BaseButton>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <BaseLabel>验证结果</BaseLabel>
            <div
              v-if="verifyResult !== null"
              class="flex items-center justify-center h-32 rounded-lg border text-lg font-medium"
              :class="verifyResult ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'"
            >
              {{ verifyResult ? '验证通过 (Signature Valid)' : '验证失败 (Signature Invalid)' }}
            </div>
            <div v-else class="flex items-center justify-center h-32 rounded-lg border bg-muted/50 text-muted-foreground">
              等待验证...
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
