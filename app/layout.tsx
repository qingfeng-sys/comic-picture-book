import { Viewport } from 'next'
import AuthProvider from '@/components/Providers/AuthProvider'
import { TaskProvider } from '@/components/Providers/TaskProvider'
import ClientSideSetup from '@/components/Layout/ClientSideSetup'
import './globals.css'

export const metadata = {
  title: '漫画绘本创作工坊',
  description: 'AI驱动的漫画绘本创作工具',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <AuthProvider>
          <TaskProvider>
            <ClientSideSetup />
            {children}
          </TaskProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

