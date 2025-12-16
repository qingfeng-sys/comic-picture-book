'use client';

import { useState, useEffect, useRef } from 'react';
import { ComicBook } from '@/types';
import ComicPageCanvas, { ComicPageCanvasRef } from '@/components/ComicPageCanvas/ComicPageCanvas';
import { downloadCanvasesAsZip } from '@/lib/downloadUtils';
import { saveComicBookToStorage } from '@/lib/scriptUtils';
import { renderComicPageToCanvas } from '@/lib/comicPageRenderer';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50 py-4 sm:py-6 lg:py-8">
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        {/* 顶部导航栏 */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <button
            onClick={onBack}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200 font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-xs sm:text-sm w-full sm:w-auto"
          >
            ← 返回
          </button>
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent line-clamp-1">
                📖 {currentComicBook.title || '绘本查看'}
              </h2>
              <button
                onClick={() => {
                  const newTitle = prompt('请输入新的绘本名称:', currentComicBook.title || '');
                  if (newTitle !== null && newTitle.trim()) {
                    const updatedComicBook = {
                      ...currentComicBook,
                      title: newTitle.trim(),
                      updatedAt: new Date().toISOString(),
                    };
                    saveComicBookToStorage(updatedComicBook);
                    setCurrentComicBook(updatedComicBook);
                    if (onComicBookUpdate) {
                      onComicBookUpdate(updatedComicBook);
                    }
                  }
                }}
                className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm"
                title="重命名绘本"
              >
                ✏️
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              第 {currentPageIndex + 1} 页 / 共 {currentComicBook.pages.length} 页
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadCurrentPage}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-xs sm:text-sm"
              title="下载当前页"
            >
              ⬇️ <span className="hidden sm:inline">下载当前页</span>
            </button>
            <button
              onClick={handleDownloadAllPages}
              disabled={isDownloading}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              title="下载整本绘本"
            >
              {isDownloading ? '⏳ 打包中...' : (
                <span>📦 <span className="hidden sm:inline">下载整本</span></span>
              )}
            </button>
          </div>
        </div>

        {/* 绘本页面显示区域 */}
        <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6 border-2 border-purple-200">
          {currentPage ? (
            <div className="flex flex-col items-center">
              <ComicPageCanvas
                ref={(ref) => registerCanvasRef(currentPageIndex, ref)}
                page={currentPage}
                className="w-full max-w-4xl"
              />
              
              {/* 页面信息 */}
              <div className="mt-4 w-full max-w-4xl">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    <span className="text-purple-600 font-bold">第 {currentPage.pageNumber} 页</span>
                  </p>
                  {currentPage.text && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentPage.text}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📖</div>
              <p className="text-gray-600">没有可显示的页面</p>
            </div>
          )}
        </div>

        {/* 底部控制栏 */}
        <div className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4 border-2 border-purple-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            {/* 上一页按钮 */}
            <button
              onClick={goToPreviousPage}
              disabled={currentPageIndex === 0}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs sm:text-sm lg:text-base"
            >
              ← 上一页
            </button>

            {/* 页面缩略图导航 */}
            <div className="flex-1 w-full sm:w-auto mx-0 sm:mx-4 lg:mx-6 overflow-x-auto">
              <div className="flex gap-1 sm:gap-2 justify-center">
                {currentComicBook.pages.map((page, index) => (
                  <button
                    key={index}
                    onClick={() => goToPage(index)}
                    className={`flex-shrink-0 w-12 h-14 sm:w-14 sm:h-18 lg:w-16 lg:h-20 rounded-md sm:rounded-lg overflow-hidden border-2 transition-all transform hover:scale-110 ${
                      index === currentPageIndex
                        ? 'border-purple-500 shadow-lg scale-110'
                        : 'border-gray-300 hover:border-purple-300'
                    }`}
                  >
                    {page.imageUrl ? (
                      <img
                        src={page.imageUrl}
                        alt={`第${page.pageNumber}页`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-200 text-xs">📖</div>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200 text-xs">
                        📖
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 下一页按钮 */}
            <button
              onClick={goToNextPage}
              disabled={currentPageIndex === currentComicBook.pages.length - 1}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs sm:text-sm lg:text-base"
            >
              下一页 →
            </button>
          </div>

          {/* 键盘快捷键提示 */}
          <div className="mt-3 sm:mt-4 text-center text-xs text-gray-500">
            <p className="hidden sm:block">💡 提示：使用 ← → 方向键可以翻页</p>
          </div>
        </div>
      </div>
    </div>
  );
}
