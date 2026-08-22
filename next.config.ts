import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 日本語が既定。切り替えは Cookie で行う（→ lib/i18n）
  experimental: { typedRoutes: true },
}

export default nextConfig
