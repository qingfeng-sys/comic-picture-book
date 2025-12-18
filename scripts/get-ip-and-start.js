// 自动检测 IP 地址并启动 Next.js 开发服务器
const { execSync } = require('child_process');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部（即 127.0.0.1）和非 IPv4 地址
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        // 检查是否是局域网 IP
        if (ip.startsWith('192.168.') || 
            ip.startsWith('10.') || 
            ip.startsWith('172.')) {
          ips.push(ip);
        }
      }
    }
  }
  return ips;
}

const ips = getLocalIP();

console.log('');
console.log('=== Next.js 开发服务器 ===');
console.log('');

if (ips.length > 0) {
  console.log('找到以下网络 IP 地址:');
  ips.forEach(ip => {
    console.log('  - http://' + ip + ':3000');
  });
  console.log('');
  console.log('提示:');
  console.log('  - 本机访问: http://localhost:3000');
  console.log('  - 网络访问: 使用上面显示的 IP 地址');
  console.log('  - 如果无法访问，请检查防火墙设置');
  console.log('');
} else {
  console.log('未找到局域网 IP 地址');
  console.log('提示: 使用 ipconfig 查找你的 IP 地址');
  console.log('');
}

console.log('启动开发服务器（监听所有接口）...');
console.log('');

// 使用 0.0.0.0 启动，这样 localhost 和网络 IP 都可以访问
execSync('npx next dev -H 0.0.0.0', { stdio: 'inherit' });











