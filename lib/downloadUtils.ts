/**
 * 下载工具函数库
 */

/**
 * 从URL下载图片
 */
export async function downloadImageFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
}

/**
 * 从Canvas下载图片
 */
export function downloadImageFromCanvas(canvas: HTMLCanvasElement, filename: string): void {
  try {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Canvas转换失败');
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 'image/png');
  } catch (error) {
    console.error('从Canvas下载图片失败:', error);
    throw error;
  }
}

/**
 * 下载多个图片并打包成ZIP
 * 注意：需要动态导入JSZip库
 */
export async function downloadImagesAsZip(
  images: Array<{ url: string; filename: string }>,
  zipFilename: string = 'comic-book.zip'
): Promise<void> {
  try {
    // 动态导入JSZip（如果未安装，将使用替代方案）
    let JSZip: any;
    try {
      JSZip = (await import('jszip')).default;
    } catch (error) {
      // 如果JSZip未安装，使用替代方案：逐个下载
      console.warn('JSZip未安装，将逐个下载图片');
      for (const image of images) {
        await downloadImageFromUrl(image.url, image.filename);
        // 添加小延迟避免浏览器阻止多个下载
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return;
    }

    const zip = new JSZip();
    
    // 下载所有图片并添加到ZIP
    const downloadPromises = images.map(async (image) => {
      try {
        const response = await fetch(image.url);
        if (!response.ok) {
          throw new Error(`下载 ${image.filename} 失败`);
        }
        const blob = await response.blob();
        zip.file(image.filename, blob);
      } catch (error) {
        console.error(`下载图片 ${image.filename} 失败:`, error);
      }
    });

    await Promise.all(downloadPromises);

    // 生成ZIP文件并下载
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('打包下载失败:', error);
    throw error;
  }
}

/**
 * 从Canvas数组下载并打包成ZIP
 */
export async function downloadCanvasesAsZip(
  canvases: Array<{ canvas: HTMLCanvasElement; filename: string }>,
  zipFilename: string = 'comic-book.zip'
): Promise<void> {
  try {
    // 动态导入JSZip
    let JSZip: any;
    try {
      JSZip = (await import('jszip')).default;
    } catch (error) {
      // 如果JSZip未安装，逐个下载
      console.warn('JSZip未安装，将逐个下载图片');
      for (const item of canvases) {
        downloadImageFromCanvas(item.canvas, item.filename);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return;
    }

    const zip = new JSZip();

    // 将所有Canvas转换为Blob并添加到ZIP
    const promises = canvases.map((item) => {
      return new Promise<void>((resolve, reject) => {
        item.canvas.toBlob((blob) => {
          if (blob) {
            zip.file(item.filename, blob);
            resolve();
          } else {
            reject(new Error(`Canvas转换失败: ${item.filename}`));
          }
        }, 'image/png');
      });
    });

    await Promise.all(promises);

    // 生成ZIP文件并下载
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('打包下载Canvas失败:', error);
    throw error;
  }
}
