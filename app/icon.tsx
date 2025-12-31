import { ImageResponse } from 'next/og'

// 路由段配置
export const runtime = 'edge'

// 图像元数据
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// 图像生成
export default function Icon() {
  return new ImageResponse(
    (
      // 图像输出的 JSX 元素
      <div
        style={{
          background: 'linear-gradient(to top right, #2c3edb, #8b5cf6)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '8px',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>
    ),
    // ImageResponse 选项
    {
      ...size,
    }
  )
}

