'use client';

import { useState, useEffect } from 'react';
import LoginModal from '@/components/Auth/LoginModal';
import { getCurrentUser, isLoggedIn, logout, type User } from '@/lib/authUtils';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onUserChange?: (user: User | null) => void;
}

export default function MainLayout({ children, currentPage = 'home', onNavigate, onUserChange }: MainLayoutProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 移动端默认关闭
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 检测是否为移动设备
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile); // 桌面端默认打开，移动端默认关闭
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // 检查登录状态
    const user = getCurrentUser();
    setCurrentUser(user);
    if (onUserChange) {
      onUserChange(user);
    }
  }, [onUserChange]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    if (onUserChange) {
      onUserChange(user);
    }
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      setCurrentUser(null);
      if (onUserChange) {
        onUserChange(null);
      }
      if (onNavigate) {
        onNavigate('home');
      }
    }
  };
  
  // 防止在脚本生成页面时意外导航
  const isGeneratingPage = currentPage === 'script' || currentPage === 'comic';

  const menuItems = [
    { id: 'home', label: '首页', icon: '🏠', hasSubmenu: false },
    { 
      id: 'create', 
      label: '创作', 
      icon: '✨',
      hasSubmenu: true,
      submenu: [
        { id: 'script', label: '脚本生成', icon: '📝' },
        { id: 'comic', label: '绘本生成', icon: '🎨' },
      ]
    },
    { id: 'characters', label: '角色库', icon: '👥', hasSubmenu: false },
    { id: 'my-works', label: '我的作品', icon: '📚', hasSubmenu: false },
    { id: 'personal', label: '个人中心', icon: '👤', hasSubmenu: false },
    { id: 'publish', label: '作品发布', icon: '🚀', hasSubmenu: false },
  ];

  const handleMenuClick = (menuId: string) => {
    // 如果当前已经在目标页面，不执行导航
    if (currentPage === menuId || (menuId === 'script' && currentPage === 'script') || (menuId === 'comic' && currentPage === 'comic')) {
      return;
    }
    
    // 检查需要登录的功能
    const requiresLogin = ['script', 'comic', 'characters', 'my-works', 'personal'];
    if (requiresLogin.includes(menuId) && !currentUser) {
      setShowLoginModal(true);
      return;
    }
    
    if (onNavigate) {
      if (menuId === 'script') {
        onNavigate('script');
      } else if (menuId === 'comic') {
        onNavigate('comic');
      } else {
        onNavigate(menuId);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 via-pink-50 to-cyan-50 relative overflow-hidden">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-cyan-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* 顶部导航栏 */}
      <header className="bg-white/80 backdrop-blur-md border-b-2 border-purple-200 shadow-lg relative z-10">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* 左侧：移动端菜单按钮 + Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-purple-100 transition-all"
                aria-label="切换菜单"
              >
                <span className="text-2xl">☰</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNavigate) {
                    onNavigate('home');
                  }
                }}
                className="flex items-center space-x-2 sm:space-x-3 hover:opacity-90 transition-all cursor-pointer group"
              >
                <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl animate-glow overflow-hidden transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-2xl">
                  {/* 背景光效 */}
                  <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                  {/* 主要图标 */}
                  <div className="relative z-10 flex items-center justify-center">
                    <span className="text-xl sm:text-3xl filter drop-shadow-2xl animate-float">📚</span>
                  </div>
                  {/* 装饰星星 - 桌面端显示 */}
                  <div className="hidden sm:block absolute -top-1 -right-1 text-yellow-300 text-sm animate-pulse filter drop-shadow-lg">✨</div>
                  <div className="hidden sm:block absolute -bottom-1 -left-1 text-pink-300 text-sm animate-pulse filter drop-shadow-lg" style={{ animationDelay: '0.5s' }}>⭐</div>
                  <div className="hidden sm:block absolute top-1/2 -right-2 text-cyan-300 text-xs animate-pulse filter drop-shadow-lg" style={{ animationDelay: '1s' }}>💫</div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent leading-tight group-hover:from-purple-700 group-hover:via-pink-700 group-hover:to-cyan-700 transition-all transform group-hover:scale-105">
                    漫画绘本创作工坊
                  </h1>
                </div>
              </button>
            </div>

            {/* 中间搜索框 - 移动端隐藏 */}
            <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="🔍 搜索你的作品..."
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-full focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 text-gray-700 placeholder-gray-400 shadow-inner transition-all text-sm sm:text-base"
                />
              </div>
            </div>

            {/* 右侧登录区域 */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
              {currentUser ? (
                <>
                  <div className="hidden sm:flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700">
                    <span className="text-lg sm:text-xl">{currentUser.avatar || '👤'}</span>
                    <span className="font-medium text-xs sm:text-sm">{currentUser.nickname}</span>
                    {currentUser.isVip && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full text-xs font-bold">
                        VIP
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-xs sm:text-sm"
                  >
                    退出
                  </button>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline-block px-2 sm:px-3 py-1 text-xs sm:text-sm text-gray-500 bg-gray-100 rounded-full">
                    👤 游客模式
                  </span>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-xs sm:text-sm"
                  >
                    登录/注册
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* 移动端遮罩层 */}
        {isSidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* 左侧边栏 */}
        <aside className={`bg-gradient-to-b from-white/90 to-purple-50/90 backdrop-blur-md border-r-2 border-purple-200 shadow-xl transition-all duration-300 ${
          isSidebarOpen 
            ? 'w-64 fixed lg:relative z-50 h-full lg:h-auto' 
            : 'w-0 lg:w-64'
        } overflow-hidden relative`}>
          <div className="p-2 sm:p-4 space-y-1 sm:space-y-2">
            {menuItems.map((item) => (
              <div key={item.id}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (item.hasSubmenu) {
                      setExpandedMenu(expandedMenu === item.id ? null : item.id);
                    } else {
                      handleMenuClick(item.id);
                    }
                  }}
                  className={`w-full flex items-center space-x-2 sm:space-x-3 px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-left transition-all transform text-sm sm:text-base ${
                    currentPage === item.id || (item.hasSubmenu && item.submenu?.some(s => s.id === currentPage))
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white shadow-lg scale-105'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 hover:shadow-md hover:scale-105'
                  }`}
                >
                  <span className="text-xl sm:text-2xl filter drop-shadow-lg transform transition-all duration-300 hover:scale-125 hover:rotate-12">{item.icon}</span>
                  <span className="font-bold">{item.label}</span>
                </button>
                
                {/* 子菜单 */}
                {item.hasSubmenu && item.submenu && expandedMenu === item.id && (
                  <div className="ml-4 sm:ml-8 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.submenu.map((subItem) => (
                      <button
                        key={subItem.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMenuClick(subItem.id);
                          if (isMobile) {
                            setIsSidebarOpen(false); // 移动端点击后关闭侧边栏
                          }
                        }}
                        className={`w-full flex items-center space-x-2 sm:space-x-3 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-left text-xs sm:text-sm transition-all transform ${
                          currentPage === subItem.id
                            ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-md scale-105'
                            : 'text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:shadow-sm hover:scale-105'
                        }`}
                      >
                        <span className="text-base sm:text-lg filter drop-shadow-md transform transition-all duration-300 hover:scale-125">{subItem.icon}</span>
                        <span className="font-medium">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-2 sm:p-4 lg:p-6 relative z-10 min-w-0">
          {children}
        </main>
      </div>

      {/* 登录模态框 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
