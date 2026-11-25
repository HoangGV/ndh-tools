import React, { useState, useRef } from 'react';
import {
  Scissors,
  Layers,
  Upload,
  FileText,
  RotateCw,
  ZoomIn,
  Check,
  Download,
  Archive,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  Shuffle,
  FilePlus2,
} from 'lucide-react';
import { formatFileSize } from '../utils/imageProcessor';
import {
  MergePdfItem,
  PdfPageThumb,
  exportSelectedPagesAsPdf,
  exportSelectedPagesAsZip,
  isPdfFile,
  loadPdfForMerge,
  loadPdfForSplit,
  mergePdfFiles,
  parsePageRangeInput,
  translatePdfError,
  triggerBlobDownload,
} from '../utils/pdfProcessor';
import { PdfPageZoomModal } from './PdfPageZoomModal';

type PdfMode = 'split' | 'merge';

export const PdfToolsPanel: React.FC = () => {
  const [mode, setMode] = useState<PdfMode>('split');

  // --- Mode A: Split & Filter State ---
  const [splitFileMeta, setSplitFileMeta] = useState<{
    name: string;
    size: number;
    pageCount: number;
  } | null>(null);
  const [splitBytes, setSplitBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PdfPageThumb[]>([]);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isLoadingSplit, setIsLoadingSplit] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [splitError, setSplitError] = useState<string | null>(null);
  const [rangeInput, setRangeInput] = useState('');
  const [rangeFeedback, setRangeFeedback] = useState<string | null>(null);
  const [exportingSplit, setExportingSplit] = useState<'pdf' | 'zip' | null>(null);
  const [zoomPageNumber, setZoomPageNumber] = useState<number | null>(null);

  const splitInputRef = useRef<HTMLInputElement | null>(null);

  // --- Mode B: Merge State ---
  const [mergeItems, setMergeItems] = useState<MergePdfItem[]>([]);
  const [isDraggingMerge, setIsDraggingMerge] = useState(false);
  const [isLoadingMerge, setIsLoadingMerge] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeOutputName, setMergeOutputName] = useState('tai-lieu-da-ghep.pdf');
  const [isMerging, setIsMerging] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const mergeInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // MODE A HANDLERS: SPLIT & FILTER
  // =========================================================================

  const handleLoadSplitFile = async (file: File) => {
    setSplitError(null);
    setRangeFeedback(null);

    if (!isPdfFile(file)) {
      setSplitError('Chỉ hỗ trợ tệp định dạng .PDF. Vui lòng chọn tệp PDF hợp lệ.');
      return;
    }

    setIsLoadingSplit(true);
    setRenderProgress({ current: 0, total: 0 });

    try {
      const result = await loadPdfForSplit(file, (rendered, total) => {
        setRenderProgress({ current: rendered, total });
      });

      setSplitBytes(result.bytes);
      setSplitFileMeta({
        name: file.name,
        size: file.size,
        pageCount: result.pageCount,
      });
      setPages(result.pages);
      setRangeInput('');
      setZoomPageNumber(null);
    } catch (err) {
      setSplitError(translatePdfError(err));
    } finally {
      setIsLoadingSplit(false);
    }
  };

  const handleTogglePage = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleRotatePage = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, extraRotation: (p.extraRotation + 90) % 360 }
          : p
      )
    );
  };

  const handleSelectAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
    setRangeFeedback(null);
  };

  const handleDeselectAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
    setRangeFeedback(null);
  };

  const handleInvertSelection = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: !p.selected })));
    setRangeFeedback(null);
  };

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitFileMeta) return;

    const trimmed = rangeInput.trim();
    if (!trimmed) {
      setRangeFeedback('Hãy nhập số trang hoặc khoảng trang, ví dụ: 1-3, 5, 8-10.');
      return;
    }

    const { pages: parsedSet, invalidTokens } = parsePageRangeInput(
      trimmed,
      splitFileMeta.pageCount
    );

    if (parsedSet.size === 0) {
      setRangeFeedback(
        `Không tìm thấy trang hợp lệ trong phạm vi 1–${splitFileMeta.pageCount}. Vui lòng kiểm tra lại cú pháp (ví dụ: 1-3, 5).`
      );
      return;
    }

    setPages((prev) => prev.map((p) => ({ ...p, selected: parsedSet.has(p.pageNumber) })));

    if (invalidTokens.length > 0) {
      setRangeFeedback(
        `Đã chọn ${parsedSet.size} trang. Đã bỏ qua giá trị ngoài phạm vi: ${invalidTokens.join(', ')}.`
      );
    } else {
      setRangeFeedback(`Đã chọn chính xác ${parsedSet.size} trang theo khoảng đã nhập.`);
    }
  };

  const selectedPages = pages.filter((p) => p.selected);

  const handleExportSplitPdf = async () => {
    if (!splitBytes || !splitFileMeta || selectedPages.length === 0 || exportingSplit) return;
    setSplitError(null);
    setExportingSplit('pdf');
    try {
      const blob = await exportSelectedPagesAsPdf(
        splitBytes,
        selectedPages.map((p) => ({
          pageNumber: p.pageNumber,
          extraRotation: p.extraRotation,
        }))
      );
      const baseName = splitFileMeta.name.replace(/\.pdf$/i, '');
      triggerBlobDownload(blob, `${baseName}-da-loc-${selectedPages.length}-trang.pdf`);
    } catch (err) {
      setSplitError(translatePdfError(err));
    } finally {
      setExportingSplit(null);
    }
  };

  const handleExportSplitZip = async () => {
    if (!splitBytes || !splitFileMeta || selectedPages.length === 0 || exportingSplit) return;
    setSplitError(null);
    setExportingSplit('zip');
    try {
      const blob = await exportSelectedPagesAsZip(
        splitBytes,
        selectedPages.map((p) => ({
          pageNumber: p.pageNumber,
          extraRotation: p.extraRotation,
        }))
      );
      const baseName = splitFileMeta.name.replace(/\.pdf$/i, '');
      triggerBlobDownload(blob, `${baseName}-tach-${selectedPages.length}-trang.zip`);
    } catch (err) {
      setSplitError(translatePdfError(err));
    } finally {
      setExportingSplit(null);
    }
  };

  const handleResetSplit = () => {
    setSplitBytes(null);
    setSplitFileMeta(null);
    setPages([]);
    setRangeInput('');
    setRangeFeedback(null);
    setSplitError(null);
    setZoomPageNumber(null);
  };

  // =========================================================================
  // MODE B HANDLERS: MERGE PDFs
  // =========================================================================

  const handleAddMergeFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setMergeError(null);
    setIsLoadingMerge(true);

    const added: MergePdfItem[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!isPdfFile(file)) {
        errors.push(`"${file.name}" không phải tệp PDF.`);
        continue;
      }
      try {
        const item = await loadPdfForMerge(file);
        added.push(item);
      } catch (err) {
        errors.push(`"${file.name}": ${translatePdfError(err)}`);
      }
    }

    if (added.length > 0) {
      setMergeItems((prev) => [...prev, ...added]);
    }
    if (errors.length > 0) {
      setMergeError(errors.join(' '));
    }

    setIsLoadingMerge(false);
  };

  const handleMoveMergeItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mergeItems.length) return;
    setMergeItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleRemoveMergeItem = (id: string) => {
    setMergeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDropReorder = (targetIndex: number) => {
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    setMergeItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleMergeExport = async () => {
    if (mergeItems.length < 2 || isMerging) return;
    setMergeError(null);
    setIsMerging(true);
    try {
      const blob = await mergePdfFiles(mergeItems);
      const rawName = mergeOutputName.trim() || 'tai-lieu-da-ghep.pdf';
      const safeName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
      triggerBlobDownload(blob, safeName);
    } catch (err) {
      setMergeError(translatePdfError(err));
    } finally {
      setIsMerging(false);
    }
  };

  const totalMergePages = mergeItems.reduce((sum, item) => sum + item.pageCount, 0);
  const totalMergeSize = mergeItems.reduce((sum, item) => sum + item.size, 0);

  return (
    <div className="space-y-6">
      {/* Header + Local Privacy Note */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            Tách, Lọc trang & Ghép PDF
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Chọn lọc, xoay chiều, tách từng trang hoặc ghép nhiều tệp PDF giữ nguyên 100% chất lượng gốc.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Tài liệu được xử lý trực tiếp trên trình duyệt của bạn, không tải lên máy chủ</span>
        </div>
      </div>

      {/* Mode Switcher: Split/Filter vs Merge */}
      <div className="inline-flex w-full sm:w-auto p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMode('split')}
          className={`flex-1 sm:flex-initial h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            mode === 'split'
              ? 'bg-white dark:bg-slate-800 text-[#4169E1] dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Scissors className="w-4 h-4 shrink-0" />
          <span>Tách & Lọc trang PDF</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('merge')}
          className={`flex-1 sm:flex-initial h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            mode === 'merge'
              ? 'bg-white dark:bg-slate-800 text-[#4169E1] dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>Ghép nhiều tệp PDF</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* MODE A: SPLIT & FILTER PAGES                                        */}
      {/* =================================================================== */}
      {mode === 'split' && (
        <div className="space-y-5">
          <input
            ref={splitInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleLoadSplitFile(file);
                e.target.value = '';
              }
            }}
          />

          {/* Error Banner */}
          {splitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-4 rounded-xl border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{splitError}</span>
            </div>
          )}

          {/* Upload Dropzone (when no PDF loaded yet) */}
          {!splitFileMeta && !isLoadingSplit && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Kéo thả hoặc bấm chọn 1 tệp PDF"
              onClick={() => splitInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  splitInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingSplit(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingSplit(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingSplit(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleLoadSplitFile(file);
              }}
              className={`group rounded-xl border-2 border-dashed p-12 sm:p-16 text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                isDraggingSplit
                  ? 'border-[#4169E1] bg-[#4169E1]/8 dark:bg-[#4169E1]/15'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#4169E1]/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#4169E1]/10 dark:bg-[#4169E1]/20 text-[#4169E1] flex items-center justify-center mb-3.5 transition-transform group-hover:scale-105">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Kéo thả tệp PDF vào đây hoặc bấm để chọn từ máy tính
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Hỗ trợ chọn/bỏ trang trực quan, xoay trang bị ngược và xuất thành 1 tệp PDF hoặc từng trang (.ZIP)
              </p>
            </div>
          )}

          {/* Loading Progress */}
          {isLoadingSplit && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="inline-flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <Loader2 className="w-4 h-4 animate-spin text-[#4169E1]" />
                  Đang đọc và tạo ảnh thu nhỏ các trang PDF...
                </span>
                {renderProgress.total > 0 && (
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {renderProgress.current} / {renderProgress.total} trang
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4169E1] transition-all duration-150"
                  style={{
                    width:
                      renderProgress.total > 0
                        ? `${(renderProgress.current / renderProgress.total) * 100}%`
                        : '18%',
                  }}
                />
              </div>
            </div>
          )}

          {/* Loaded PDF Workspace */}
          {splitFileMeta && !isLoadingSplit && (
            <>
              {/* File Info + Export Actions */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#4169E1]/10 dark:bg-[#4169E1]/20 text-[#4169E1] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"
                        title={splitFileMeta.name}
                      >
                        {splitFileMeta.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>{formatFileSize(splitFileMeta.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Tổng {splitFileMeta.pageCount} trang</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#4169E1] dark:text-blue-400">
                          Đã chọn {selectedPages.length} / {splitFileMeta.pageCount} trang
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => splitInputRef.current?.click()}
                      className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Chọn tệp khác
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSplit}
                      aria-label="Đóng tệp hiện tại"
                      className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  {/* Smart Page Range Input */}
                  <form
                    onSubmit={handleApplyRange}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-md"
                  >
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      placeholder="Nhập khoảng trang, VD: 1-3, 5, 8-10"
                      aria-label="Nhập khoảng trang cần chọn"
                      className="flex-1 h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Chọn theo khoảng
                    </button>
                  </form>

                  {/* Quick Selection Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Chọn tất cả</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Bỏ chọn tất cả</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleInvertSelection}
                      className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Đảo ngược vùng chọn</span>
                    </button>
                  </div>
                </div>

                {rangeFeedback && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{rangeFeedback}</p>
                )}

                {/* Export Buttons Bar */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bấm trực tiếp vào từng thẻ trang bên dưới để chọn hoặc bỏ chọn.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="button"
                      disabled={selectedPages.length === 0 || exportingSplit !== null}
                      onClick={() => void handleExportSplitPdf()}
                      className="h-10 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#4169E1] hover:bg-[#3358CC] text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {exportingSplit === 'pdf' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>
                        {exportingSplit === 'pdf'
                          ? 'Đang tạo PDF...'
                          : `Xuất 1 tệp PDF (${selectedPages.length} trang)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedPages.length === 0 || exportingSplit !== null}
                      onClick={() => void handleExportSplitZip()}
                      className="h-10 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {exportingSplit === 'zip' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                      <span>
                        {exportingSplit === 'zip'
                          ? 'Đang đóng gói ZIP...'
                          : 'Tách thành từng tệp riêng (.ZIP)'}
                      </span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Visual Page Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    role="button"
                    tabIndex={0}
                    aria-pressed={page.selected}
                    aria-label={`Trang ${page.pageNumber}, ${page.selected ? 'đang được chọn' : 'đã loại bỏ'}`}
                    onClick={() => handleTogglePage(page.pageNumber)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTogglePage(page.pageNumber);
                      }
                    }}
                    className={`group relative rounded-xl border-2 bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                      page.selected
                        ? 'border-[#4169E1] shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 opacity-50 hover:opacity-75'
                    }`}
                  >
                    {/* Selection Checkmark Indicator */}
                    <div
                      className={`absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${
                        page.selected
                          ? 'bg-[#4169E1] border-[#4169E1] text-white'
                          : 'bg-white/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-600 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                    </div>

                    {/* Rotation Badge (only when rotated) */}
                    {page.extraRotation > 0 && (
                      <div className="absolute top-2.5 left-2.5 z-10 px-1.5 py-0.5 rounded bg-slate-900/75 text-white font-mono text-[10px] tabular-nums">
                        {page.extraRotation}°
                      </div>
                    )}

                    {/* Page Preview Canvas Container */}
                    <div className="aspect-[3/4] w-full bg-slate-100/80 dark:bg-slate-950 p-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={page.thumbnailUrl}
                        alt={`Trang ${page.pageNumber}`}
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="max-w-full max-h-full object-contain shadow-xs bg-white transition-transform duration-200"
                        style={{
                          transform:
                            page.extraRotation !== 0
                              ? `rotate(${page.extraRotation}deg)`
                              : undefined,
                        }}
                      />
                    </div>

                    {/* Page Footer & Controls */}
                    <div className="px-2.5 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 bg-white dark:bg-slate-900">
                      <span
                        className={`text-xs font-semibold tabular-nums truncate ${
                          page.selected
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-500 dark:text-slate-400 line-through'
                        }`}
                      >
                        Trang {page.pageNumber}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          title="Xoay 90° theo chiều kim đồng hồ"
                          aria-label={`Xoay trang ${page.pageNumber} thêm 90 độ`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotatePage(page.pageNumber);
                          }}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-[#4169E1] hover:bg-[#4169E1]/10 transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Xem phóng to trang"
                          aria-label={`Phóng to trang ${page.pageNumber}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomPageNumber(page.pageNumber);
                          }}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-[#4169E1] hover:bg-[#4169E1]/10 transition-colors cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE B: MERGE MULTIPLE PDFs                                         */}
      {/* =================================================================== */}
      {mode === 'merge' && (
        <div className="space-y-5">
          <input
            ref={mergeInputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                void handleAddMergeFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Kéo thả hoặc chọn nhiều tệp PDF để ghép"
            onClick={() => mergeInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                mergeInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingMerge(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingMerge(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingMerge(false);
              if (e.dataTransfer.files) {
                void handleAddMergeFiles(e.dataTransfer.files);
              }
            }}
            className={`group rounded-xl border-2 border-dashed transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
              mergeItems.length > 0 ? 'p-6' : 'p-12 sm:p-16'
            } ${
              isDraggingMerge
                ? 'border-[#4169E1] bg-[#4169E1]/8 dark:bg-[#4169E1]/15'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#4169E1]/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-[#4169E1]/10 dark:bg-[#4169E1]/20 text-[#4169E1] flex items-center justify-center mb-3 transition-transform group-hover:scale-105">
                {isLoadingMerge ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : mergeItems.length > 0 ? (
                  <FilePlus2 className="w-6 h-6" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isLoadingMerge
                  ? 'Đang đọc và tạo ảnh bìa tài liệu PDF...'
                  : mergeItems.length > 0
                    ? 'Kéo thả hoặc bấm để thêm tệp PDF vào danh sách ghép'
                    : 'Kéo thả nhiều tệp PDF vào đây hoặc bấm để chọn'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Chọn từ 2 tệp PDF trở lên, kéo thả hoặc bấm mũi tên để sắp xếp thứ tự ghép
              </p>
            </div>
          </div>

          {/* Merge Error Banner */}
          {mergeError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-4 rounded-xl border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{mergeError}</span>
            </div>
          )}

          {/* Ordered PDF List & Export Controls */}
          {mergeItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Sortable List */}
              <section
                aria-label="Danh sách tệp PDF cần ghép"
                className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Thứ tự ghép ({mergeItems.length} tệp)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Tổng {totalMergePages} trang</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatFileSize(totalMergeSize)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMergeItems([]);
                      setMergeError(null);
                    }}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tất cả</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {mergeItems.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedIdx(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropReorder(idx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                        dragOverIdx === idx && draggedIdx !== idx
                          ? 'bg-[#4169E1]/10 dark:bg-[#4169E1]/20'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      } ${draggedIdx === idx ? 'opacity-50' : ''}`}
                    >
                      {/* Drag Grip + Order Index */}
                      <div className="flex items-center gap-1.5 text-slate-400 cursor-grab active:cursor-grabbing shrink-0">
                        <GripVertical className="w-4 h-4" />
                        <span className="w-5 text-xs font-mono font-semibold tabular-nums text-slate-500 dark:text-slate-400 text-center">
                          {idx + 1}
                        </span>
                      </div>

                      {/* Cover Thumbnail (Page 1) */}
                      <div className="w-11 h-14 rounded border border-slate-200 dark:border-slate-700 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={item.coverUrl}
                          alt={`Trang bìa ${item.name}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Metadata */}
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{item.pageCount} trang</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatFileSize(item.size)}</span>
                        </div>
                      </div>

                      {/* Up / Down / Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveMergeItem(idx, -1)}
                          aria-label={`Di chuyển ${item.name} lên trên`}
                          title="Chuyển lên"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#4169E1] hover:text-[#4169E1] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === mergeItems.length - 1}
                          onClick={() => handleMoveMergeItem(idx, 1)}
                          aria-label={`Di chuyển ${item.name} xuống dưới`}
                          title="Chuyển xuống"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#4169E1] hover:text-[#4169E1] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMergeItem(item.id)}
                          aria-label={`Xóa ${item.name} khỏi danh sách`}
                          title="Xóa"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Right: Export Output Box */}
              <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
                  Xuất tệp PDF đã ghép
                </h2>

                <div className="space-y-1.5">
                  <label
                    htmlFor="merge-output-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Tên tệp đầu ra
                  </label>
                  <input
                    id="merge-output-name"
                    type="text"
                    value={mergeOutputName}
                    onChange={(e) => setMergeOutputName(e.target.value)}
                    placeholder="tai-lieu-da-ghep.pdf"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span>Số tệp sẽ ghép:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {mergeItems.length} tệp
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tổng số trang đầu ra:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {totalMergePages} trang
                    </span>
                  </div>
                </div>

                {mergeItems.length < 2 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Cần ít nhất 2 tệp PDF để tiến hành ghép. Hãy thêm tệp PDF khác vào danh sách.
                  </p>
                )}

                <button
                  type="button"
                  disabled={mergeItems.length < 2 || isMerging}
                  onClick={() => void handleMergeExport()}
                  className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg bg-[#4169E1] hover:bg-[#3358CC] text-white transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isMerging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isMerging ? 'Đang ghép PDF...' : 'Ghép & Tải về PDF'}</span>
                </button>
              </aside>
            </div>
          )}
        </div>
      )}

      {/* High-Res Page Zoom Modal */}
      <PdfPageZoomModal
        sourceBytes={splitBytes}
        pages={pages}
        activePageNumber={zoomPageNumber}
        onClose={() => setZoomPageNumber(null)}
        onNavigate={(num) => setZoomPageNumber(num)}
        onToggleSelect={handleTogglePage}
        onRotate={handleRotatePage}
      />
    </div>
  );
};
