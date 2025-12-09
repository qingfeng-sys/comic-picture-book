'use client';

import { useState, useEffect } from 'react';
import { loadScriptsFromStorage, loadComicBooksFromStorage } from '@/lib/scriptUtils';
import { getCurrentUser, logout, type User } from '@/lib/authUtils';

interface PersonalCenterProps {
  onNavigate?: (page: string) => void;
}

export default function PersonalCenter({ onNavigate }: PersonalCenterProps) {
  const [savedScripts, setSavedScripts] = useState<any[]>([]);
  const [savedComicBooks, setSavedComicBooks] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const scripts = loadScriptsFromStorage();
    const comicBooks = loadComicBooksFromStorage();
    setSavedScripts(scripts);
    setSavedComicBooks(comicBooks);
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  const stats = {
    comicCount: savedComicBooks.length,
    favoriteCount: 0, // 收藏数（暂时为0，后续可扩展）
    historyCount: savedScripts.length + savedComicBooks.length,
  };

  const menuItems = [
    { id: 'my-comics', label: '我的绘本', icon: '📚', action: () => onNavigate?.('my-works') },
    { id: 'drafts', label: '草稿箱', icon: '📝', action: () => alert('草稿箱功能开发中') },
    { id: 'security', label: '账号安全', icon: '🔒', action: () => alert('账号安全功能开发中') },
    { id: 'language', label: '语言设置', icon: '🌐', action: () => alert('语言设置功能开发中') },
    { id: 'feedback', label: '意见反馈', icon: '💬', action: () => alert('意见反馈功能开发中') },
    { id: 'logout', label: '退出登录', icon: '🚪', action: () => {
      if (confirm('确定要退出登录吗？')) {
        logout();
        setCurrentUser(null);
        if (onNavigate) {
          onNavigate('home');
        }
        window.location.reload(); // 刷新页面以更新状态
      }
    } },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* 顶部用户信息区 */}
      <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 text-white relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-2xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-6">
          {/* 头像 */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center text-3xl sm:text-4xl lg:text-5xl shadow-xl transform hover:scale-110 transition-all">
            {currentUser?.avatar || '👤'}
          </div>
          
          {/* 用户信息 */}
          <div className="flex-1 text-center sm:text-left w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-center sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">{currentUser?.nickname || '游客'}</h2>
              {currentUser?.isVip ? (
                <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                  ⭐ VIP会员
                </span>
              ) : (
                <span className="px-2 sm:px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs sm:text-sm font-medium">
                  {currentUser ? '普通用户' : '游客模式'}
                </span>
              )}
            </div>
            <p className="text-white/80 text-xs sm:text-sm mb-2 sm:mb-0">ID: {currentUser?.id || 'guest'}</p>
            <button
              onClick={() => alert('编辑资料功能开发中')}
              className="mt-2 sm:mt-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-md rounded-full text-xs sm:text-sm font-medium hover:bg-white/30 transition-all transform hover:scale-105"
            >
              ✏️ 编辑资料
            </button>
          </div>
        </div>
      </div>

      {/* 数据统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 lg:p-6 border-2 border-purple-200 hover:border-purple-400 transition-all transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">我的绘本</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {stats.comicCount}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-2xl sm:text-3xl">
              📚
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 lg:p-6 border-2 border-cyan-200 hover:border-cyan-400 transition-all transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">收藏数</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                {stats.favoriteCount}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-2xl sm:text-3xl">
              ⭐
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 lg:p-6 border-2 border-green-200 hover:border-green-400 transition-all transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">历史创作</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {stats.historyCount}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-2xl sm:text-3xl">
              🎨
            </div>
          </div>
        </div>
      </div>

      {/* 列表菜单 */}
      <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl border-2 border-purple-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all transform hover:scale-[1.02] group"
            >
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-all">
                  {item.icon}
                </div>
                <span className="text-sm sm:text-base lg:text-lg font-medium text-gray-700 group-hover:text-purple-600">
                  {item.label}
                </span>
              </div>
              <div className="text-gray-400 group-hover:text-purple-500 transition-all">
                →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
