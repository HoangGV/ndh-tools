export type OutputFormat = 'original' | 'image/webp' | 'image/jpeg' | 'image/png';

export type MaxWidthOption = 0 | 1920 | 1280 | 800;

export interface CompressionSettings {
  format: OutputFormat;
  quality: number; // 10 - 100
  maxWidth: MaxWidthOption;
}

export interface ProcessedImageItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  processedBlob?: Blob;
  processedUrl?: string;
  processedSize?: number;
  processedWidth?: number;
  processedHeight?: number;
  outputFileName: string;
  outputMime: string;
}

export const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

export function isSupportedImageFile(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return true;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function resolveOutputMime(originalType: string, targetFormat: OutputFormat): string {
  if (targetFormat !== 'original') {
    return targetFormat;
  }
  const normalized = originalType.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'image/webp') return 'image/webp';
  if (normalized === 'image/png') return 'image/png';
  // Canvas cannot natively encode GIF/BMP; fall back to PNG to preserve lossless fidelity
  return 'image/png';
}

export function getExtensionForMime(mime: string): string {
  switch (mime) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    default:
      return 'png';
  }
}

export function buildOutputFileName(originalName: string, outputMime: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const ext = getExtensionForMime(outputMime);
  return `${baseName}.${ext}`;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh. Tệp có thể bị hỏng hoặc không đúng định dạng.'));
    img.src = src;
  });
}

export async function compressSingleImage(
  file: File,
  originalUrl: string,
  settings: CompressionSettings
): Promise<{
  blob: Blob;
  url: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  outputMime: string;
  outputFileName: string;
}> {
  const img = await loadImageElement(originalUrl);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  if (originalWidth === 0 || originalHeight === 0) {
    throw new Error('Ảnh không có kích thước hợp lệ.');
  }

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (settings.maxWidth > 0 && originalWidth > settings.maxWidth) {
    const ratio = settings.maxWidth / originalWidth;
    targetWidth = settings.maxWidth;
    targetHeight = Math.max(1, Math.round(originalHeight * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ xử lý Canvas 2D.');
  }

  const outputMime = resolveOutputMime(file.type, settings.format);

  // Fill white background when exporting to JPEG so transparent areas do not render black
  if (outputMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const qualityFloat = Math.min(1, Math.max(0.1, settings.quality / 100));

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Không thể tạo tệp ảnh nén. Vui lòng thử định dạng khác.'));
          return;
        }
        resolve(result);
      },
      outputMime,
      outputMime === 'image/png' ? undefined : qualityFloat
    );
  });

  const url = URL.createObjectURL(blob);
  const outputFileName = buildOutputFileName(file.name, outputMime);

  return {
    blob,
    url,
    originalWidth,
    originalHeight,
    width: targetWidth,
    height: targetHeight,
    outputMime,
    outputFileName,
  };
}
