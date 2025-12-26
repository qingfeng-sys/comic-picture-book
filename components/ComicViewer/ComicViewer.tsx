'use client';

import { useState, useEffect, useRef } from 'react';
import { ComicBook, DialogueItem } from '@/types';
import ComicPageCanvas, { ComicPageCanvasRef } from '@/components/ComicPageCanvas/ComicPageCanvas';
import { downloadCanvasesAsZip } from '@/lib/downloadUtils';
import { saveComicBookToStorage } from '@/lib/scriptUtils';
import { renderComicPageToCanvas } from '@/lib/comicPageRenderer';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Archive, 
  Edit3, 
  BookOpen, 
  Keyboard,
  Loader2,
  Image as ImageIcon,
  Settings2,
  Check,
  X,
  Type,
  Move,
  Play,
  Volume2
} from 'lucide-react';

interface ComicViewerProps {
  comicBook: ComicBook;
  onBack: () => void;
  onComicBookUpdate?: (updatedComicBook: ComicBook) => void;
  isLoggedIn?: boolean;
}

export default function ComicViewer({ comicBook, onBack, onComicBookUpdate, isLoggedIn = false }: ComicViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentComicBook, setCurrentComicBook] = useState<ComicBook>(comicBook);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDialogueIndex, setEditingDialogueIndex] = useState<number | null>(null);
  const canvasRefs = useRef<Map<number, ComicPageCanvasRef>>(new Map());
  const currentPage = currentComicBook.pages[currentPageIndex];
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 播放语音播报
  const handlePlaySpeech = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const page = currentComicBook.pages[currentPageIndex];
    const narrationText = page.narration || '';
    const dialogueText = page.dialogue?.map(d => typeof d === 'string' ? d : d.text).join('。') || '';
    const fullText = `${narrationText}。${dialogueText}`.trim();

    if (!fullText) return;

    setIsPlaying(true);
    try {
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText }),
      });
      const result = await response.json();
      if (result.success && result.data.audioUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = result.data.audioUrl;
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.play();
      } else {
        alert('语音合成失败');
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('语音播报错误:', error);
      setIsPlaying(false);
    }
  };

  // 保存绘本修改
  const handleSaveBookChanges = async () => {
    setIsSaving(true);
    try {
      await saveComicBookToStorage(currentComicBook);
      onComicBookUpdate?.(currentComicBook);
      setIsEditing(false);
      setEditingDialogueIndex(null);
      alert('所有修改已保存');
    } catch (error) {
      console.error('保存修改失败:', error);
      alert('保存修改失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (isEditing) {
      setEditingDialogueIndex(null);
    }
    setIsEditing(!isEditing);
  };

  const handleUpdateDialogue = (dialogueIndex: number, updates: Partial<DialogueItem>) => {
    const updatedPages = [...currentComicBook.pages];
    const page = { ...updatedPages[currentPageIndex] };
    
    if (page.dialogue && Array.isArray(page.dialogue)) {
      const updatedDialogues = [...page.dialogue];
      const dialogue = updatedDialogues[dialogueIndex];
      
      if (typeof dialogue === 'object') {
        updatedDialogues[dialogueIndex] = { ...dialogue, ...updates };
        page.dialogue = updatedDialogues;
        updatedPages[currentPageIndex] = page;
        
        const updatedBook = { ...currentComicBook, pages: updatedPages, updatedAt: new Date().toISOString() };
        setCurrentComicBook(updatedBook);
        // 注意：这里不立即保存到后端，等到页面切换或手动保存
      }
    }
  };

  const handleUpdateNarration = (text: string) => {
    const updatedPages = [...currentComicBook.pages];
    updatedPages[currentPageIndex] = { ...updatedPages[currentPageIndex], narration: text };
    const updatedBook = { ...currentComicBook, pages: updatedPages, updatedAt: new Date().toISOString() };
    setCurrentComicBook(updatedBook);
  };

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageIndex < comicBook.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const goToPage = (index: number) => {
    if (isEditing) return;
    if (index >= 0 && index < comicBook.pages.length) {
      setCurrentPageIndex(index);
    }
  };

  // 下载当前页
  const handleDownloadCurrentPage = () => {
    if (!isLoggedIn) {
      alert('下载功能需要登录后才能使用，请先登录。');
      return;
    }
    const canvasRef = canvasRefs.current.get(currentPageIndex);
    if (canvasRef) {
      const page = comicBook.pages[currentPageIndex];
      const filename = `绘本-第${page.pageNumber}页.png`;
      canvasRef.download(filename);
    }
  };

  // 下载整本绘本
  const handleDownloadAllPages = async () => {
    if (!isLoggedIn) {
      alert('下载功能需要登录后才能使用，请先登录。');
      return;
    }
    setIsDownloading(true);
    try {
      // 重要：ComicViewer 只渲染当前页 Canvas，其他页没有 ref。
      // 因此“下载整本”改为逐页离屏渲染，确保每页都包含对话气泡/旁白。
      const canvases: Array<{ canvas: HTMLCanvasElement; filename: string }> = [];
      
      for (let i = 0; i < currentComicBook.pages.length; i++) {
        const page = currentComicBook.pages[i];
        const canvas = await renderComicPageToCanvas(page); // 导出默认用原图尺寸，清晰度更好
            canvases.push({
              canvas,
              filename: `第${String(page.pageNumber).padStart(3, '0')}页.png`,
            });
      }

      const comicTitle = currentComicBook.title || currentComicBook.id.substring(0, 8);
      const zipFilename = `绘本-${comicTitle}.zip`;
      await downloadCanvasesAsZip(canvases, zipFilename);
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    } finally {
      setIsDownloading(false);
    }
  };

  // 注册Canvas ref
  const registerCanvasRef = (index: number, ref: ComicPageCanvasRef | null) => {
    if (ref) {
      canvasRefs.current.set(index, ref);
    } else {
      canvasRefs.current.delete(index);
    }
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (currentPageIndex > 0) {
          setCurrentPageIndex(currentPageIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (currentPageIndex < currentComicBook.pages.length - 1) {
          setCurrentPageIndex(currentPageIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentPageIndex, currentComicBook.pages.length]);

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* 顶部导航栏 - 现代化布局 */}
        <div className="flex flex-col lg:flex-row items-center justify-between mb-10 gap-6">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 text-sm font-bold"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            返回作品集
          </button>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                <BookOpen size={20} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight line-clamp-1">
                {currentComicBook.title || '无标题绘本'}
              </h2>
              <button
                onClick={async () => {
                  const newTitle = prompt('请输入新的绘本名称:', currentComicBook.title || '');
                  if (newTitle !== null && newTitle.trim()) {
                    const updatedComicBook = {
                      ...currentComicBook,
                      title: newTitle.trim(),
                      updatedAt: new Date().toISOString(),
                    };
                    await saveComicBookToStorage(updatedComicBook);
                    setCurrentComicBook(updatedComicBook);
                    onComicBookUpdate?.(updatedComicBook);
                  }
                }}
                className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all"
                title="重命名绘本"
              >
                <Edit3 size={16} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                PAGE {currentPageIndex + 1} / {currentComicBook.pages.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={isEditing ? handleSaveBookChanges : toggleEditMode}
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all shadow-sm hover:shadow-md active:scale-95 text-sm font-bold ${
                isEditing 
                  ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200'
              }`}
              title={isEditing ? '保存并退出' : '进入编辑模式'}
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isEditing ? (
                <Check size={18} />
              ) : (
                <Settings2 size={18} />
              )}
              <span>{isSaving ? '保存中...' : isEditing ? '保存修改' : '编辑气泡'}</span>
            </button>
            {isEditing && (
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingDialogueIndex(null);
                  setCurrentComicBook(comicBook); // 撤销未保存的修改
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm active:scale-95 text-sm font-bold"
              >
                <X size={18} />
                <span>取消</span>
              </button>
            )}
            <button
              onClick={handlePlaySpeech}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all shadow-sm hover:shadow-md active:scale-95 text-sm font-bold ${
                isPlaying 
                  ? 'bg-primary-50 border-primary-200 text-primary-600 animate-pulse' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200'
              }`}
              title={isPlaying ? "停止播放" : "语音点读"}
            >
              {isPlaying ? <Volume2 size={18} /> : <Play size={18} />}
              <span>{isPlaying ? "正在播放" : "语音点读"}</span>
            </button>
            <div className="w-px h-6 bg-slate-100 mx-1"></div>
            <button
              onClick={handleDownloadCurrentPage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 text-sm font-bold"
              title="导出当前页"
            >
              <Download size={18} />
              <span className="hidden sm:inline">导出单页</span>
            </button>
            <button
              onClick={handleDownloadAllPages}
              disabled={isDownloading}
              className="btn-primary flex items-center gap-2 !py-2.5 !px-6 !rounded-xl"
              title="打包下载整本"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  打包中...
                </>
              ) : (
                <>
                  <Archive size={18} />
                  <span>下载全集 (ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 绘本展示核心区 */}
        <div className="relative group flex flex-col lg:flex-row gap-8">
          <div className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 p-4 md:p-8 lg:p-10 border border-slate-100 relative">
          {currentPage ? (
              <div className="flex flex-col items-center max-w-5xl mx-auto space-y-8">
                <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl shadow-primary-500/10 border border-slate-100 bg-slate-50">
              <ComicPageCanvas
                ref={(ref) => registerCanvasRef(currentPageIndex, ref)}
                page={currentPage}
                    className="w-full h-auto"
              />
              
                  {/* 编辑模式下的交互层 */}
                  {isEditing && (
                    <div 
                      className="absolute inset-0 z-10 cursor-crosshair"
                      onClick={(e) => {
                        if (editingDialogueIndex === null) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / rect.width;
                        const y = (e.clientY - rect.top) / rect.height;
                        handleUpdateDialogue(editingDialogueIndex, { x_ratio: x, y_ratio: y });
                      }}
                    >
                      {currentPage.dialogue?.map((d, i) => {
                        if (typeof d !== 'object') return null;
                        return (
                          <div
                            key={i}
                            className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 flex items-center justify-center transition-all cursor-move shadow-lg ${
                              editingDialogueIndex === i 
                                ? 'bg-primary-500 border-white ring-4 ring-primary-500/30 scale-125 z-20' 
                                : 'bg-white/80 border-primary-500/50 text-primary-500 z-10'
                            }`}
                            style={{ left: `${d.x_ratio * 100}%`, top: `${d.y_ratio * 100}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDialogueIndex(i);
                            }}
                          >
                            <Move size={14} className={editingDialogueIndex === i ? 'text-white' : ''} />
                            {editingDialogueIndex === i && (
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 text-white text-[10px] rounded-full whitespace-nowrap shadow-xl">
                                    拖拽或点击画面移动气泡
                                </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* 页面解说词卡片 */}
                <div className="w-full bg-slate-50/50 rounded-3xl p-6 border border-slate-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-primary-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Story Context</span>
                    </div>
                    {isEditing && (
                        <span className="text-[10px] font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded">编辑模式</span>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={currentPage.narration || ''}
                      onChange={(e) => handleUpdateNarration(e.target.value)}
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 text-sm leading-relaxed font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                      rows={3}
                      placeholder="输入旁白内容..."
                    />
                  ) : (
                    currentPage.text && (
                      <p className="text-slate-600 text-base leading-relaxed font-medium">
                        {currentPage.text}
                      </p>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="py-32 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <ImageIcon size={40} className="text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pages to display</p>
              </div>
            )}

            {/* 悬浮侧边翻页按钮 - 桌面端 */}
            <button
                onClick={goToPreviousPage}
                disabled={currentPageIndex === 0 || isEditing}
                className="hidden lg:flex absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-slate-100 shadow-xl rounded-2xl items-center justify-center text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-0 transition-all active:scale-90 z-30"
            >
                <ChevronLeft size={32} />
            </button>
            <button
                onClick={goToNextPage}
                disabled={currentPageIndex === currentComicBook.pages.length - 1 || isEditing}
                className="hidden lg:flex absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-slate-100 shadow-xl rounded-2xl items-center justify-center text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-0 transition-all active:scale-90 z-30"
            >
                <ChevronRight size={32} />
            </button>
          </div>

          {/* 编辑侧边栏 */}
          {isEditing && (
            <div className="w-full lg:w-80 space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <Type size={18} />
                  </div>
                  <h3 className="font-black text-slate-800 tracking-tight">对白编辑</h3>
                </div>

                <div className="space-y-4">
                  {currentPage.dialogue?.map((d, i) => {
                    if (typeof d !== 'object') return null;
                    const isActive = editingDialogueIndex === i;
                    return (
                      <div 
                        key={i}
                        onClick={() => setEditingDialogueIndex(i)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-primary-50/30 border-primary-500 shadow-sm' 
                            : 'bg-slate-50/50 border-slate-100 hover:border-primary-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">
                            {d.role}
                          </span>
                          <div className="flex gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const newAnchor = d.anchor === 'left' ? 'center' : d.anchor === 'center' ? 'right' : 'left';
                                handleUpdateDialogue(i, { anchor: newAnchor });
                              }}
                              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-primary-500 transition-all"
                              title="对齐方式"
                            >
                              <div className="text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                                {d.anchor.charAt(0).toUpperCase()}
                              </div>
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={d.text}
                          onChange={(e) => handleUpdateDialogue(i, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none resize-none"
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                        💡 提示：选中气泡后，可以直接点击左侧画面中的位置进行平移。
                    </p>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* 底部现代化控制台 */}
        <div className="glass-effect !bg-white/80 rounded-[2.5rem] p-6 border border-slate-200 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <button
              onClick={goToPreviousPage}
              disabled={currentPageIndex === 0 || isEditing}
              className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm"
            >
              前一页
            </button>

            {/* 现代化缩略图指示器 */}
            <div className="flex-1 w-full overflow-x-auto py-2 scrollbar-hide">
              <div className="flex gap-3 justify-center">
                {currentComicBook.pages.map((page, index) => (
                  <button
                    key={index}
                    onClick={() => goToPage(index)}
                    className={`relative shrink-0 w-12 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 transform ${
                      index === currentPageIndex
                        ? 'border-primary-500 ring-4 ring-primary-500/10 scale-110 shadow-lg'
                        : 'border-slate-100 hover:border-primary-200 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                    }`}
                  >
                    {page.imageUrl ? (
                      <img src={page.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300">
                        {index + 1}
                      </div>
                    )}
                    {index === currentPageIndex && (
                      <div className="absolute inset-0 bg-primary-500/10 pointer-events-none"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPageIndex === currentComicBook.pages.length - 1 || isEditing}
              className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm"
            >
              下一页
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
            <Keyboard size={14} />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Pro Tip: Use arrow keys to flip pages
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
