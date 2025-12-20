import fs from 'fs/promises';
import path from 'path';
import OSS from 'ali-oss';

/**
 * 存储结果接口
 */
export interface StorageResult {
  url: string;
  fileName: string;
  ossKey?: string;
  expiresAt: string;
}

/**
 * 存储适配器接口
 */
interface StorageAdapter {
  saveImage(buffer: Buffer, fileName: string, metadata: any): Promise<StorageResult>;
  cleanupExpired(): Promise<number>;
}

/**
 * 本地存储适配器实现
 */
class LocalStorageAdapter implements StorageAdapter {
  private storageDir = path.join(process.cwd(), 'public', 'comic-assets');

  private async ensureDir() {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  async saveImage(buffer: Buffer, fileName: string, metadata: any): Promise<StorageResult> {
    await this.ensureDir();
    const filePath = path.join(this.storageDir, fileName);
    await fs.writeFile(filePath, buffer);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const metaDataWithExpiry = {
      ...metadata,
      fileName,
      expiresAt,
    };

    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metaDataWithExpiry, null, 2));

    return {
      url: `/comic-assets/${fileName}`,
      fileName,
      expiresAt,
    };
  }

  async cleanupExpired(): Promise<number> {
    try {
      await fs.access(this.storageDir);
    } catch {
      return 0;
    }

    const files = await fs.readdir(this.storageDir);
    let deletedCount = 0;
    const now = Date.now();

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metadataPath = path.join(this.storageDir, file);
        try {
          const content = await fs.readFile(metadataPath, 'utf-8');
          const meta = JSON.parse(content);
          if (new Date(meta.expiresAt).getTime() < now) {
            const imagePath = path.join(this.storageDir, meta.fileName);
            await fs.unlink(imagePath).catch(() => {});
            await fs.unlink(metadataPath).catch(() => {});
            deletedCount++;
          }
        } catch {}
      }
    }
    return deletedCount;
  }
}

/**
 * 阿里云 OSS 存储适配器实现
 */
class OssStorageAdapter implements StorageAdapter {
  private client: OSS;
  private bucket: string;

  constructor() {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    this.bucket = process.env.OSS_BUCKET || '';

    if (!region || !accessKeyId || !accessKeySecret || !this.bucket) {
      throw new Error('OSS 配置缺失，请检查环境变量');
    }

    this.client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket: this.bucket,
      secure: true,
    });
  }

  async saveImage(buffer: Buffer, fileName: string, metadata: any): Promise<StorageResult> {
    // 默认存储在 oss 的 comic-assets 目录下
    const ossKey = `comic-assets/${fileName}`;
    
    const result = await this.client.put(ossKey, buffer, {
      meta: metadata,
      headers: {
        'Cache-Control': 'max-age=31536000',
      }
    });

    return {
      url: result.url,
      fileName,
      ossKey,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // OSS 默认一年（或永不过期）
    };
  }

  async cleanupExpired(): Promise<number> {
    // OSS 通常不需要手动清理过期文件，可以配置生命周期规则
    // 这里仅做日志记录或占位
    console.log('[OSS] 建议在阿里云控制台配置生命周期规则 (Lifecycle) 来自动清理过期图片');
    return 0;
  }
}

/**
 * 获取当前存储适配器
 */
function getStorageAdapter(): StorageAdapter {
  if (process.env.STORAGE_TYPE === 'oss' || (process.env.OSS_ACCESS_KEY_ID && process.env.NODE_ENV === 'production')) {
    try {
      return new OssStorageAdapter();
    } catch (e) {
      console.warn('切换 OSS 失败，回退到本地存储:', (e as Error).message);
      return new LocalStorageAdapter();
    }
  }
  return new LocalStorageAdapter();
}

/**
 * 统一导出方法
 */
export async function saveImageToStorage(
  imageUrl: string,
  pageNumber: number,
  scriptId: string,
  segmentId: number
): Promise<StorageResult> {
  try {
    let imageBuffer: Buffer;
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`下载图片失败: ${resp.statusText}`);
      imageBuffer = Buffer.from(await resp.arrayBuffer());
    }

    const ext = imageUrl.includes('png') ? 'png' : 'jpg';
    const timestamp = Date.now();
    const fileName = `${scriptId || 'unknown'}_${segmentId || 0}_${pageNumber}_${timestamp}.${ext}`;

    const metadata = {
      originalUrl: imageUrl.startsWith('data:') ? 'base64' : imageUrl,
      pageNumber,
      scriptId,
      segmentId,
      createdAt: new Date().toISOString(),
    };

    const adapter = getStorageAdapter();
    return await adapter.saveImage(imageBuffer, fileName, metadata);
  } catch (error) {
    console.error('保存图片失败:', error);
    throw error;
  }
}

export async function cleanupExpiredImages(): Promise<number> {
  const adapter = getStorageAdapter();
  return await adapter.cleanupExpired();
}

// 导出确保目录存在的函数（仅本地存储需要，保留以向后兼容）
export async function ensureStorageDir(): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'comic-assets');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
