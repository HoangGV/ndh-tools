import React, { useState, useEffect } from 'react';
import {
  ImageDown,
  QrCode,
  FolderTree,
  FileStack,
  Sun,
  Moon,
} from 'lucide-react';
import { ImageCompressorTool } from './components/ImageCompressorTool';
import { QrCodeGeneratorTool } from './components/QrCodeGeneratorTool';
import { DirectoryTreeTool } from './components/DirectoryTreeTool';
import { PdfToolsPanel } from './components/PdfToolsPanel';

type ActiveTab = 'image' | 'qr' | 'tree' | 'pdf';

const TOOL_TABS: Array<{
  id: ActiveTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'image',
    label: 'Nén & Đổi định dạng ảnh',
    shortLabel: 'Nén ảnh',
    icon: ImageDown,
  },
  {
    id: 'qr',
    label: 'Tạo mã QR tùy chỉnh',
    shortLabel: 'Tạo mã QR',
    icon: QrCode,
  },
  {
    id: 'tree',
    label: 'Sơ đồ thư mục Tree',
    shortLabel: 'Sơ đồ Tree',
    icon: FolderTree,
  },
  {
    id: 'pdf',
    label: '4. Tách & Ghép PDF',
    shortLabel: 'Tách & Ghép PDF',
    icon: FileStack,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('image');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ndh-tools-theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('ndh-tools-theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }, [isDark]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* Top Bar: Clean 3-zone header (Wordmark — 3 Tool Tabs — Dark Mode Toggle) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('image');
            }}
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded-md"
          >
            <img
              src="/assets/aistudio/icon-ndh-tools_3a84772d.webp"
              alt="NDH Tools"
              referrerPolicy="no-referrer"
              className="w-8 h-8 object-contain shrink-0"
            />
            <span>NDH Tools</span>
          </a>

          {/* Zone 2: Desktop 4-Tool Navigation Tabs */}
          <nav
            aria-label="Danh mục công cụ"
            className="hidden lg:flex items-center gap-1"
          >
            {TOOL_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-10 px-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    active
                      ? 'text-[#4169E1] dark:text-blue-400 bg-[#4169E1]/8 dark:bg-[#4169E1]/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Toggle Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
              className="h-10 px-3 inline-flex items-center gap-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-[#4169E1]/60 hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline">{isDark ? 'Giao diện sáng' : 'Giao diện tối'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Tool Switcher (scrolls naturally, keeps sticky header well under 15% mobile height) */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
        <nav
          aria-label="Chọn công cụ trên di động"
          className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950"
        >
          {TOOL_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-10 px-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-[#4169E1] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area — keep mounted states via hidden classes so user work persists across tab switches */}
      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={activeTab === 'image' ? 'block' : 'hidden'}>
          <ImageCompressorTool />
        </div>
        <div className={activeTab === 'qr' ? 'block' : 'hidden'}>
          <QrCodeGeneratorTool />
        </div>
        <div className={activeTab === 'tree' ? 'block' : 'hidden'}>
          <DirectoryTreeTool />
        </div>
        <div className={activeTab === 'pdf' ? 'block' : 'hidden'}>
          <PdfToolsPanel />
        </div>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>NDH Tools — Bộ công cụ tiện ích trực tuyến</span>
          <span>Xử lý 100% cục bộ trên trình duyệt · Bảo mật tuyệt đối dữ liệu của bạn</span>
        </div>
      </footer>
    </div>
  );
}
