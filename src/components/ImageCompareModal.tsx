import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, MoveHorizontal } from 'lucide-react';
import { ProcessedImageItem, formatFileSize } from '../utils/imageProcessor';

interface ImageCompareModalProps {
  item: ProcessedImageItem | null;
  onClose: () => void;
  onDownload: (item: ProcessedImageItem) => void;
}

export const ImageCompareModal: React.FC<ImageCompareModalProps> = ({
  item,
  onClose,
  onDownload,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50);

  useEffect(() => {
    setSliderPos(50);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, percent)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, percent)));
  }, []);

  if (!item || !item.processedUrl) return null;

  const savedPercent =
    item.processedSize !== undefined && item.originalSize > 0
      ? ((item.originalSize - item.processedSize) / item.originalSize) * 100
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h3
              id="compare-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
            >
              So sánh trước & sau nén — {item.outputFileName}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>
                Gốc: {formatFileSize(item.originalSize)} ({item.originalWidth}×{item.originalHeight})
              </span>
              <span aria-hidden="true">→</span>
              <span>
                Sau nén: {formatFileSize(item.processedSize ?? 0)} ({item.processedWidth}×
                {item.processedHeight})
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  savedPercent >= 0
                    ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'font-semibold text-amber-600 dark:text-amber-400'
                }
              >
                {savedPercent >= 0
                  ? `Giảm ${savedPercent.toFixed(1)}%`
                  : `Tăng ${Math.abs(savedPercent).toFixed(1)}%`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ so sánh"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Split Comparison Viewport */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          <div
            className="relative w-full h-[52vh] min-h-[280px] max-h-[540px] checkerboard-bg rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden select-none touch-none cursor-ew-resize"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            {/* Right / Base layer: Compressed */}
            <img
              src={item.processedUrl}
              alt={`Ảnh sau nén: ${item.outputFileName}`}
              referrerPolicy="no-referrer"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Left / Clipped layer: Original */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img
                src={item.originalUrl}
                alt={`Ảnh gốc: ${item.originalFile.name}`}
                referrerPolicy="no-referrer"
                draggable={false}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Divider line & drag handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#4169E1] shadow-[0_0_8px_rgba(0,0,0,0.4)] pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-[#4169E1] text-white shadow-md flex items-center justify-center border-2 border-white dark:border-slate-900">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/75 text-white text-xs font-medium pointer-events-none">
              Ảnh gốc ({formatFileSize(item.originalSize)})
            </div>
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#4169E1]/90 text-white text-xs font-medium pointer-events-none">
              Sau nén ({formatFileSize(item.processedSize ?? 0)})
            </div>
          </div>

          {/* Accessible Slider Fallback */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Kéo thanh so sánh
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sliderPos)}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label="Vị trí đường chia so sánh ảnh gốc và ảnh sau nén"
              className="royal-slider flex-1 bg-slate-200 dark:bg-slate-700"
            />
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 w-10 text-right">
              {Math.round(sliderPos)}%
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => onDownload(item)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#4169E1] hover:bg-[#3358CC] text-white transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Tải ảnh sau nén</span>
          </button>
        </div>
      </div>
    </div>
  );
};
