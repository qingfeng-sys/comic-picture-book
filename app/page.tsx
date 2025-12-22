'use client';

import { useState, useEffect } from 'react';
import ScriptGenerator from '@/components/ScriptGenerator/ScriptGenerator';
import ComicGenerator from '@/components/ComicGenerator/ComicGenerator';
import ComicViewer from '@/components/ComicViewer/ComicViewer';
import PersonalCenter from '@/components/PersonalCenter/PersonalCenter';
import MainLayout from '@/components/Layout/MainLayout';
import CharacterLibrary from '@/components/CharacterLibrary/CharacterLibrary';
import { saveScriptToStorage, loadScriptsFromStorage, loadComicBooksFromStorage, deleteComicBookFromStorage, deleteScriptFromStorage, saveComicBookToStorage } from '@/lib/scriptUtils';
import { useSession } from 'next-auth/react';
import { Script, ComicBook } from '@/types';
import { 
  Sparkles, 
  Palette, 
  Library, 
  BookOpen, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Eye, 
  Download,
  Clock,
  Layout,
  Wand2,
  ArrowRight,
  BookMarked,
  Layers,
  ArrowUpRight,
  ChevronRight,
  FileText,
  Rocket,
  Image as ImageIcon
} from 'lucide-react';

type ViewMode = 'home' | 'script' | 'comic' | 'edit' | 'library' | 'ai-create' | 'my-works' | 'characters' | 'view-comic' | 'personal' | 'publish';

export default function Home() {
  const { data: session, status } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [savedComicBooks, setSavedComicBooks] = useState<ComicBook[]>([]);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [viewingComicBook, setViewingComicBook] = useState<ComicBook | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 添加生成状态锁
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [worksTab, setWorksTab] = useState<'scripts' | 'comics'>('comics');
  const [pendingScriptId, setPendingScriptId] = useState<string | null>(null);

  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    const fetchData = async () => {
      if (viewMode === 'home' || viewMode === 'my-works') {
        const scripts = await loadScriptsFromStorage();
        setSavedScripts(scripts);
        const comicBooks = await loadComicBooksFromStorage();
        setSavedComicBooks(comicBooks);
      }
    };
    fetchData();
  }, [viewMode]);

  // 首页也需要加载数据
  useEffect(() => {
    const fetchData = async () => {
      const scripts = await loadScriptsFromStorage();
      setSavedScripts(scripts);
      const comicBooks = await loadComicBooksFromStorage();
      setSavedComicBooks(comicBooks);
    };
    fetchData();
  }, []);

  // 更新当前用户信息
  useEffect(() => {
    if (session?.user) {
      setCurrentUser(session.user);
    } else {
      setCurrentUser(null);
    }
  }, [session]);

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

  const handleScriptComplete = async (script: string, title: string, scriptId?: string) => {
    // 保存脚本
    const scriptData: Partial<Script> = {
      id: scriptId,
      title,
      content: script,
    };
    await saveScriptToStorage(scriptData);
    
    // 更新本地状态
    const scripts = await loadScriptsFromStorage();
    setSavedScripts(scripts);
    
    // 如果是新保存的脚本，询问是否立即生成绘本
    if (confirm('脚本已保存！是否立即前往“生成绘本”页面，将文字转化为精美漫画？')) {
      setPendingScriptId(scriptId || scripts[0]?.id || null);
      setViewMode('comic');
    } else {
      setEditingScript(null);
      setViewMode('my-works');
    }
  };

  const handleEditScript = (script: Script) => {
    setEditingScript(script);
    setViewMode('edit');
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (confirm('确定要删除这个脚本吗？')) {
      const success = await deleteScriptFromStorage(scriptId);
      if (success) {
        const scripts = await loadScriptsFromStorage();
        setSavedScripts(scripts);
      } else {
        alert('删除失败');
      }
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
      setPendingScriptId(null); // 清除可能存在的待处理脚本
      setViewMode('script');
    } else if (page === 'comic') {
      setViewMode('comic');
    } else if (page === 'my-works-scripts') {
      setWorksTab('scripts');
      setPendingScriptId(null);
      setViewMode('my-works');
    } else if (page === 'my-works-comics') {
      setWorksTab('comics');
      setPendingScriptId(null);
      setViewMode('my-works');
    } else {
      setPendingScriptId(null);
      setViewMode(page as ViewMode);
    }
  };

  const handleDeleteComicBook = async (comicBookId: string) => {
    if (confirm('确定要删除这个绘本吗？')) {
      const success = await deleteComicBookFromStorage(comicBookId);
      if (success) {
        const comicBooks = await loadComicBooksFromStorage();
        setSavedComicBooks(comicBooks);
      } else {
        alert('删除失败');
      }
    }
  };

  if (viewMode === 'script' || viewMode === 'edit') {
    // 检查登录状态
    if (!isLoggedIn) {
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
    if (!isLoggedIn) {
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
        <ComicGenerator 
          onBack={() => {
            setPendingScriptId(null);
            setViewMode('home');
          }} 
          initialScriptId={pendingScriptId}
        />
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
          onComicBookUpdate={async (updatedComicBook) => {
            setViewingComicBook(updatedComicBook);
            const comicBooks = await loadComicBooksFromStorage();
            setSavedComicBooks(comicBooks);
          }}
          isLoggedIn={isLoggedIn}
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
              <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent mb-2 drop-shadow-lg flex items-center justify-center space-x-4">
                <Library size={48} className="text-purple-600" />
                <span>绘本库</span>
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
                  <BookOpen className="text-white w-20 h-20 filter drop-shadow-lg animate-float" style={{ animationDelay: `${i * 0.2}s` }} />
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
        <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-primary-50 rounded-2xl text-primary-600 shadow-sm">
                  <BookMarked size={28} />
                </div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">作品工坊 (Studio)</h2>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs ml-1">Asset Management & Pipeline</p>
            </div>

            <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100">
              <button
                onClick={() => setWorksTab('comics')}
                className={`flex items-center gap-2 py-2.5 px-6 rounded-xl text-sm font-black transition-all ${
                  worksTab === 'comics'
                    ? 'bg-white text-primary-600 shadow-md translate-y-[-1px]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Library size={18} />
                完成绘本
              </button>
              <button
                onClick={() => setWorksTab('scripts')}
                className={`flex items-center gap-2 py-2.5 px-6 rounded-xl text-sm font-black transition-all ${
                  worksTab === 'scripts'
                    ? 'bg-white text-primary-600 shadow-md translate-y-[-1px]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileText size={18} />
                故事脚本
              </button>
            </div>
          </div>

          <div className="min-h-[600px]">
            {worksTab === 'scripts' ? (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <FileText className="text-primary-500" size={24} />
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">脚本原稿 (Scripts)</h2>
                  </div>
                  <span className="px-4 py-1.5 rounded-full bg-primary-50 text-primary-600 font-black text-xs border border-primary-100/50 uppercase tracking-widest">
                    {savedScripts.length} Drafts Saved
                  </span>
                </div>

                {savedScripts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedScripts.map((script) => (
                      <div
                        key={script.id}
                        className="group relative bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-primary-300 hover:shadow-2xl hover:shadow-primary-500/5 transition-all duration-500"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                            <FileText size={24} />
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditScript(script)}
                              className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                              title="编辑脚本"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingScript(null);
                                setPendingScriptId(script.id);
                                setViewMode('comic');
                              }}
                              className="p-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                              title="前往生成绘本"
                            >
                              <Wand2 size={18} />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-black text-xl text-slate-800 group-hover:text-primary-600 transition-colors line-clamp-1 mb-3">{script.title}</h3>
                        <p className="text-sm font-medium text-slate-500 mb-8 line-clamp-4 leading-relaxed italic opacity-70">
                          "{script.content.substring(0, 150)}..."
                        </p>
                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                            <Clock size={12} />
                            <span>{new Date(script.createdAt).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteScript(script.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 py-32 text-center">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                      <FileText size={40} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">No scripts drafted yet</p>
                    <button onClick={() => setViewMode('script')} className="mt-8 btn-primary !rounded-2xl !py-3 !px-8">开始首个故事创作</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <Library className="text-violet-500" size={24} />
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">成品绘本 (Volumes)</h2>
                  </div>
                  <span className="px-4 py-1.5 rounded-full bg-violet-50 text-violet-600 font-black text-xs border border-violet-100/50 uppercase tracking-widest">
                    {savedComicBooks.length} Books Rendered
                  </span>
                </div>

                {savedComicBooks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {savedComicBooks.map((comicBook) => {
                      const script = savedScripts.find(s => s.id === comicBook.scriptId);
                      return (
                        <div
                          key={comicBook.id}
                          className="group bg-white border border-slate-100 rounded-[3rem] p-5 hover:border-violet-300 hover:shadow-2xl hover:shadow-violet-500/5 transition-all duration-500 flex flex-col"
                        >
                          <div className="aspect-[3/4] rounded-[2.5rem] bg-slate-100 mb-6 overflow-hidden relative shadow-inner border border-slate-50">
                            {comicBook.pages.length > 0 ? (
                              <img
                                src={comicBook.pages[0].imageUrl}
                                alt=""
                                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <BookOpen size={48} />
                              </div>
                            )}
                            <div className="absolute top-4 right-4 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest">
                              {comicBook.pages.length} Pages
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                               <button 
                                 onClick={() => { setViewingComicBook(comicBook); setViewMode('view-comic'); }}
                                 className="w-full py-3 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500"
                               >
                                 Open Reader
                               </button>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-4 flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-3 px-2">
                              <h3 className="font-black text-lg text-slate-800 group-hover:text-violet-600 transition-colors line-clamp-2 leading-tight">
                                {comicBook.title || script?.title || '未命名绘本'}
                              </h3>
                              <div className="flex gap-1">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newTitle = prompt('重命名绘本:', comicBook.title || '');
                                    if (newTitle?.trim()) {
                                      const updated = { ...comicBook, title: newTitle.trim(), updatedAt: new Date().toISOString() };
                                      const success = await saveComicBookToStorage(updated);
                                      if (success) {
                                        const books = await loadComicBooksFromStorage();
                                        setSavedComicBooks(books);
                                      } else {
                                        alert('保存重命名失败，请重试');
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-slate-300 hover:text-primary-500 transition-colors"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteComicBook(comicBook.id); }} 
                                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 px-1 pt-2 border-t border-slate-50">
                               <div className="flex-1 text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                  <Clock size={10} />
                                  {new Date(comicBook.updatedAt || comicBook.createdAt).toLocaleDateString()}
                               </div>
                               <button
                                  onClick={async () => {
                                    if (!isLoggedIn) { alert('请先登录后下载'); return; }
                                    const { downloadCanvasesAsZip } = await import('@/lib/downloadUtils');
                                    const { renderComicPageToCanvas } = await import('@/lib/comicPageRenderer');
                                    const canvases = await Promise.all(comicBook.pages.map(async (page) => ({
                                      canvas: await renderComicPageToCanvas(page),
                                      filename: `Page_${String(page.pageNumber).padStart(3, '0')}.png`
                                    })));
                                    const title = comicBook.title || 'Collection';
                                    await downloadCanvasesAsZip(canvases, `Comic-${title}.zip`);
                                  }}
                                  className="p-2 text-slate-400 hover:text-violet-600 transition-colors"
                                  title="Download ZIP"
                                >
                                  <Download size={18} />
                                </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 py-32 text-center">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                      <Library size={40} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">Library is currently empty</p>
                    <button onClick={() => setViewMode('comic')} className="mt-8 btn-primary !bg-gradient-to-r !from-violet-500 !to-fuchsia-500 !rounded-2xl !py-3 !px-8">将脚本转化为绘本</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  // 作品发布页面
  if (viewMode === 'publish') {
    return (
      <MainLayout currentPage="publish" onNavigate={handleNavigation}>
        <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-500">
          <div className="text-center space-y-4">
            <div className="inline-flex flex-col items-center">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary-50 rounded-2xl text-primary-600 shadow-sm">
                  <Rocket size={32} />
                </div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">作品发布中心</h1>
              </div>
              <div className="h-1.5 w-64 bg-gradient-to-r from-primary-500 via-brand-violet to-primary-500 rounded-full opacity-20"></div>
            </div>
            <p className="text-slate-500 text-lg font-medium">将您的创意结晶分享给世界，开启精彩的视觉旅程</p>
          </div>

          <div className="bg-white rounded-[3rem] shadow-xl p-10 border border-slate-100">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-primary-500 rounded-full"></div>
                <h2 className="text-2xl font-black text-slate-800">待发布作品 (Ready to Share)</h2>
              </div>
              <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {savedComicBooks.length} Available Volumes
              </div>
            </div>

            {savedComicBooks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {savedComicBooks.map((comicBook) => (
                  <div 
                    key={comicBook.id}
                    className="group relative bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-100 hover:bg-white hover:border-primary-300 hover:shadow-2xl hover:shadow-primary-500/5 transition-all duration-500"
                  >
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-6 shadow-inner relative">
                      {comicBook.pages.length > 0 ? (
                        <img 
                          src={comicBook.pages[0].imageUrl} 
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000" 
                          alt="" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xl font-black text-slate-800 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {comicBook.title || '未命名作品'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <Clock size={14} />
                        <span>更新于 {new Date(comicBook.updatedAt || comicBook.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="pt-4 grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { setViewingComicBook(comicBook); setViewMode('view-comic'); }}
                          className="py-3 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-primary-300 hover:text-primary-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Eye size={14} />
                          预览
                        </button>
                        <button 
                          onClick={() => alert('发布功能将在 ICP 备案完成后正式开启！目前您可以先通过“导出”功能保存作品。')}
                          className="py-3 px-4 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Rocket size={14} />
                          发布
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-slate-200">
                  <Rocket size={48} />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No completed works to publish</p>
                  <p className="text-slate-300 text-xs font-medium">快去生成您的第一部绘本吧</p>
                </div>
                <button 
                  onClick={() => setViewMode('comic')}
                  className="btn-primary !rounded-2xl !py-3 !px-8"
                >
                  前往生成绘本
                </button>
              </div>
            )}
          </div>

          <div className="bg-amber-50/50 rounded-3xl p-8 border border-amber-100 flex items-start gap-6">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="text-amber-800 font-black mb-1">发布小贴士</h4>
              <p className="text-amber-700/70 text-sm font-medium leading-relaxed">
                发布后的作品将展示在公共画廊中供其他创作者欣赏。在发布前，请确保您的作品标题和封面已调整至最佳状态。
                <br />
                <span className="opacity-60 italic text-xs">* 当前处于内测阶段，发布的作品仅存储于本地浏览器。</span>
              </p>
            </div>
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
      <div className="max-w-[1400px] mx-auto w-full space-y-12 pb-20">
        {/* 英雄展板区域 (Hero Section) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div 
            className="group relative rounded-[3rem] p-10 cursor-pointer overflow-hidden transition-all duration-500 hover:shadow-[0_20px_80px_-15px_rgba(99,102,241,0.3)] min-h-[350px] flex flex-col justify-between border border-white/20"
            onClick={() => {
              if (!isLoggedIn) { alert('请先登录后再开始创作'); return; }
              setViewMode('script');
            }}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            }}
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-xl">
                <Sparkles size={32} className="text-white animate-pulse" />
              </div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">智能脚本生成</h2>
              <p className="text-primary-100 text-lg font-medium max-w-sm leading-relaxed">
                输入您的灵感碎片，让 AI 为您构建逻辑严密、情感丰富的漫画脚本
              </p>
            </div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-500 bg-indigo-400 flex items-center justify-center text-[10px] font-black text-white">#{i}</div>
                ))}
              </div>
              <button className="px-8 py-4 bg-white text-primary-600 rounded-2xl font-black shadow-xl hover:bg-primary-50 transition-all active:scale-95 flex items-center gap-3">
                立即开始
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <div 
            className="group relative rounded-[3rem] p-10 cursor-pointer overflow-hidden transition-all duration-500 hover:shadow-[0_20px_80px_-15px_rgba(139,92,246,0.3)] min-h-[350px] flex flex-col justify-between border border-white/20"
            onClick={() => {
              if (!isLoggedIn) { alert('请先登录后再开始生成'); return; }
              setViewMode('comic');
            }}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
            }}
          >
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-xl">
                <Palette size={32} className="text-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">视觉绘本渲染</h2>
              <p className="text-purple-100 text-lg font-medium max-w-sm leading-relaxed">
                跨帧角色一致性算法，将文字剧本转化为具有专业表现力的全彩画卷
              </p>
            </div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/60 font-black text-[10px] uppercase tracking-widest">
                <Layers size={14} />
                Character Consistency Active
              </div>
              <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-3">
                一键转换
                <ArrowUpRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 绘本画廊区 (Gallery) - 简化为“最近活跃” */}
        <div className="space-y-10 pt-12">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                <Clock size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">最近活跃 (Recent Activity)</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dashboard Live</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setViewMode('my-works')}
              className="text-xs font-black text-primary-500 uppercase tracking-widest hover:text-primary-600 transition-colors flex items-center gap-1 group"
            >
              进入个人作品库
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {savedComicBooks.length > 0 ? (
              <>
                {savedComicBooks.slice(0, 6).map((comicBook, index) => {
                  const script = savedScripts.find(s => s.id === comicBook.scriptId);
                  return (
                    <div
                      key={comicBook.id}
                      className="group relative aspect-[3/4] rounded-[2.5rem] overflow-hidden cursor-pointer bg-white border border-slate-100 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/10"
                      onClick={() => {
                        setViewingComicBook(comicBook);
                        setViewMode('view-comic');
                      }}
                    >
                      {comicBook.pages.length > 0 ? (
                        <>
                          <img
                            src={comicBook.pages[0].imageUrl}
                            alt=""
                            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity"></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2 bg-slate-50">
                          <BookOpen size={32} />
                          <span className="text-[10px] font-black uppercase">No Preview</span>
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="text-[9px] font-black text-primary-400 uppercase tracking-[0.2em] mb-1">
                          {comicBook.pages.length} Pages
                        </div>
                        <h4 className="text-white font-black text-xs line-clamp-2 leading-snug">
                          {comicBook.title || script?.title || '未命名绘本'}
                        </h4>
                      </div>
                    </div>
                  );
                })}
                {savedComicBooks.length < 6 && (
                  <div
                    className="aspect-[3/4] rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-3 hover:border-primary-200 hover:bg-primary-50/30 transition-all group cursor-pointer"
                    onClick={() => setViewMode('script')}
                  >
                    <div className="p-3 rounded-2xl bg-slate-50 group-hover:bg-white group-hover:text-primary-500 transition-all">
                      <PlusCircle size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Story</span>
                  </div>
                )}
              </>
            ) : (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-3 animate-in fade-in"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <BookOpen size={32} className="opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Ready for Creation</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
