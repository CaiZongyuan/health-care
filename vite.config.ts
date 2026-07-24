import { defineConfig, type Plugin } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// cloudflare:workers 由 workerd 运行时/cloudflare 插件在 SSR(worker) 环境提供；
// 客户端环境没有它——服务端 server-fn 被 TanStack stub 后可能残留死引用，桩成空模块避免运行时 import 错。
function stubCfWorkersForClient(): Plugin {
  return {
    name: 'stub-cf-workers-client',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'cloudflare:workers') {
        const env = (this as { environment?: { name?: string } }).environment
        // 仅在客户端环境桩成空模块；SSR(worker) 仍由 cloudflare 插件提供真实模块
        if (env?.name === 'client') return '\0cf-workers-stub'
      }
      return null
    },
    load(id) {
      if (id === '\0cf-workers-stub') {
        return 'export const env = {};\nexport default {};'
      }
      return null
    },
  }
}

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    stubCfWorkersForClient(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})
