<template>
  <div class="certificate-parser">
    <div class="iframe-container">
      <iframe 
        src="/asn1-decoder.html"
        class="asn1-decoder-iframe"
        title="ASN.1 JavaScript Decoder"
      ></iframe>
    </div>
    
    <div class="info-footer">
      <p>
        使用 <a href="https://lapo.it/asn1js/" target="_blank" rel="noopener noreferrer">ASN.1 JavaScript decoder</a> 
        by Lapo Luchini - 支持解析 X.509 证书、PKCS#7/CMS、PKCS#8/PKCS#1 密钥等 ASN.1 DER/BER 结构（离线版本）
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 使用本地的 ASN.1 JavaScript decoder
// 文件位于 public/asn1-decoder.html
</script>

<style scoped>
.certificate-parser {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  width: 100%;
  /* 覆盖父容器的 flex: 0 1 600px 限制 */
  flex: 1 1 100% !important;
  max-width: none !important;
  position: relative;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}

.iframe-container {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  border-radius: 0;
  overflow: hidden;
  background-color: #ffffff;
  position: relative;
}

.asn1-decoder-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.info-footer {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  margin: 0;
}

.info-footer p {
  margin: 0;
  font-size: 0.813rem;
  color: #6b7280;
  text-align: center;
  line-height: 1.4;
}

.info-footer a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.info-footer a:hover {
  text-decoration: underline;
  color: #2563eb;
}
</style>

<!-- 全局样式：让父容器也能充满宽度 -->
<style>
/* 让 certificate-parser 工具的父容器充满整个宽度 */
.tool-content:has(.certificate-parser) {
  max-width: 100% !important;
  width: 100% !important;
}

.tool-content:has(.certificate-parser) > * {
  flex: 1 1 100% !important;
  max-width: none !important;
}
</style>

