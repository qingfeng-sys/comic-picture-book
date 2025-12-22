'use client';

import { useState, useEffect, useRef } from 'react';
import { ComicBook } from '@/types';
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
  Image as ImageIcon
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
  const canvasRefs = useRef<Map<number, ComicPageCanvasRef>>(new Map());
  const currentPage = currentComicBook.pages[currentPageIndex];

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
        <div className="relative group">
          <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 p-4 md:p-8 lg:p-12 mb-10 border border-slate-100">
            {currentPage ? (
              <div className="flex flex-col items-center max-w-5xl mx-auto space-y-10">
                <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl shadow-primary-500/10 border border-slate-100">
                  <ComicPageCanvas
                    ref={(ref) => registerCanvasRef(currentPageIndex, ref)}
                    page={currentPage}
                    className="w-full h-auto"
                  />
                </div>
                
                {/* 页面解说词卡片 */}
                <div className="w-full bg-slate-50/50 rounded-3xl p-8 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-primary-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Story Context</span>
                  </div>
                  {currentPage.text && (
                    <p className="text-slate-600 text-base leading-relaxed font-medium">
                      {currentPage.text}
                    </p>
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
          </div>

          {/* 悬浮侧边翻页按钮 - 桌面端 */}
          <button
            onClick={goToPreviousPage}
            disabled={currentPageIndex === 0}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-slate-100 shadow-xl rounded-2xl items-center justify-center text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-0 transition-all active:scale-90"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={goToNextPage}
            disabled={currentPageIndex === currentComicBook.pages.length - 1}
            className="hidden lg:flex absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white border border-slate-100 shadow-xl rounded-2xl items-center justify-center text-slate-400 hover:text-primary-600 hover:border-primary-200 disabled:opacity-0 transition-all active:scale-90"
          >
            <ChevronRight size={32} />
          </button>
        </div>

        {/* 底部现代化控制台 */}
        <div className="glass-effect !bg-white/80 rounded-[2.5rem] p-6 border border-slate-200 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <button
              onClick={goToPreviousPage}
              disabled={currentPageIndex === 0}
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
              disabled={currentPageIndex === currentComicBook.pages.length - 1}
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
