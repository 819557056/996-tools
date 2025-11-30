import { createRouter, createWebHistory } from 'vue-router'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DashboardLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView,
        },
        {
          path: '/tools',
          redirect: '/',
        },
        {
          path: '/tools/uuid-generator',
          name: 'uuid-generator',
          component: () => import('../views/tools/UuidGenerator/index.vue'),
        },
        {
          path: '/tools/qrcode-generator',
          name: 'qrcode-generator',
          component: () => import('../views/tools/QrcodeGeneratorView.vue'),
        },
        {
          path: '/tools/password-generator',
          name: 'password-generator',
          component: () => import('../views/tools/PasswordGeneratorView.vue'),
        },
        {
          path: '/tools/nanoid-generator',
          name: 'nanoid-generator',
          component: () => import('../views/tools/NanoidGeneratorView.vue'),
        },
        {
          path: '/tools/ulid-generator',
          name: 'ulid-generator',
          component: () => import('../views/tools/UlidGeneratorView.vue'),
        },
        {
          path: '/tools/hash-text',
          name: 'hash-text',
          component: () => import('../views/tools/HashText/index.vue'),
        },
        {
          path: '/tools/json-formatter',
          name: 'json-formatter',
          component: () => import('../views/tools/JsonFormatter/index.vue'),
        },
        {
          path: '/tools/transcoding',
          name: 'transcoding',
          component: () => import('../views/tools/Transcoding/index.vue'),
        },
        {
          path: '/tools/certificate-encoding-converter',
          name: 'certificate-encoding-converter',
          component: () => import('../views/tools/CertificateEncodingConverter/index.vue'),
        },
        {
          path: '/tools/certificate-parser',
          name: 'certificate-parser',
          component: () => import('../views/tools/CertificateParser/index.vue'),
        },
        {
          path: '/tools/binary-viewer',
          name: 'binary-viewer',
          component: () => import('../views/tools/BinaryViewer/index.vue'),
        },
        {
          path: '/tools/certificate-viewer',
          name: 'certificate-viewer',
          component: () => import('../views/tools/CertificateViewer/index.vue'),
        },
        {
          path: '/tools/sm2-tool',
          name: 'sm2-tool',
          component: () => import('../views/tools/Sm2Tool/index.vue'),
        },
        {
          path: '/tools/sm4-tool',
          name: 'sm4-tool',
          component: () => import('../views/tools/Sm4Tool/index.vue'),
        },
        {
          path: '/tools/digital-envelope',
          name: 'digital-envelope',
          component: () => import('../views/tools/DigitalEnvelope/index.vue'),
        },
      ],
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

export default router
