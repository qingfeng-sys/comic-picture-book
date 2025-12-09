import fs from 'fs/promises';
import path from 'path';

/**
 * 确保存储目录存在
 */
export async function ensureStorageDir(): Promise<string> {
  const storageDir = path.join(process.cwd(), 'public', 'comic-assets');
  try {
    await fs.access(storageDir);
  } catch {
    await fs.mkdir(storageDir, { recursive: true });
  }
  return storageDir;
}

/**
 * 保存图片到存储目录
 * @param imageUrl 图片URL（可能是外部URL或base64）
 * @param pageNumber 页码
 * @param scriptId 脚本ID
 * @param segmentId 片段ID
 * @returns 保存后的本地URL、文件名和过期时间
 */
export async function saveImageToStorage(
  imageUrl: string,
  pageNumber: number,
  scriptId: string,
  segmentId: number
): Promise<{ url: string; fileName: string; expiresAt: string }> {
  try {
    let imageBuffer: Buffer;
    
    // 处理base64图片
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // 从URL下载图片
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`下载图片失败: ${imageResponse.statusText}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    const storageDir = await ensureStorageDir();

    // 生成文件名
    const timestamp = Date.now();
    const ext = imageUrl.includes('png') ? 'png' : imageUrl.includes('jpeg') || imageUrl.includes('jpg') ? 'jpg' : 'jpg';
    const fileName = `${scriptId || 'unknown'}_${segmentId || '0'}_${pageNumber}_${timestamp}.${ext}`;
    const filePath = path.join(storageDir, fileName);

    // 保存图片文件
    await fs.writeFile(filePath, imageBuffer);

    // 创建元数据文件
    const metadata = {
      fileName,
      originalUrl: imageUrl,
      pageNumber,
      scriptId,
      segmentId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
    };
    const metadataPath = path.join(storageDir, `${fileName}.meta.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // 返回公共URL
    const publicUrl = `/comic-assets/${fileName}`;

    return {
      url: publicUrl,
      fileName,
      expiresAt: metadata.expiresAt,
    };
  } catch (error) {
    console.error('保存图片失败:', error);
    throw error;
  }
}

/**
 * 清理过期的图片文件
 * @returns 删除的文件数量
 */
export async function cleanupExpiredImages(): Promise<number> {
  const storageDir = path.join(process.cwd(), 'public', 'comic-assets');
  
  try {
    await fs.access(storageDir);
  } catch {
    return 0; // 目录不存在，无需清理
  }

  const files = await fs.readdir(storageDir);
  let deletedCount = 0;
  const now = Date.now();

  for (const file of files) {
    if (file.endsWith('.meta.json')) {
      const metadataPath = path.join(storageDir, file);
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        const expiresAt = new Date(metadata.expiresAt).getTime();
        if (now > expiresAt) {
          // 删除图片文件
          const imagePath = path.join(storageDir, metadata.fileName);
          try {
            await fs.unlink(imagePath);
            console.log(`已删除过期图片: ${metadata.fileName}`);
          } catch (err: any) {
            if (err.code !== 'ENOENT') {
              console.warn(`删除图片文件失败: ${imagePath}`, err);
            }
          }

          // 删除元数据文件
          await fs.unlink(metadataPath);
          deletedCount++;
        }
      } catch (err) {
        console.warn(`处理元数据文件失败: ${file}`, err);
      }
    }
  }

  return deletedCount;
}
