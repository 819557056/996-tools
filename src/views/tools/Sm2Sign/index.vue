<script setup lang="ts">
import EncodedOutput from "@/components/crypto/EncodedOutput.vue";
import EncodedInputFormat from "@/components/crypto/EncodedInputFormat.vue";
import { ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-vue-next';
import useSm2Sign from './useSm2Sign';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseTextarea from '@/components/ui/BaseTextarea.vue';
import BaseLabel from '@/components/ui/BaseLabel.vue';
import { useToast } from '@/composables/useToast';

const {
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
  doSign,
  doVerify,
  copyToVerify,
  // P7 related variables
  p7Mode,
  p7Certificate,
  p7IncludeSigningTime,
  verifyDetectedFormat,
  verifySigningTime,
} = useSm2Sign();

const toast = useToast();

const handleCopyToVerify = () => {
    copyToVerify();
    // Also trigger verify if keys are present? No, let user click verify.
    toast.success('已复制到验签输入框');
};
</script>

<template>
  <div class="h-full flex flex-col gap-6">
    <BaseCard class="p-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 class="text-2xl font-bold">SM2 签名验签</h1>
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
        
        <!-- Left: Sign -->
        <div class="space-y-6">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            签名区
          </h2>
          
          <div class="space-y-2">
            <BaseLabel>待签名内容</BaseLabel>
            <BaseTextarea
              v-model="signInput"
              placeholder="请输入需要签名的内容..."
              :rows="5"
            />
          </div>

          <div class="space-y-2">
            <BaseLabel>签名格式</BaseLabel>
            <div class="flex flex-wrap gap-4 p-2 bg-muted/50 rounded-md">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="signatureFormat" value="hex" class="accent-primary" />
                <span class="text-sm">Hex (原始格式)</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="signatureFormat" value="asn1" class="accent-primary" />
                <span class="text-sm">ASN.1 DER (P1)</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="radio" v-model="signatureFormat" value="p7" class="accent-primary" />
                <span class="text-sm">P7 SignedData</span>
              </label>
            </div>
          </div>

          <!-- P7 Advanced Configuration -->
          <div v-if="signatureFormat === 'p7'" class="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
            <h3 class="font-medium text-sm">P7 高级配置</h3>
            
            <!-- Mode -->
            <div class="space-y-2">
              <BaseLabel>模式</BaseLabel>
              <div class="flex gap-4">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" v-model="p7Mode" value="attached" class="accent-primary" />
                  <span class="text-sm">Attached (消息嵌入)</span>
                </label>
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" v-model="p7Mode" value="detached" class="accent-primary" />
                  <span class="text-sm">Detached (消息分离)</span>
                </label>
              </div>
            </div>

            <!-- Certificate -->
            <div class="space-y-2">
              <BaseLabel>证书 (可选)</BaseLabel>
              <BaseTextarea
                v-model="p7Certificate"
                placeholder="-----BEGIN CERTIFICATE-----..."
                class="font-mono text-sm"
                :rows="8"
              />
              <EncodedOutput v-if="p7Certificate" :value="p7Certificate" label="证书" kind="certificate" source-encoding="pem" collapsible />
            </div>

            <!-- Signing Time -->
            <div class="flex items-center space-x-2">
              <input type="checkbox" v-model="p7IncludeSigningTime" id="p7IncludeTime" class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
              <label for="p7IncludeTime" class="text-sm font-medium leading-none cursor-pointer">包含签名时间</label>
            </div>

          </div>

          <BaseButton class="w-full" @click="doSign">生成签名</BaseButton>

          <div class="space-y-2">
            <EncodedOutput :value="signOutput" label="签名结果" :kind="signResultKind" source-encoding="auto" :rows="6">
              <template #actions><BaseButton size="sm" variant="outline" @click="handleCopyToVerify"><ArrowRight class="w-4 h-4 mr-1" />去验签</BaseButton></template>
            </EncodedOutput>
            <div v-if="signError" class="text-sm text-red-600 break-all">
              {{ signError }}
            </div>
          </div>
        </div>

        <!-- Right: Verify -->
        <div class="space-y-6 lg:border-l lg:pl-8 border-border">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            验签区
          </h2>

          <div class="space-y-2">
            <BaseLabel>原始内容 <span class="text-xs text-muted-foreground font-normal">(P7 Detached 模式必填)</span></BaseLabel>
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

          <BaseButton class="w-full" variant="outline" @click="doVerify">验证签名</BaseButton>

          <div class="space-y-2">
            <BaseLabel>验证结果</BaseLabel>
            <div v-if="verifyError" class="text-sm text-red-600 break-all mb-2">
              {{ verifyError }}
            </div>
            <div
              v-if="verifyResult !== null"
              class="flex flex-col items-center justify-center p-6 rounded-lg border text-lg font-medium transition-colors duration-300"
              :class="verifyResult ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'"
            >
              <component :is="verifyResult ? ShieldCheck : ShieldAlert" class="w-8 h-8 mb-2" />
              <span>{{ verifyResult ? '验证通过 (Signature Valid)' : '验证失败 (Signature Invalid)' }}</span>
              
              <!-- Additional Info -->
              <div class="mt-4 text-sm text-center space-y-1 w-full border-t border-current/20 pt-2" v-if="verifyDetectedFormat || verifySigningTime">
                  <div v-if="verifyDetectedFormat" class="flex justify-between gap-4">
                     <span class="opacity-80">格式:</span> 
                     <span class="font-semibold">{{ verifyDetectedFormat }}</span>
                  </div>
                  <div v-if="verifySigningTime" class="flex justify-between gap-4">
                     <span class="opacity-80">签名时间:</span> 
                     <span class="font-semibold">{{ verifySigningTime.toLocaleString() }}</span>
                  </div>
               </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center h-32 rounded-lg border bg-muted/50 text-muted-foreground">
              <span class="text-sm">点击"验证签名"查看结果</span>
            </div>
          </div>
        </div>

      </div>
    </BaseCard>
  </div>
</template>
