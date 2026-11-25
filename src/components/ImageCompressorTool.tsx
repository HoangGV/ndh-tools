import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Download,
  Trash2,
  Eye,
  Archive,
  RefreshCw,
  ImagePlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CompressionSettings,
  MaxWidthOption,
  OutputFormat,
  ProcessedImageItem,
  compressSingleImage,
  formatFileSize,
  isSupportedImageFile,
} from '../utils/imageProcessor';
import { ImageCompareModal } from './ImageCompareModal';

const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string; hint: string }> = [
  { value: 'image/webp', label: 'WebP (Khuyên dùng)', hint: 'Nhẹ nhất, giữ độ nét cao' },
  { value: 'original', label: 'Giữ nguyên định dạng gốc', hint: 'GIF/BMP chuyển sang PNG' },
  { value: 'image/jpeg', label: 'JPEG (.jpg)', hint: 'Tương thích rộng rãi' },
  { value: 'image/png', label: 'PNG (.png)', hint: 'Không nén mất dữ liệu' },
];

const MAX_WIDTH_OPTIONS: Array<{ value: MaxWidthOption; label: string }> = [
  { value: 0, label: 'Giữ nguyên' },
  { value: 1920, label: '1920 px' },
  { value: 1280, label: '1280 px' },
  { value: 800, label: '800 px' },
];

export const ImageCompressorTool: React.FC = () => {
  const [settings, setSettings] = useState<CompressionSettings>({
    format: 'image/webp',
    quality: 82,
    maxWidth: 0,
  });

  const [items, setItems] = useState<ProcessedImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [isZipping, setIsZipping] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(
    null
  );
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [compareItem, setCompareItem] = useState<ProcessedImageItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ProcessedImageItem[]>(items);
  itemsRef.current = items;

  // Cleanup all Object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.originalUrl);
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
      });
    };
  }, []);

  const processBatch = useCallback(
    async (targetItems: ProcessedImageItem[], activeSettings: CompressionSettings) => {
      if (targetItems.length === 0) return;
      setIsProcessing(true);
      setProgress({ current: 0, total: targetItems.length });
      setSettingsDirty(false);

      for (let i = 0; i < targetItems.length; i += 1) {
        const currentItem = targetItems[i];

        setItems((prev) =>
          prev.map((it) =>
            it.id === currentItem.id ? { ...it, status: 'processing', errorMessage: undefined } : it
          )
        );

        try {
          const result = await compressSingleImage(
            currentItem.originalFile,
            currentItem.originalUrl,
            activeSettings
          );

          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== currentItem.id) return it;
              if (it.processedUrl) URL.revokeObjectURL(it.processedUrl);
              return {
                ...it,
                status: 'done',
                originalWidth: result.originalWidth,
                originalHeight: result.originalHeight,
                processedBlob: result.blob,
                processedUrl: result.url,
                processedSize: result.blob.size,
                processedWidth: result.width,
                processedHeight: result.height,
                outputFileName: result.outputFileName,
                outputMime: result.outputMime,
                errorMessage: undefined,
              };
            })
          );
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Đã xảy ra lỗi khi xử lý ảnh này.';
          setItems((prev) =>
            prev.map((it) =>
              it.id === currentItem.id ? { ...it, status: 'error', errorMessage: message } : it
            )
          );
        }

        setProgress({ current: i + 1, total: targetItems.length });
      }

      setIsProcessing(false);
    },
    []
  );

  const handleFilesAdded = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const validFiles: File[] = [];
      const rejectedNames: string[] = [];

      for (const file of files) {
        if (isSupportedImageFile(file)) {
          validFiles.push(file);
        } else {
          rejectedNames.push(file.name);
        }
      }

      if (rejectedNames.length > 0) {
        setNotice({
          type: 'error',
          text: `Đã bỏ qua ${rejectedNames.length} tệp không hỗ trợ (${rejectedNames
            .slice(0, 3)
            .join(', ')}${rejectedNames.length > 3 ? '...' : ''}). Chỉ hỗ trợ JPG, PNG, WebP, GIF, BMP.`,
        });
      } else {
        setNotice(null);
      }

      if (validFiles.length === 0) return;

      const newItems: ProcessedImageItem[] = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        originalSize: file.size,
        originalWidth: 0,
        originalHeight: 0,
        status: 'pending',
        outputFileName: file.name,
        outputMime: file.type || 'image/png',
      }));

      setItems((prev) => [...prev, ...newItems]);
      await processBatch(newItems, settings);
    },
    [processBatch, settings]
  );

  const handleReprocessAll = async () => {
    if (items.length === 0 || isProcessing) return;
    setNotice(null);
    await processBatch(items, settings);
  };

  const handleSettingChange = <K extends keyof CompressionSettings>(
    key: K,
    value: CompressionSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (items.length > 0) {
      setSettingsDirty(true);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.processedUrl) URL.revokeObjectURL(target.processedUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
    if (compareItem?.id === id) {
      setCompareItem(null);
    }
  };

  const handleClearAll = () => {
    items.forEach((it) => {
      URL.revokeObjectURL(it.originalUrl);
      if (it.processedUrl) URL.revokeObjectURL(it.processedUrl);
    });
    setItems([]);
    setCompareItem(null);
    setSettingsDirty(false);
    setNotice(null);
  };

  const handleDownloadSingle = (item: ProcessedImageItem) => {
    if (!item.processedUrl) return;
    const link = document.createElement('a');
    link.href = item.processedUrl;
    link.download = item.outputFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadZip = async () => {
    const doneItems = items.filter((it) => it.status === 'done' && it.processedBlob);
    if (doneItems.length === 0 || isZipping) return;

    setIsZipping(true);
    setNotice(null);
    try {
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const item of doneItems) {
        if (!item.processedBlob) continue;
        let fileName = item.outputFileName;
        const count = usedNames.get(fileName) ?? 0;
        if (count > 0) {
          const lastDot = fileName.lastIndexOf('.');
          const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
          const ext = lastDot > 0 ? fileName.slice(lastDot) : '';
          fileName = `${base} (${count})${ext}`;
        }
        usedNames.set(item.outputFileName, count + 1);
        zip.file(fileName, item.processedBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `ndh-tools-anh-da-nen-${doneItems.length}-tep.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);
    } catch {
      setNotice({
        type: 'error',
        text: 'Không thể đóng gói tệp ZIP. Vui lòng thử tải từng ảnh riêng lẻ.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  const completedItems = items.filter((it) => it.status === 'done');
  const totalOriginalBytes = completedItems.reduce((sum, it) => sum + it.originalSize, 0);
  const totalProcessedBytes = completedItems.reduce(
    (sum, it) => sum + (it.processedSize ?? 0),
    0
  );
  const totalSavedBytes = totalOriginalBytes - totalProcessedBytes;
  const totalSavedPercent =
    totalOriginalBytes > 0 ? (totalSavedBytes / totalOriginalBytes) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            Nén & Chuyển đổi định dạng ảnh hàng loạt
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tối ưu dung lượng và đổi định dạng ảnh ngay trên trình duyệt, không tải dữ liệu lên máy chủ.
          </p>
        </div>
      </div>

      {/* Settings Bar + Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Settings Surface */}
        <section
          aria-label="Thông số nén ảnh"
          className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#4169E1]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Thông số xử lý
              </h2>
            </div>
            {settingsDirty && items.length > 0 && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Chưa áp dụng
              </span>
            )}
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <label
              htmlFor="img-format-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Định dạng đầu ra
            </label>
            <select
              id="img-format-select"
              value={settings.format}
              onChange={(e) => handleSettingChange('format', e.target.value as OutputFormat)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {FORMAT_OPTIONS.find((o) => o.value === settings.format)?.hint}
            </p>
          </div>

          {/* Quality Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="img-quality-range"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Chất lượng nén
              </label>
              <span className="text-sm font-mono font-semibold tabular-nums text-[#4169E1]">
                {settings.quality}%
              </span>
            </div>
            <input
              id="img-quality-range"
              type="range"
              min={10}
              max={100}
              step={1}
              value={settings.quality}
              onChange={(e) => handleSettingChange('quality', Number(e.target.value))}
              className="royal-slider w-full bg-slate-200 dark:bg-slate-700"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span>10% (Nhẹ nhất)</span>
              <span>82% (Tối ưu)</span>
              <span>100% (Gốc)</span>
            </div>
            {settings.format === 'image/png' && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Lưu ý: PNG nén không mất dữ liệu nên thanh chất lượng ít làm giảm dung lượng. Chọn WebP để giảm dung lượng tốt nhất.
              </p>
            )}
          </div>

          {/* Max Width Resize */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Giới hạn chiều rộng tối đa
            </span>
            <div className="grid grid-cols-2 gap-2">
              {MAX_WIDTH_OPTIONS.map((opt) => {
                const active = settings.maxWidth === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSettingChange('maxWidth', opt.value)}
                    className={`h-10 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#4169E1] text-white border-[#4169E1]'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tự động giữ nguyên tỷ lệ khung hình, không phóng to ảnh nhỏ hơn giới hạn.
            </p>
          </div>

          {/* Reprocess Button */}
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleReprocessAll}
              disabled={isProcessing}
              className={`w-full h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                settingsDirty
                  ? 'bg-[#4169E1] hover:bg-[#3358CC] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>
                {isProcessing
                  ? `Đang xử lý (${progress.current}/${progress.total})...`
                  : settingsDirty
                    ? 'Áp dụng thông số & Nén lại'
                    : 'Nén lại tất cả ảnh'}
              </span>
            </button>
          )}
        </section>

        {/* Right: Upload Area & Results */}
        <div className="lg:col-span-8 space-y-5">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                void handleFilesAdded(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Kéo thả hoặc nhấn để chọn nhiều ảnh"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                void handleFilesAdded(e.dataTransfer.files);
              }
            }}
            className={`group rounded-xl border-2 border-dashed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
              items.length > 0 ? 'p-6' : 'p-10 sm:p-14'
            } ${
              isDragging
                ? 'border-[#4169E1] bg-[#4169E1]/8 dark:bg-[#4169E1]/15'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#4169E1]/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-[#4169E1]/10 dark:bg-[#4169E1]/20 text-[#4169E1] flex items-center justify-center mb-3 transition-transform group-hover:scale-105">
                {items.length > 0 ? (
                  <ImagePlus className="w-6 h-6" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {items.length > 0
                  ? 'Kéo thả hoặc nhấn để thêm ảnh vào danh sách'
                  : 'Kéo thả nhiều ảnh vào đây hoặc nhấn để chọn tệp'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Hỗ trợ JPG, PNG, WebP, GIF, BMP · Xử lý hàng loạt không giới hạn số lượng
              </p>
            </div>
          </div>

          {/* Notice Banner */}
          {notice && (
            <div
              role="alert"
              className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
                notice.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
                  : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{notice.text}</span>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && progress.total > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4169E1]" />
                  Đang nén và chuyển đổi ảnh...
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {progress.current} / {progress.total} ảnh (
                  {Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4169E1] transition-all duration-200"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Surface */}
          {items.length > 0 && (
            <section
              aria-label="Danh sách ảnh đã xử lý"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
            >
              {/* Batch Summary Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Kết quả xử lý ({items.length} ảnh)
                  </h2>
                  {completedItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{formatFileSize(totalOriginalBytes)}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {formatFileSize(totalProcessedBytes)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          totalSavedBytes >= 0
                            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                            : 'font-semibold text-amber-600 dark:text-amber-400'
                        }
                      >
                        {totalSavedBytes >= 0
                          ? `Tiết kiệm ${formatFileSize(totalSavedBytes)} (-${totalSavedPercent.toFixed(1)}%)`
                          : `Tăng ${formatFileSize(Math.abs(totalSavedBytes))} (+${Math.abs(totalSavedPercent).toFixed(1)}%)`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tất cả</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={completedItems.length === 0 || isProcessing || isZipping}
                    className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-[#4169E1] hover:bg-[#3358CC] text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isZipping ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Archive className="w-3.5 h-3.5" />
                    )}
                    <span>{isZipping ? 'Đang tạo ZIP...' : 'Tải tất cả (.ZIP)'}</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((item) => {
                  const savedPct =
                    item.processedSize !== undefined && item.originalSize > 0
                      ? ((item.originalSize - item.processedSize) / item.originalSize) * 100
                      : 0;

                  return (
                    <div
                      key={item.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Thumbnail + Info */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 checkerboard-bg shrink-0 flex items-center justify-center">
                          <img
                            src={item.processedUrl || item.originalUrl}
                            alt={item.outputFileName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
                            title={item.outputFileName}
                          >
                            {item.outputFileName}
                          </p>

                          {item.status === 'processing' && (
                            <p className="mt-0.5 text-xs text-[#4169E1] inline-flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Đang xử lý...
                            </p>
                          )}

                          {item.status === 'pending' && (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              Đang chờ xử lý...
                            </p>
                          )}

                          {item.status === 'error' && (
                            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.errorMessage}</span>
                            </p>
                          )}

                          {item.status === 'done' && item.processedSize !== undefined && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              <span>{formatFileSize(item.originalSize)}</span>
                              <span aria-hidden="true">➔</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {formatFileSize(item.processedSize)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {item.processedWidth}×{item.processedHeight}px
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                  savedPct >= 0
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {savedPct >= 0 && <CheckCircle2 className="w-3 h-3" />}
                                {savedPct >= 0
                                  ? `-${savedPct.toFixed(1)}%`
                                  : `+${Math.abs(savedPct).toFixed(1)}%`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row Actions */}
                      <div className="flex items-center gap-1.5 sm:justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => setCompareItem(item)}
                          disabled={item.status !== 'done'}
                          title="Xem trước & so sánh trước/sau"
                          className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>So sánh</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(item)}
                          disabled={item.status !== 'done'}
                          className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-[#4169E1]/10 text-[#4169E1] hover:bg-[#4169E1] hover:text-white dark:bg-[#4169E1]/20 dark:text-blue-300 dark:hover:bg-[#4169E1] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải về</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Xóa ${item.outputFileName}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Interactive Before/After Comparison Modal */}
      <ImageCompareModal
        item={compareItem}
        onClose={() => setCompareItem(null)}
        onDownload={handleDownloadSingle}
      />
    </div>
  );
};
