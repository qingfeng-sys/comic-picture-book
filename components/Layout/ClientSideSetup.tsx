'use client'

import { useEffect } from 'react'

export default function ClientSideSetup() {
  useEffect(() => {
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

  return null
}

