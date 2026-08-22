import type { Metadata, Viewport } from 'next'
import { getDict } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: 'OneFound',
  description: '一人社長のための AI カンパニー',
}
export const viewport: Viewport = { themeColor: '#000000' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict()
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}
