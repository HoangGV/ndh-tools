import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker via CDN matching the exact installed pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PdfPageThumb {
  pageNumber: number; // 1-based
  thumbnailUrl: string;
  selected: boolean;
  extraRotation: number; // 0 | 90 | 180 | 270
  width: number;
  height: number;
}

export interface MergePdfItem {
  id: string;
  file: File;
  bytes: Uint8Array;
  name: string;
  size: number;
  pageCount: number;
  coverUrl: string;
}

export function translatePdfError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === 'string'
        ? err
        : '';
  const lower = raw.toLowerCase();

  if (
    lower.includes('password') ||
    lower.includes('encrypt') ||
    lower.includes('passwordexception')
  ) {
    return 'Tệp PDF này đang bị khóa mật khẩu (mã hóa). Vui lòng mở khóa mật khẩu trước khi tải lên.';
  }
  if (
    lower.includes('invalid pdf') ||
    lower.includes('invalidpdfexception') ||
    lower.includes('failed to parse') ||
    lower.includes('no pdf header') ||
    lower.includes('missing pdf') ||
    lower.includes('formaterror')
  ) {
    return 'Tệp PDF bị hỏng hoặc không đúng định dạng hợp lệ. Vui lòng kiểm tra lại tệp.';
  }
  if (lower.includes('worker') || lower.includes('network') || lower.includes('fetch')) {
    return 'Không thể tải trình kết xuất PDF. Vui lòng kiểm tra kết nối mạng và thử lại.';
  }
  return 'Không thể đọc hoặc xử lý tệp PDF này. Vui lòng thử lại với tệp khác.';
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Parses a page range expression like "1-3, 5, 8-10" into a 1-based set of page numbers.
 */
export function parsePageRangeInput(
  input: string,
  maxPages: number
): { pages: Set<number>; invalidTokens: string[] } {
  const pages = new Set<number>();
  const invalidTokens: string[] = [];

  const tokens = input
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10);
      const b = parseInt(rangeMatch[2], 10);
      const start = Math.min(a, b);
      const end = Math.max(a, b);

      if (start < 1 || end > maxPages) {
        invalidTokens.push(token);
        continue;
      }
      for (let p = start; p <= end; p += 1) {
        pages.add(p);
      }
      continue;
    }

    const singleMatch = token.match(/^(\d+)$/);
    if (singleMatch) {
      const p = parseInt(singleMatch[1], 10);
      if (p < 1 || p > maxPages) {
        invalidTokens.push(token);
      } else {
        pages.add(p);
      }
      continue;
    }

    invalidTokens.push(token);
  }

  return { pages, invalidTokens };
}

async function renderPageToDataUrl(
  pdfDocProxy: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
  extraRotation = 0
): Promise<{ dataUrl: string; width: number; height: number }> {
  const page = await pdfDocProxy.getPage(pageNumber);
  const baseViewport = page.getViewport({
    scale: 1,
    rotation: (page.rotate + extraRotation) % 360,
  });

  const scale = Math.min(2.2, Math.max(0.25, targetWidth / Math.max(1, baseViewport.width)));
  const viewport = page.getViewport({
    scale,
    rotation: (page.rotate + extraRotation) % 360,
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
  page.cleanup();

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Validates a PDF file with pdf-lib (catching encrypted/corrupt files early)
 * and renders thumbnail previews of every page using pdfjs-dist.
 */
export async function loadPdfForSplit(
  file: File,
  onProgress?: (rendered: number, total: number) => void
): Promise<{ bytes: Uint8Array; pageCount: number; pages: PdfPageThumb[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Verify structure and encryption via pdf-lib first
  const pdfLibDoc = await PDFDocument.load(bytes);
  const totalPages = pdfLibDoc.getPageCount();
  if (totalPages === 0) {
    throw new Error('Tệp PDF không có trang nào.');
  }

  // Pass a copied Uint8Array to pdfjs-dist so its worker transfer never detaches our main bytes
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdfProxy = await loadingTask.promise;

  const pages: PdfPageThumb[] = [];
  try {
    for (let i = 1; i <= totalPages; i += 1) {
      const rendered = await renderPageToDataUrl(pdfProxy, i, 260, 0);
      pages.push({
        pageNumber: i,
        thumbnailUrl: rendered.dataUrl,
        selected: true,
        extraRotation: 0,
        width: rendered.width,
        height: rendered.height,
      });
      onProgress?.(i, totalPages);
    }
  } finally {
    await loadingTask.destroy();
  }

  return {
    bytes,
    pageCount: totalPages,
    pages,
  };
}

/**
 * Renders a high-resolution preview of a single page for the zoom modal.
 */
export async function renderHighResPdfPage(
  bytes: Uint8Array,
  pageNumber: number,
  extraRotation: number
): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdfProxy = await loadingTask.promise;
  try {
    const rendered = await renderPageToDataUrl(pdfProxy, pageNumber, 1100, extraRotation);
    return rendered.dataUrl;
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Validates a PDF file and renders page 1 cover thumbnail for the Merge queue.
 */
export async function loadPdfForMerge(file: File): Promise<MergePdfItem> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const pdfLibDoc = await PDFDocument.load(bytes);
  const pageCount = pdfLibDoc.getPageCount();
  if (pageCount === 0) {
    throw new Error(`Tệp "${file.name}" không có trang nào.`);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdfProxy = await loadingTask.promise;
  let coverUrl = '';
  try {
    const cover = await renderPageToDataUrl(pdfProxy, 1, 140, 0);
    coverUrl = cover.dataUrl;
  } finally {
    await loadingTask.destroy();
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    bytes,
    name: file.name,
    size: file.size,
    pageCount,
    coverUrl,
  };
}

/**
 * Exports selected pages (with optional extra rotations) into a single lossless PDF Blob.
 */
export async function exportSelectedPagesAsPdf(
  sourceBytes: Uint8Array,
  selectedPages: Array<{ pageNumber: number; extraRotation: number }>
): Promise<Blob> {
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const outputDoc = await PDFDocument.create();

  const indices = selectedPages.map((p) => p.pageNumber - 1);
  const copiedPages = await outputDoc.copyPages(sourceDoc, indices);

  copiedPages.forEach((page, idx) => {
    const extraRot = selectedPages[idx].extraRotation;
    if (extraRot !== 0) {
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + extraRot) % 360));
    }
    outputDoc.addPage(page);
  });

  const savedBytes = await outputDoc.save();
  return new Blob([new Uint8Array(savedBytes)], { type: 'application/pdf' });
}

/**
 * Splits each selected page into its own standalone PDF (trang-1.pdf, trang-2.pdf...)
 * and bundles them inside a single ZIP Blob.
 */
export async function exportSelectedPagesAsZip(
  sourceBytes: Uint8Array,
  selectedPages: Array<{ pageNumber: number; extraRotation: number }>
): Promise<Blob> {
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const zip = new JSZip();

  for (const item of selectedPages) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(sourceDoc, [item.pageNumber - 1]);
    if (item.extraRotation !== 0) {
      const currentAngle = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentAngle + item.extraRotation) % 360));
    }
    singleDoc.addPage(copiedPage);
    const pdfBytes = await singleDoc.save();
    zip.file(`trang-${item.pageNumber}.pdf`, pdfBytes);
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Merges multiple PDF files in order into one lossless PDF Blob.
 */
export async function mergePdfFiles(items: MergePdfItem[]): Promise<Blob> {
  const mergedDoc = await PDFDocument.create();

  for (const item of items) {
    const srcDoc = await PDFDocument.load(item.bytes);
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((p) => mergedDoc.addPage(p));
  }

  const savedBytes = await mergedDoc.save();
  return new Blob([new Uint8Array(savedBytes)], { type: 'application/pdf' });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
