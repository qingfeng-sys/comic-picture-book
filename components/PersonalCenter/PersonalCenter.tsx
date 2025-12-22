'use client';

import { useState, useEffect } from 'react';
import { loadScriptsFromStorage, loadComicBooksFromStorage } from '@/lib/scriptUtils';
import { useSession, signOut } from 'next-auth/react';
import { 
  BookCopy, 
  FileEdit,
  ShieldCheck, 
  Globe, 
  MessageSquare, 
  LogOut, 
  User, 
  Star, 
  Palette,
  ChevronRight,
  Edit3,
  BookOpen
} from 'lucide-react';

interface PersonalCenterProps {
  onNavigate?: (page: string) => void;
}

export default function PersonalCenter({ onNavigate }: PersonalCenterProps) {
  const { data: session } = useSession();
  const [savedScripts, setSavedScripts] = useState<any[]>([]);
  const [savedComicBooks, setSavedComicBooks] = useState<any[]>([]);

  const currentUser = session?.user as any;

  useEffect(() => {
    const fetchData = async () => {
      const scripts = await loadScriptsFromStorage();
      const comicBooks = await loadComicBooksFromStorage();
      setSavedScripts(scripts);
      setSavedComicBooks(comicBooks);
    };
    fetchData();
  }, []);

  const stats = {
    comicCount: savedComicBooks.length,
    favoriteCount: 0, // 收藏数（暂时为0，后续可扩展）
    historyCount: savedScripts.length + savedComicBooks.length,
  };

  const menuItems = [
    { id: 'my-comics', label: '我的绘本', icon: <BookCopy size={22} />, action: () => onNavigate?.('my-works-comics') },
    { id: 'drafts', label: '草稿箱', icon: <FileEdit size={22} />, action: () => onNavigate?.('my-works-scripts') },
    { id: 'security', label: '账号安全', icon: <ShieldCheck size={22} />, action: () => alert('账号安全功能开发中') },
    { id: 'language', label: '语言设置', icon: <Globe size={22} />, action: () => alert('语言设置功能开发中') },
    { id: 'feedback', label: '意见反馈', icon: <MessageSquare size={22} />, action: () => alert('意见反馈功能开发中') },
    { id: 'logout', label: '退出登录', icon: <LogOut size={22} />, action: async () => {
      if (confirm('确定要退出登录吗？')) {
        await signOut({ redirect: false });
        if (onNavigate) {
          onNavigate('home');
        }
      }
    } },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8">
      {/* 顶部用户信息区 - 现代化卡片设计 */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-700 to-brand-violet p-8 text-white shadow-2xl shadow-primary-200">
        {/* 背景装饰纹理 */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-brand-violet/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* 头像 */}
          <div className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center text-4xl shadow-2xl transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
              {currentUser?.avatar || <User size={48} className="text-white/80" />}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary-600 shadow-lg border-2 border-primary-50">
              <Star size={20} fill="currentColor" />
            </div>
          </div>
          
          {/* 用户信息 */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
              <h2 className="text-3xl font-black tracking-tight">{currentUser?.nickname || '创意探索者'}</h2>
              {currentUser?.isVip ? (
                <span className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-black shadow-lg shadow-orange-900/20 uppercase tracking-widest">
                  Gold Member
                </span>
              ) : (
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wide">
                  Free Plan
                </span>
              )}
            </div>
            <p className="text-primary-100/80 text-sm font-medium mb-6">Unique ID: {currentUser?.id || 'guest-001'}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button
                onClick={() => alert('编辑资料功能开发中')}
                className="flex items-center gap-2 px-6 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-bold hover:bg-primary-50 transition-all shadow-lg active:scale-95"
              >
                <Edit3 size={16} />
                编辑个人资料
              </button>
              <button
                onClick={() => alert('会员续费功能开发中')}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-500/30 backdrop-blur-md border border-white/30 text-white rounded-xl text-sm font-bold hover:bg-white/10 transition-all active:scale-95"
              >
                提升创作额度
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 数据统计卡片 - 扁平化图标设计 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: '我的绘本', value: stats.comicCount, icon: <BookOpen />, color: 'primary', action: () => onNavigate?.('my-works-comics') },
          { label: '收藏佳作', value: stats.favoriteCount, icon: <Star />, color: 'amber', action: () => alert('收藏功能开发中') },
          { label: '历史脚本', value: stats.historyCount, icon: <Palette />, color: 'violet', action: () => onNavigate?.('my-works-scripts') }
        ].map((stat, i) => (
          <div 
            key={i} 
            onClick={stat.action}
            className="group bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors`}>
                {stat.icon}
              </div>
              <div className="text-3xl font-black text-slate-800 tabular-nums">{stat.value}</div>
            </div>
            <p className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 列表菜单 - 模块化列表 */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50/80 transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary-600 group-hover:shadow-md transition-all duration-300">
                  {item.icon}
                </div>
                <span className="text-base font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                  {item.label}
                </span>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-primary-500 transform group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
