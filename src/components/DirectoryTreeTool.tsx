import React, { useState, useMemo, useRef } from 'react';
import {
  Copy,
  Check,
  Download,
  RotateCcw,
  Eraser,
  FolderTree,
  AlignLeft,
} from 'lucide-react';
import {
  SAMPLE_VIETNAMESE_TREE,
  TreeLineStyle,
  TreeOptions,
  generateDirectoryTree,
} from '../utils/treeGenerator';

export const DirectoryTreeTool: React.FC = () => {
  const [inputText, setInputText] = useState<string>(SAMPLE_VIETNAMESE_TREE);
  const [options, setOptions] = useState<TreeOptions>({
    style: 'unicode',
    trailingSlash: true,
    showIcons: false,
  });
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { output, stats } = useMemo(
    () => generateDirectoryTree(inputText, options),
    [inputText, options]
  );

  /**
   * Handles Tab (indent 2 spaces), Shift+Tab (outdent), and Enter (preserve current line indent)
   * smoothly for fast keyboard-first tree authoring.
   */
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;

    if (e.key === 'Tab') {
      e.preventDefault();

      // Multi-line selection indent / outdent
      if (selectionStart !== selectionEnd) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const selectedBlock = value.slice(lineStart, selectionEnd);
        const lines = selectedBlock.split('\n');

        let updatedLines: string[];
        if (e.shiftKey) {
          updatedLines = lines.map((line) => {
            if (line.startsWith('  ')) return line.slice(2);
            if (line.startsWith('\t') || line.startsWith(' ')) return line.slice(1);
            return line;
          });
        } else {
          updatedLines = lines.map((line) => `  ${line}`);
        }

        const replacement = updatedLines.join('\n');
        const nextValue = value.slice(0, lineStart) + replacement + value.slice(selectionEnd);
        setInputText(nextValue);

        requestAnimationFrame(() => {
          el.selectionStart = lineStart;
          el.selectionEnd = lineStart + replacement.length;
        });
        return;
      }

      // Single cursor position
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const linePrefix = value.slice(lineStart, selectionStart);
        let removeCount = 0;
        if (value.slice(lineStart, lineStart + 2) === '  ') removeCount = 2;
        else if (value[lineStart] === '\t' || value[lineStart] === ' ') removeCount = 1;

        if (removeCount > 0) {
          const nextValue = value.slice(0, lineStart) + value.slice(lineStart + removeCount);
          const nextPos = Math.max(lineStart, selectionStart - Math.min(removeCount, linePrefix.length));
          setInputText(nextValue);
          requestAnimationFrame(() => {
            el.selectionStart = nextPos;
            el.selectionEnd = nextPos;
          });
        }
      } else {
        const nextValue = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
        const nextPos = selectionStart + 2;
        setInputText(nextValue);
        requestAnimationFrame(() => {
          el.selectionStart = nextPos;
          el.selectionEnd = nextPos;
        });
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLineBeforeCursor = value.slice(lineStart, selectionStart);
      const indentMatch = currentLineBeforeCursor.match(/^[\t ]*/);
      const currentIndent = indentMatch ? indentMatch[0] : '';

      const insertion = `\n${currentIndent}`;
      const nextValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
      const nextPos = selectionStart + insertion.length;
      setInputText(nextValue);

      requestAnimationFrame(() => {
        el.selectionStart = nextPos;
        el.selectionEnd = nextPos;
      });
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Fallback for restricted iframe clipboard permissions
      const temp = document.createElement('textarea');
      temp.value = output;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.focus();
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!output) return;
    // Include UTF-8 BOM so Windows Notepad & Excel/editors render Vietnamese diacritics cleanly
    const blob = new Blob(['\uFEFF' + output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'so-do-thu-muc.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
          Tạo sơ đồ cấu trúc thư mục (Tree)
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Nhập danh sách thư mục và tệp tin theo thụt lề để xuất sơ đồ cây chuẩn đẹp, hỗ trợ đầy đủ tiếng Việt có dấu và khoảng trắng.
        </p>
      </div>

      {/* Formatting Toolbar */}
      <section
        aria-label="Tùy chọn định dạng cây thư mục"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Connector Style */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Kiểu đường kẻ:
            </span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {(
                [
                  { id: 'unicode', label: 'Unicode (├──)' },
                  { id: 'ascii', label: 'ASCII (+--)' },
                ] as Array<{ id: TreeLineStyle; label: string }>
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, style: st.id }))}
                  className={`h-8 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    options.style === st.id
                      ? 'bg-white dark:bg-slate-800 text-[#4169E1] dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Trailing Slash */}
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={options.trailingSlash}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, trailingSlash: e.target.checked }))
              }
              className="w-4 h-4 rounded accent-[#4169E1]"
            />
            <span>Dấu &quot;/&quot; cuối thư mục</span>
          </label>

          {/* Toggle Icons */}
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={options.showIcons}
              onChange={(e) => setOptions((prev) => ({ ...prev, showIcons: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#4169E1]"
            />
            <span>Hiển thị biểu tượng (📁 / 📄)</span>
          </label>
        </div>

        {/* Clean Unboxed Stats */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
          <span>{stats.folders} thư mục</span>
          <span aria-hidden="true">·</span>
          <span>{stats.files} tệp tin</span>
          <span aria-hidden="true">·</span>
          <span>Độ sâu {stats.maxDepth}</span>
        </div>
      </section>

      {/* 2-Column Editor & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Indented Input */}
        <section
          aria-label="Khung nhập liệu cấu trúc"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-[#4169E1]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nhập cấu trúc thụt lề
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setInputText(SAMPLE_VIETNAMESE_TREE);
                  textareaRef.current?.focus();
                }}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nạp mẫu</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  textareaRef.current?.focus();
                }}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Xóa trắng</span>
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            spellCheck={false}
            placeholder={'thư-mục-gốc/\n  tài-liệu/\n    Báo cáo tổng kết.docx\n  index.html'}
            aria-label="Nhập danh sách thư mục và tệp tin theo mức thụt lề"
            className="w-full min-h-[380px] lg:min-h-[480px] flex-1 p-4 font-mono text-[13.5px] leading-relaxed bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-y"
          />

          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
            Mẹo: Nhấn <kbd className="font-mono px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Tab</kbd> /{' '}
            <kbd className="font-mono px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Shift+Tab</kbd> để tăng/giảm thụt lề; nhấn{' '}
            <kbd className="font-mono px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Enter</kbd> tự giữ mức thụt lề; thêm <code className="font-mono">/</code> ở cuối để đánh dấu thư mục trống.
          </div>
        </section>

        {/* Right Column: Live Tree Output */}
        <section
          aria-label="Kết quả sơ đồ thư mục"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-[#4169E1]" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Kết quả sơ đồ Tree
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!output}
                className={`h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#4169E1] hover:bg-[#3358CC] text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã chép ✓' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={!output}
                className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải .TXT</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[380px] lg:min-h-[480px] bg-slate-50/70 dark:bg-slate-950 p-4 overflow-x-auto">
            {output ? (
              <pre
                className="font-mono text-[13.5px] leading-[1.65] text-slate-800 dark:text-slate-100 whitespace-pre select-all"
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                }}
              >
                {output}
              </pre>
            ) : (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6">
                <FolderTree className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Chưa có dữ liệu sơ đồ
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  Nhập danh sách thư mục ở cột bên trái hoặc nhấn &quot;Nạp mẫu&quot; để xem kết quả ngay lập tức.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
