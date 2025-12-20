'use client'

import { useEffect } from 'react'
import AuthProvider from '@/components/Providers/AuthProvider'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // SPA 模式：在客户端设置页面元数据
    document.title = '漫画绘本创作应用'
    
    // 设置viewport meta标签（移动端适配）
    let metaViewport = document.querySelector('meta[name="viewport"]')
    if (!metaViewport) {
      metaViewport = document.createElement('meta')
      metaViewport.setAttribute('name', 'viewport')
      document.head.appendChild(metaViewport)
    }
    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes')
    
    // 设置或更新 description meta 标签
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', 'AI驱动的漫画绘本创作工具')

    // 定期清理过期图片（每天执行一次）
    const cleanupExpiredImages = async () => {
      try {
        const response = await fetch('/api/comic/cleanup', { method: 'GET' })
        const result = await response.json()
        if (result.success) {
          console.log('图片清理完成:', result.data.message)
        }
      } catch (error) {
        console.warn('清理过期图片失败:', error)
      }
    }

    // 应用启动时执行一次清理
    cleanupExpiredImages()

    // 设置定时器，每24小时执行一次清理
    const cleanupInterval = setInterval(cleanupExpiredImages, 24 * 60 * 60 * 1000)

    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

