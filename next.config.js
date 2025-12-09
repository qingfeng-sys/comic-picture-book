/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SPA 模式配置：禁用服务端渲染，所有页面都在客户端渲染
  // 注意：API 路由仍然在服务端运行（用于安全处理 API 密钥）
  
  // 允许开发环境的跨域请求（用于局域网访问）
  // 注意：allowedDevOrigins 不支持 CIDR 格式或通配符，只支持具体IP地址或域名
  // 如果从多个设备/IP访问，需要添加所有可能的IP地址
  // 当前警告来自 192.168.1.199，已添加到此配置中
  allowedDevOrigins: process.env.NODE_ENV === 'development' 
    ? [
        'localhost',
        '127.0.0.1',
        '192.168.1.199',  // 当前访问的IP地址（从警告信息中获取）
        // 如需允许其他局域网IP，请在此添加，例如：
        // '192.168.1.100',
        // '192.168.1.101',
      ]
    : [],  // 生产环境：不允许跨域（或根据需要配置特定域名）
  
  // 网络访问通过以下方式实现：
  // 1. 服务器监听 0.0.0.0 (package.json 中已配置 -H 0.0.0.0)
  // 2. Windows 防火墙规则（运行修复脚本会自动设置）
  // 3. API 路由的 CORS 头（已在 route.ts 中配置）
  // 4. allowedDevOrigins 配置（允许局域网跨域访问）
  
  // 确保环境变量被正确加载
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    QINIU_API_KEY: process.env.QINIU_API_KEY,
  },
}

module.exports = nextConfig

