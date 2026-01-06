'use client';

import { useState, useEffect, useMemo } from 'react';
import LoginModal from '@/components/Auth/LoginModal';
import { useSession, signOut } from 'next-auth/react';
import { useTasks } from '../Providers/TaskProvider';
import { 
  Home, 
  Sparkles, 
  FileText, 
  Palette, 
  Users, 
  Library, 
  User, 
  Rocket, 
  Menu, 
  Search, 
  UserCircle,
  BookOpen,
  LogOut,
  ChevronDown,
  ChevronUp,
  Settings2,
  X,
  Bell,
  Loader2
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onUserChange?: (user: any | null) => void;
}

export default function MainLayout({ children, currentPage = 'home', onNavigate, onUserChange }: MainLayoutProps) {
  const { data: session, status } = useSession();
  const { tasks, isAnyTaskGenerating, notifications, removeNotification } = useTasks();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 移动端默认关闭
  const [isMobile, setIsMobile] = useState(false);

  const currentUser = session?.user as any;

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
    if (onUserChange) {
      onUserChange(currentUser || null);
    }
  }, [currentUser, onUserChange]);

  // 自动清理通知：每条通知显示 5 秒后自动消失
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        removeNotification(0); // 自动移除最旧的一条
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications, removeNotification]);

  const handleLoginSuccess = (user: any) => {
    // signIn 已经在 LoginModal 中处理了，这里只需要关闭 Modal
    setShowLoginModal(false);
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await signOut({ redirect: false });
      if (onNavigate) {
        onNavigate('home');
      }
    }
  };
  
  // 防止在脚本生成页面时意外导航
  const isGeneratingPage = currentPage === 'script' || currentPage === 'comic';

  const menuItems = [
    { id: 'home', label: '首页', icon: <Home size={24} />, hasSubmenu: false },
    { 
      id: 'create', 
      label: '创作', 
      icon: <Sparkles size={24} />,
      hasSubmenu: true,
      submenu: [
        { id: 'script', label: '脚本生成', icon: <FileText size={20} /> },
        { id: 'comic', label: '绘本生成', icon: <Palette size={20} /> },
      ]
    },
    { id: 'characters', label: '角色库', icon: <Users size={24} />, hasSubmenu: false },
    { id: 'my-works', label: '我的作品', icon: <Library size={24} />, hasSubmenu: false },
    { id: 'personal', label: '个人中心', icon: <User size={24} />, hasSubmenu: false },
    { id: 'publish', label: '作品发布', icon: <Rocket size={24} />, hasSubmenu: false },
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
    <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* 全局通知 Toast */}
      <div className="fixed bottom-6 right-6 z-[100] space-y-3">
        {notifications.map((note, index) => (
          <div 
            key={index} 
            onClick={() => {
              handleMenuClick('my-works');
              removeNotification(index);
            }}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 cursor-pointer hover:bg-slate-800 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold tracking-wide">{note}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">点击查看作品</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation(); // 防止触发跳转
                removeNotification(index);
              }} 
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        ))}
      </div>

      {/* 极简背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-100/30 rounded-full blur-[120px] animate-float"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-violet-100/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* 顶部导航栏 - 磨砂玻璃效果 */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 左侧：Logo区域 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Menu size={22} />
              </button>
              
              <button
                onClick={() => onNavigate?.('home')}
                className="flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-brand-violet flex items-center justify-center shadow-lg shadow-primary-200 group-hover:shadow-primary-300 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
                  <BookOpen className="text-white w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-primary-600 transition-colors">
                    漫画绘本创作工坊
                  </h1>
                  <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">AI Comic Studio</p>
                </div>
              </button>
            </div>

            {/* 中间搜索框 - 扁平化设计 */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full group">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  placeholder="搜索作品或角色..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-primary-500/30 focus:ring-4 focus:ring-primary-500/5 text-slate-700 placeholder:text-slate-400 transition-all text-sm"
                />
              </div>
            </div>

            {/* 右侧用户区域 - 模块化设计 */}
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <div className="flex items-center p-1 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                  <div className="flex items-center space-x-2 px-3 py-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm text-sm">
                      {currentUser.avatar || '👤'}
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-xs font-bold text-slate-700">{currentUser.nickname}</p>
                      {currentUser.isVip && <p className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter">Gold Member</p>}
                    </div>
                  </div>
                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                    title="退出登录"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                  <button
                    onClick={() => setShowLoginModal(true)}
                  className="btn-primary flex items-center space-x-2 !py-2 !px-5"
                  >
                    <User size={18} />
                  <span className="text-sm">进入工坊</span>
                  </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* 移动端遮罩 */}
        {isSidebarOpen && isMobile && (
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* 左侧边栏 - 极简主义 */}
        <aside className={`bg-white/50 backdrop-blur-xl border-r border-slate-200/60 transition-all duration-300 ${
          isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'
        } fixed lg:relative z-50 h-full flex flex-col`}>
          <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = currentPage === item.id || (item.hasSubmenu && item.submenu?.some(s => s.id === currentPage));
              const isExpanded = expandedMenu === item.id;

              return (
                <div key={item.id} className="space-y-1">
                <button
                    onClick={() => {
                      if (item.hasSubmenu) setExpandedMenu(isExpanded ? null : item.id);
                      else handleMenuClick(item.id);
                  }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive 
                        ? 'bg-primary-50 text-primary-600 shadow-sm shadow-primary-100/50' 
                        : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                    <div className={`flex items-center justify-center ${isSidebarOpen ? 'mr-3' : 'mx-auto'} transition-all`}>
                      {item.icon}
                    </div>
                    {isSidebarOpen && (
                      <>
                        <span className={`text-sm font-semibold flex-1 text-left ${isActive ? 'text-primary-700' : ''}`}>
                          {item.label}
                    </span>
                  {item.hasSubmenu && (
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </>
                  )}
                </button>
                
                  {item.hasSubmenu && isExpanded && isSidebarOpen && (
                    <div className="ml-9 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
                      {item.submenu?.map((sub) => {
                        const isSubActive = currentPage === sub.id;
                        return (
                      <button
                            key={sub.id}
                            onClick={() => {
                              handleMenuClick(sub.id);
                              if (isMobile) setIsSidebarOpen(false);
                        }}
                            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isSubActive 
                                ? 'text-primary-600 bg-primary-50/50' 
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                            {sub.icon}
                            <span>{sub.label}</span>
                      </button>
                        );
                      })}
                  </div>
                )}
              </div>
              );
            })}
          </nav>

          {/* 底部帮助或设置入口 */}
          <div className="p-4 border-t border-slate-100 space-y-4">
            {isAnyTaskGenerating && (
              <div className={`flex items-center ${isSidebarOpen ? 'px-3' : 'justify-center'} py-2.5 bg-primary-50 rounded-xl text-primary-600 border border-primary-100/50`}>
                <Loader2 size={18} className="animate-spin" />
                {isSidebarOpen && (
                  <div className="ml-3 overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">后台生成中...</p>
                    <div className="h-1 bg-primary-200 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary-600 animate-pulse w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className={`flex items-center ${isSidebarOpen ? 'px-3' : 'justify-center'} py-2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors`}>
              <Settings2 size={20} />
              {isSidebarOpen && <span className="ml-3 text-sm font-medium">系统设置</span>}
            </div>
          </div>
        </aside>

        {/* 主内容区 - 留白优化 */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]/50 relative">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 min-h-full">
          {children}
          </div>
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
