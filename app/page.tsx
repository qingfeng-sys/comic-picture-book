'use client';

import { useState, useEffect } from 'react';
import ScriptGenerator from '@/components/ScriptGenerator/ScriptGenerator';
import ComicGenerator from '@/components/ComicGenerator/ComicGenerator';
import ComicViewer from '@/components/ComicViewer/ComicViewer';
import PersonalCenter from '@/components/PersonalCenter/PersonalCenter';
import MainLayout from '@/components/Layout/MainLayout';
import CharacterLibrary from '@/components/CharacterLibrary/CharacterLibrary';
import { saveScriptToStorage, loadScriptsFromStorage, loadComicBooksFromStorage, deleteComicBookFromStorage, saveComicBookToStorage } from '@/lib/scriptUtils';
import { isLoggedIn, getCurrentUser, type User } from '@/lib/authUtils';
import { Script, ComicBook } from '@/types';

type ViewMode = 'home' | 'script' | 'comic' | 'edit' | 'library' | 'ai-create' | 'my-works' | 'characters' | 'view-comic' | 'personal';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [savedComicBooks, setSavedComicBooks] = useState<ComicBook[]>([]);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [viewingComicBook, setViewingComicBook] = useState<ComicBook | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 添加生成状态锁
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (viewMode === 'home' || viewMode === 'my-works') {
      const scripts = loadScriptsFromStorage();
      setSavedScripts(scripts);
      const comicBooks = loadComicBooksFromStorage();
      setSavedComicBooks(comicBooks);
    }
  }, [viewMode]);

  // 首页也需要加载数据
  useEffect(() => {
    const scripts = loadScriptsFromStorage();
    setSavedScripts(scripts);
    const comicBooks = loadComicBooksFromStorage();
    setSavedComicBooks(comicBooks);
    // 检查登录状态
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  // 防止页面刷新导致状态丢失 - 从 sessionStorage 恢复 viewMode
  useEffect(() => {
    const savedViewMode = sessionStorage.getItem('currentViewMode') as ViewMode | null;
    if (savedViewMode && savedViewMode !== 'home') {
      console.log('[状态恢复] 从 sessionStorage 恢复 viewMode:', savedViewMode);
      setViewMode(savedViewMode);
    }
  }, []);

  // 保存当前 viewMode 到 sessionStorage
  useEffect(() => {
    if (viewMode !== 'home') {
      sessionStorage.setItem('currentViewMode', viewMode);
      console.log('[状态保存] 保存 viewMode 到 sessionStorage:', viewMode);
    }
  }, [viewMode]);

  const handleScriptComplete = (script: string, title: string, scriptId?: string) => {
    // 保存脚本
    const now = new Date().toISOString();
    const scriptData: Script = scriptId 
      ? {
          id: scriptId,
          title,
          content: script,
          createdAt: editingScript?.createdAt || now,
          updatedAt: now,
        }
      : {
          id: `script_${Date.now()}`,
          title,
          content: script,
          createdAt: now,
          updatedAt: now,
        };
    saveScriptToStorage(scriptData);
    
    // 更新本地状态
    const scripts = loadScriptsFromStorage();
    setSavedScripts(scripts);
    
    alert('脚本已保存！');
    setEditingScript(null);
    // 跳转到"我的作品"页面，让用户可以看到保存的脚本
    setViewMode('my-works');
  };

  const handleEditScript = (script: Script) => {
    setEditingScript(script);
    setViewMode('edit');
  };

  const handleDeleteScript = (scriptId: string) => {
    if (confirm('确定要删除这个脚本吗？')) {
      const scripts = loadScriptsFromStorage();
      const filtered = scripts.filter(s => s.id !== scriptId);
      localStorage.setItem('comic_scripts', JSON.stringify(filtered));
      setSavedScripts(filtered);
    }
  };

  const handleNavigation = (page: string) => {
    // 记录所有导航请求，用于调试
    console.log('[导航] 请求跳转到:', page, '当前页面:', viewMode, '生成中:', isGenerating, '时间:', new Date().toISOString());
    
    // 如果正在生成，阻止所有导航（除了取消操作）
    if (isGenerating && page !== viewMode) {
      console.warn('[导航阻止] 生成中，阻止跳转到:', page);
      alert('正在生成中，请稍候...');
      return;
    }
    
    // 防止在脚本生成过程中意外跳转
    const isGeneratingPage = viewMode === 'script' || viewMode === 'comic' || viewMode === 'edit';
    const isNavigatingAway = page !== 'script' && page !== 'comic' && page !== viewMode;
    
    if (isGeneratingPage && isNavigatingAway) {
      console.warn('[导航警告] 在生成页面尝试跳转:', { from: viewMode, to: page });
    }
    
    if (page === 'script') {
      // “脚本生成/开始创作”应始终进入“生成故事脚本”页，而不是回到编辑态
      setEditingScript(null);
      setViewMode('script');
    } else if (page === 'comic') {
      setViewMode('comic');
    } else {
      setViewMode(page as ViewMode);
    }
  };

  const handleDeleteComicBook = (comicBookId: string) => {
    if (confirm('确定要删除这个绘本吗？')) {
      deleteComicBookFromStorage(comicBookId);
      const comicBooks = loadComicBooksFromStorage();
      setSavedComicBooks(comicBooks);
    }
  };

  if (viewMode === 'script' || viewMode === 'edit') {
    // 检查登录状态
    if (!isLoggedIn()) {
      return (
        <MainLayout currentPage="script" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border-2 border-purple-200">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">需要登录</h2>
              <p className="text-gray-600 mb-6">脚本生成功能需要登录后才能使用，请先登录或注册账号。</p>
              <button
                onClick={() => {
                  const loginBtn = document.querySelector('button:has-text("登录/注册")') as HTMLElement;
                  loginBtn?.click();
                }}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                立即登录/注册
              </button>
            </div>
          </div>
        </MainLayout>
      );
    }

    return (
      <MainLayout currentPage="script" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
        <ScriptGenerator
          onScriptComplete={handleScriptComplete}
          onCancel={() => {
            if (!isGenerating) {
              setEditingScript(null);
              setViewMode('home');
            } else {
              alert('正在生成中，请稍候...');
            }
          }}
          // 仅在显式“编辑故事脚本”模式下才带入 initialScript
          initialScript={viewMode === 'edit' ? editingScript : null}
          onGeneratingChange={setIsGenerating}
        />
      </MainLayout>
    );
  }

  if (viewMode === 'comic') {
    // 检查登录状态
    if (!isLoggedIn()) {
      return (
        <MainLayout currentPage="comic" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border-2 border-purple-200">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">需要登录</h2>
              <p className="text-gray-600 mb-6">绘本生成功能需要登录后才能使用，请先登录或注册账号。</p>
              <button
                onClick={() => {
                  const loginBtn = document.querySelector('button:has-text("登录/注册")') as HTMLElement;
                  loginBtn?.click();
                }}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                立即登录/注册
              </button>
            </div>
          </div>
        </MainLayout>
      );
    }

    return (
      <MainLayout currentPage="comic" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
        <ComicGenerator onBack={() => setViewMode('home')} />
      </MainLayout>
    );
  }

  // 绘本查看页面
  if (viewMode === 'view-comic' && viewingComicBook) {
    return (
      <MainLayout currentPage="my-works" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
        <ComicViewer
          comicBook={viewingComicBook}
          onBack={() => {
            setViewingComicBook(null);
            setViewMode('my-works');
          }}
          onComicBookUpdate={(updatedComicBook) => {
            setViewingComicBook(updatedComicBook);
            const comicBooks = loadComicBooksFromStorage();
            setSavedComicBooks(comicBooks);
          }}
          isLoggedIn={isLoggedIn()}
        />
      </MainLayout>
    );
  }

  // 绘本库页面
  if (viewMode === 'library') {
    return (
      <MainLayout currentPage="library" onNavigate={handleNavigation}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent mb-2 drop-shadow-lg">
                📚 绘本库
              </h1>
              <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
            </div>
            <p className="text-gray-600 text-lg font-medium">探索丰富的绘本作品</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 占位内容 */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all transform hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
              >
                <div 
                  className="aspect-square rounded-xl mb-4 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: i % 3 === 0 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : i % 3 === 1
                      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                      : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  }}
                >
                  <span className="text-7xl filter drop-shadow-lg animate-float" style={{ animationDelay: `${i * 0.2}s` }}>📖</span>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <h3 className="font-bold text-xl text-gray-800 mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">示例绘本 {i}</h3>
                <p className="text-sm text-gray-600">这是一个示例绘本作品</p>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  // 我的作品页面
  if (viewMode === 'my-works') {
    return (
      <MainLayout currentPage="my-works" onNavigate={handleNavigation}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 lg:mb-12">
            <div className="inline-block mb-3 sm:mb-4">
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent mb-2 drop-shadow-lg">
                🎨 我的作品
              </h1>
              <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
            </div>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium">查看和管理你的创作</p>
          </div>

          {/* 历史生成脚本 */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 lg:mb-8 border-2 border-purple-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent">
                📝 历史生成脚本
              </h2>
              <span className="px-3 sm:px-4 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full text-purple-700 font-bold text-sm sm:text-base">
                {savedScripts.length}
              </span>
            </div>
            {savedScripts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {savedScripts.map((script) => (
                  <div
                    key={script.id}
                    className="p-5 border-2 border-purple-200 rounded-2xl hover:border-purple-400 transition-all bg-gradient-to-br from-white via-purple-50/50 to-pink-50/50 hover:shadow-xl transform hover:scale-105 relative overflow-hidden group"
                  >
                    {/* 装饰背景 */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-gray-800 flex-1">{script.title}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditScript(script)}
                          className="px-3 py-1 rounded-full bg-soft-blue-100 text-soft-blue-600 hover:bg-soft-blue-200 text-sm font-medium transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('comic');
                          }}
                          className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white hover:from-pink-500 hover:to-purple-500 text-sm font-medium transition-all"
                        >
                          生成绘本
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {script.content.substring(0, 150)}...
                    </p>
                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>创建：{new Date(script.createdAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => {
                          handleDeleteScript(script.id);
                          const scripts = loadScriptsFromStorage();
                          setSavedScripts(scripts);
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">还没有保存的脚本</h3>
                <p className="text-gray-500 mb-6">开始创作你的第一个故事脚本吧！</p>
                <button
                  onClick={() => setViewMode('script')}
                  className="btn-primary"
                >
                  开始创作
                </button>
              </div>
            )}
          </div>

          {/* 历史生成绘本 */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 border-2 border-cyan-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                📚 历史生成绘本
              </h2>
              <span className="px-3 sm:px-4 py-1 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-full text-cyan-700 font-bold text-sm sm:text-base">
                {savedComicBooks.length}
              </span>
            </div>
            {savedComicBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {savedComicBooks.map((comicBook) => {
                  const script = savedScripts.find(s => s.id === comicBook.scriptId);
                  return (
                    <div
                      key={comicBook.id}
                      className="p-3 sm:p-4 lg:p-5 border-2 border-cyan-200 rounded-xl sm:rounded-2xl hover:border-cyan-400 transition-all bg-gradient-to-br from-white via-cyan-50/50 to-blue-50/50 hover:shadow-xl transform hover:scale-105 relative overflow-hidden group"
                    >
                      {/* 装饰背景 */}
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-200/30 to-blue-200/30 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="aspect-video bg-gradient-to-br from-blue-200 to-purple-200 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                        {comicBook.pages.length > 0 ? (
                          <img
                            src={comicBook.pages[0].imageUrl}
                            alt={`绘本封面`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-6xl">📖</span>';
                            }}
                          />
                        ) : (
                          <span className="text-6xl">📖</span>
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-sm sm:text-base lg:text-lg text-gray-800 flex-1 line-clamp-2" title={comicBook.title || script?.title || '未命名绘本'}>
                          {comicBook.title || script?.title || `绘本 ${comicBook.id.substring(0, 8)}`}
                        </h3>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => {
                              const newTitle = prompt('请输入新的绘本名称:', comicBook.title || script?.title || '');
                              if (newTitle !== null && newTitle.trim()) {
                                const updatedComicBook = {
                                  ...comicBook,
                                  title: newTitle.trim(),
                                  updatedAt: new Date().toISOString(),
                                };
                                saveComicBookToStorage(updatedComicBook);
                                const comicBooks = loadComicBooksFromStorage();
                                setSavedComicBooks(comicBooks);
                              }
                            }}
                            className="text-blue-500 hover:text-blue-600 text-xs sm:text-sm"
                            title="重命名"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteComicBook(comicBook.id)}
                            className="text-red-500 hover:text-red-600 text-xs sm:text-sm"
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                        共 {comicBook.pages.length} 页
                      </p>
                      <div className="text-xs text-gray-400 mb-2 sm:mb-3">
                        创建：{new Date(comicBook.createdAt).toLocaleString()}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-3">
                        <button
                          onClick={() => {
                            setViewingComicBook(comicBook);
                            setViewMode('view-comic');
                          }}
                          className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:from-blue-500 hover:to-purple-500 text-xs sm:text-sm font-medium transition-all transform hover:scale-105"
                        >
                          查看绘本
                        </button>
                        <button
                          onClick={async () => {
                            if (!isLoggedIn()) {
                              alert('下载功能需要登录后才能使用，请先登录。');
                              return;
                            }
                            try {
                              const { downloadCanvasesAsZip } = await import('@/lib/downloadUtils');
                              const { renderComicPageToCanvas } = await import('@/lib/comicPageRenderer');
                              // 创建临时Canvas元素来下载
                              const canvases: Array<{ canvas: HTMLCanvasElement; filename: string }> = [];
                              
                              for (let i = 0; i < comicBook.pages.length; i++) {
                                const page = comicBook.pages[i];
                                // 关键：离屏渲染，把“对话气泡/旁白”也画进导出图，避免下载后缺失
                                const canvas = await renderComicPageToCanvas(page);
                                      canvases.push({
                                        canvas,
                                        filename: `第${String(page.pageNumber).padStart(3, '0')}页.png`,
                                });
                              }

                              if (canvases.length > 0) {
                                const comicTitle = comicBook.title || savedScripts.find(s => s.id === comicBook.scriptId)?.title || comicBook.id.substring(0, 8);
                                const zipFilename = `绘本-${comicTitle}.zip`;
                                await downloadCanvasesAsZip(canvases, zipFilename);
                              }
                            } catch (error) {
                              console.error('下载失败:', error);
                              alert('下载失败，请重试');
                            }
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 text-white hover:from-green-500 hover:to-emerald-500 text-xs sm:text-sm font-medium transition-all transform hover:scale-105"
                          title="下载整本绘本"
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📖</div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">还没有生成的绘本</h3>
                <p className="text-gray-500 mb-6">选择一个脚本开始生成绘本吧！</p>
                <button
                  onClick={() => setViewMode('comic')}
                  className="btn-primary"
                >
                  生成绘本
                </button>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  // 角色库页面
  if (viewMode === 'characters') {
    return (
      <MainLayout currentPage="characters" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
        <CharacterLibrary />
      </MainLayout>
    );
  }

  // 个人中心页面
  if (viewMode === 'personal') {
    return (
      <MainLayout currentPage="personal" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent mb-2">
              👤 个人中心
            </h1>
          </div>
          <PersonalCenter onNavigate={handleNavigation} />
        </div>
      </MainLayout>
    );
  }

  // 首页
  return (
    <MainLayout currentPage="home" onNavigate={handleNavigation} onUserChange={setCurrentUser}>
      <div className="max-w-7xl mx-auto w-full">
        {/* 脚本生成卡片区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div 
            className="relative group rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 cursor-pointer overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[200px] sm:min-h-[250px]"
            onClick={() => {
              if (!isLoggedIn()) {
                alert('脚本生成功能需要登录后才能使用，请先登录或注册账号。');
                return;
              }
              setViewMode('script');
            }}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            }}
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-300 rounded-full blur-xl"></div>
            </div>
            
            <div className="relative z-10 text-center flex flex-col items-center justify-center h-full">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-2 sm:mb-4 animate-float">✨</div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg">脚本生成</h2>
              <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-sm px-2">AI智能创作，让故事更精彩</p>
              <button className="px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 bg-white/20 backdrop-blur-md text-white rounded-full font-bold hover:bg-white/30 transition-all shadow-lg hover:shadow-xl border-2 border-white/30 text-xs sm:text-sm lg:text-base">
                开始创作 →
              </button>
            </div>
            
            {/* 光效动画 */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
          </div>

          <div 
            className="relative group rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 cursor-pointer overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[200px] sm:min-h-[250px]"
            onClick={() => {
              if (!isLoggedIn()) {
                alert('绘本生成功能需要登录后才能使用，请先登录或注册账号。');
                return;
              }
              setViewMode('comic');
            }}
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)',
            }}
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-300 rounded-full blur-xl"></div>
            </div>
            
            <div className="relative z-10 text-center flex flex-col items-center justify-center h-full">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-2 sm:mb-4 animate-float" style={{ animationDelay: '0.5s' }}>🎨</div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg">绘本生成</h2>
              <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-sm px-2">将脚本转换为精美绘本，让故事更生动</p>
              <button className="px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 lg:py-3 bg-white/20 backdrop-blur-md text-white rounded-full font-bold hover:bg-white/30 transition-all shadow-lg hover:shadow-xl border-2 border-white/30 text-xs sm:text-sm lg:text-base">
                开始生成 →
              </button>
            </div>
            
            {/* 光效动画 */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* 绘本画廊 */}
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent">
              📚 绘本画廊
            </h2>
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
              <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">共 {savedComicBooks.length} 部作品</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {savedComicBooks.length > 0 ? (
              <>
                {savedComicBooks.slice(0, 12).map((comicBook, index) => {
                  const script = savedScripts.find(s => s.id === comicBook.scriptId);
                  return (
                    <div
                      key={comicBook.id}
                      className="group aspect-square rounded-xl overflow-hidden relative cursor-pointer transform transition-all duration-300 hover:scale-110 hover:z-10 hover:shadow-2xl"
                      onClick={() => {
                        setViewingComicBook(comicBook);
                        setViewMode('view-comic');
                      }}
                      style={{
                        background: index % 4 === 0 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : index % 4 === 1
                          ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                          : index % 4 === 2
                          ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                          : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        animationDelay: `${index * 0.1}s`
                      }}
                    >
                      {comicBook.pages.length > 0 ? (
                        <>
                          <img
                            src={comicBook.pages[0].imageUrl}
                            alt={comicBook.title || script?.title || '绘本'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-5xl filter drop-shadow-lg">📖</span>
                        </div>
                      )}
                      
                      {/* 标题覆盖层 */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <p className="text-white text-xs font-bold truncate">{comicBook.title || script?.title || '未命名绘本'}</p>
                        <p className="text-white/80 text-xs mt-1">{comicBook.pages.length} 页</p>
                      </div>
                      
                      {/* 装饰边框 */}
                      <div className="absolute inset-0 border-2 border-white/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  );
                })}
                {/* 如果绘本少于12个，显示占位符 */}
                {Array.from({ length: Math.max(0, 12 - savedComicBooks.length) }).map((_, i) => {
                  const index = savedComicBooks.length + i;
                  return (
                    <div
                      key={`placeholder-${i}`}
                      className="aspect-square rounded-xl overflow-hidden relative cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl flex items-center justify-center"
                      style={{
                        background: index % 4 === 0 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : index % 4 === 1
                          ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                          : index % 4 === 2
                          ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                          : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                      }}
                    >
                      <div className="text-center">
                        <span className="text-4xl filter drop-shadow-lg block mb-2">✨</span>
                        <span className="text-white text-sm font-bold">即将推出</span>
                      </div>
                      <div className="absolute inset-0 border-2 border-white/30 rounded-xl border-dashed"></div>
                    </div>
                  );
                })}
              </>
            ) : (
              // 如果没有绘本，显示12个占位符
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl overflow-hidden relative cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl flex items-center justify-center group"
                  style={{
                    background: (i - 1) % 4 === 0 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : (i - 1) % 4 === 1
                      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                      : (i - 1) % 4 === 2
                      ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                      : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  }}
                >
                  <div className="text-center">
                    <span className="text-5xl filter drop-shadow-lg block mb-2 animate-float" style={{ animationDelay: `${i * 0.1}s` }}>📖</span>
                    <span className="text-white text-sm font-bold">等待创作</span>
                  </div>
                  <div className="absolute inset-0 border-2 border-white/30 rounded-xl border-dashed opacity-50 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
