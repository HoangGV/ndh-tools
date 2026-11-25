import React, { useEffect, useState } from 'react';
import {
  X,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  PdfPageThumb,
  renderHighResPdfPage,
  translatePdfError,
} from '../utils/pdfProcessor';

interface PdfPageZoomModalProps {
  sourceBytes: Uint8Array | null;
  pages: PdfPageThumb[];
  activePageNumber: number | null;
  onClose: () => void;
  onNavigate: (pageNumber: number) => void;
  onToggleSelect: (pageNumber: number) => void;
  onRotate: (pageNumber: number) => void;
}

export const PdfPageZoomModal: React.FC<PdfPageZoomModalProps> = ({
  sourceBytes,
  pages,
  activePageNumber,
  onClose,
  onNavigate,
  onToggleSelect,
  onRotate,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPage = pages.find((p) => p.pageNumber === activePageNumber) ?? null;

  useEffect(() => {
    if (!sourceBytes || !currentPage) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    renderHighResPdfPage(sourceBytes, currentPage.pageNumber, currentPage.extraRotation)
      .then((url) => {
        if (!cancelled) {
          setImageUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(translatePdfError(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourceBytes, currentPage?.pageNumber, currentPage?.extraRotation]);

  useEffect(() => {
    if (!currentPage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentPage.pageNumber > 1) {
        onNavigate(currentPage.pageNumber - 1);
      } else if (e.key === 'ArrowRight' && currentPage.pageNumber < pages.length) {
        onNavigate(currentPage.pageNumber + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, pages.length, onClose, onNavigate]);

  if (!currentPage) return null;

  const hasPrev = currentPage.pageNumber > 1;
  const hasNext = currentPage.pageNumber < pages.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-zoom-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h3
              id="pdf-zoom-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap"
            >
              Trang {currentPage.pageNumber} / {pages.length}
            </h3>
            {currentPage.extraRotation > 0 && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Đã xoay {currentPage.extraRotation}°
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSelect(currentPage.pageNumber)}
              className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                currentPage.selected
                  ? 'bg-[#4169E1] text-white border-[#4169E1]'
                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{currentPage.selected ? 'Đang chọn' : 'Đã loại bỏ'}</span>
            </button>

            <button
              type="button"
              onClick={() => onRotate(currentPage.pageNumber)}
              className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xoay 90°</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xem trước"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Res Page Canvas */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 p-5 flex items-center justify-center min-h-[360px]">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-[#4169E1]" />
              <span className="text-xs">Đang kết xuất trang độ nét cao...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && imageUrl && (
            <img
              src={imageUrl}
              alt={`Xem phóng to trang ${currentPage.pageNumber}`}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[70vh] object-contain rounded shadow-md bg-white border border-slate-200 dark:border-slate-800"
            />
          )}
        </div>

        {/* Navigation Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && onNavigate(currentPage.pageNumber - 1)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trang trước</span>
          </button>

          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Dùng phím mũi tên ← / → để chuyển trang nhanh
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && onNavigate(currentPage.pageNumber + 1)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Trang sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
