import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCodeStyling, {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  Options as QRCodeOptions,
} from 'qr-code-styling';
import {
  Link2,
  Wifi,
  Contact,
  Download,
  Upload,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Palette,
  Sliders,
  Copy,
  Check,
} from 'lucide-react';
import {
  QrContentType,
  VCardPayload,
  WifiEncryption,
  WifiPayload,
  buildVCardQrString,
  buildWifiQrString,
  encodeUtf8ForQr,
  getContrastRatio,
} from '../utils/qrFormatter';

const COLOR_PRESETS: Array<{ name: string; fg: string; bg: string }> = [
  { name: 'Royal Blue', fg: '#4169E1', bg: '#FFFFFF' },
  { name: 'Đen cổ điển', fg: '#0F172A', bg: '#FFFFFF' },
  { name: 'Xanh ngọc', fg: '#047857', bg: '#FFFFFF' },
  { name: 'Đỏ thẫm', fg: '#B91C1C', bg: '#FFFFFF' },
  { name: 'Chàm đậm', fg: '#312E81', bg: '#EEF2FF' },
  { name: 'Đêm tối', fg: '#FFFFFF', bg: '#0F172A' },
];

const DOT_STYLES: Array<{ value: DotType; label: string }> = [
  { value: 'square', label: 'Vuông' },
  { value: 'rounded', label: 'Bo tròn' },
  { value: 'dots', label: 'Chấm tròn' },
  { value: 'classy-rounded', label: 'Mềm mại' },
];

const CORNER_SQUARE_STYLES: Array<{ value: CornerSquareType; label: string }> = [
  { value: 'square', label: 'Vuông' },
  { value: 'extra-rounded', label: 'Bo tròn' },
  { value: 'dot', label: 'Tròn' },
];

const CORNER_DOT_STYLES: Array<{ value: CornerDotType; label: string }> = [
  { value: 'square', label: 'Vuông' },
  { value: 'dot', label: 'Chấm tròn' },
];

const ERROR_LEVELS: Array<{ value: ErrorCorrectionLevel; label: string; desc: string }> = [
  { value: 'L', label: 'L (7%)', desc: 'Mật độ thấp' },
  { value: 'M', label: 'M (15%)', desc: 'Tiêu chuẩn' },
  { value: 'Q', label: 'Q (25%)', desc: 'Khá cao' },
  { value: 'H', label: 'H (30%)', desc: 'Khuyên dùng khi có logo' },
];

const EXPORT_SIZES = [512, 1024, 2048] as const;

export const QrCodeGeneratorTool: React.FC = () => {
  const [contentType, setContentType] = useState<QrContentType>('text');

  // Payload states
  const [textValue, setTextValue] = useState<string>('https://ndh.io.vn');
  const [wifi, setWifi] = useState<WifiPayload>({
    ssid: '',
    password: '',
    encryption: 'WPA',
    hidden: false,
  });
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [vcard, setVcard] = useState<VCardPayload>({
    fullName: '',
    phone: '',
    email: '',
    website: '',
    organization: '',
  });

  // Visual style states
  const [fgColor, setFgColor] = useState<string>('#4169E1');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [transparentBg, setTransparentBg] = useState<boolean>(false);
  const [dotType, setDotType] = useState<DotType>('rounded');
  const [cornerSquareType, setCornerSquareType] = useState<CornerSquareType>('extra-rounded');
  const [cornerDotType, setCornerDotType] = useState<CornerDotType>('dot');
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('M');
  const [exportSize, setExportSize] = useState<(typeof EXPORT_SIZES)[number]>(1024);

  // Logo states
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'png' | 'svg' | null>(null);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);

  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const rawPayload = useMemo(() => {
    if (contentType === 'text') return textValue.trim();
    if (contentType === 'wifi') return buildWifiQrString(wifi);
    return buildVCardQrString(vcard);
  }, [contentType, textValue, wifi, vcard]);

  const emptyMessage = useMemo(() => {
    if (rawPayload) return null;
    if (contentType === 'text') return 'Nhập văn bản hoặc đường dẫn URL để tạo mã QR.';
    if (contentType === 'wifi') return 'Nhập tên mạng Wi-Fi (SSID) để tạo mã QR kết nối nhanh.';
    return 'Nhập ít nhất một thông tin (Họ tên, SĐT, Email hoặc Website) để tạo danh thiếp QR.';
  }, [rawPayload, contentType]);

  const lowContrastWarning = useMemo(() => {
    if (transparentBg) return false;
    return getContrastRatio(fgColor, bgColor) < 2.6;
  }, [fgColor, bgColor, transparentBg]);

  const buildQrOptions = (size: number): QRCodeOptions => ({
    width: size,
    height: size,
    type: 'svg',
    margin: Math.round(size * 0.04),
    data: encodeUtf8ForQr(rawPayload || ' '),
    image: logoDataUrl || undefined,
    qrOptions: {
      mode: 'Byte',
      errorCorrectionLevel: errorLevel,
    },
    dotsOptions: {
      color: fgColor,
      type: dotType,
    },
    backgroundOptions: {
      color: transparentBg ? 'transparent' : bgColor,
    },
    cornersSquareOptions: {
      color: fgColor,
      type: cornerSquareType,
    },
    cornersDotOptions: {
      color: fgColor,
      type: cornerDotType,
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      hideBackgroundDots: true,
      imageSize: 0.32,
      margin: Math.max(4, Math.round(size * 0.015)),
    },
  });

  // Render / update live QR preview
  useEffect(() => {
    const container = qrContainerRef.current;
    if (!container) return;

    if (!rawPayload) {
      container.innerHTML = '';
      qrInstanceRef.current = null;
      return;
    }

    const previewOptions = buildQrOptions(272);

    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling(previewOptions);
      container.innerHTML = '';
      qrInstanceRef.current.append(container);
    } else {
      qrInstanceRef.current.update(previewOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rawPayload,
    fgColor,
    bgColor,
    transparentBg,
    dotType,
    cornerSquareType,
    cornerDotType,
    errorLevel,
    logoDataUrl,
  ]);

  const handleLogoUpload = (file: File) => {
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, SVG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Ảnh logo quá lớn (tối đa 5MB). Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
        setLogoFileName(file.name);
        // Automatically elevate Error Correction Level to H when adding a logo
        setErrorLevel('H');
      }
    };
    reader.onerror = () => {
      setLogoError('Không thể đọc tệp logo. Vui lòng thử ảnh khác.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoDataUrl(null);
    setLogoFileName('');
    setLogoError(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleExport = async (format: 'png' | 'svg') => {
    if (!rawPayload || isExporting) return;
    setExportError(null);
    setIsExporting(format);
    try {
      const exportQr = new QRCodeStyling({
        ...buildQrOptions(exportSize),
        type: format === 'svg' ? 'svg' : 'canvas',
      });
      const rawData = await exportQr.getRawData(format);
      if (!rawData) {
        throw new Error('Không thể xuất dữ liệu mã QR.');
      }
      const blob =
        rawData instanceof Blob
          ? rawData
          : new Blob([new Uint8Array(rawData)], {
              type: format === 'svg' ? 'image/svg+xml;charset=utf-8' : 'image/png',
            });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ndh-tools-qr-${exportSize}px.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setExportError(
        'Không thể tạo tệp xuất mã QR. Hãy kiểm tra lại logo hoặc giảm độ dài nội dung.'
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleCopyImage = async () => {
    if (!rawPayload || isExporting || isCopying) return;
    setExportError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof ClipboardItem === 'undefined'
    ) {
      setExportError(
        'Trình duyệt hiện tại không hỗ trợ sao chép ảnh trực tiếp vào clipboard. Vui lòng dùng nút Tải PNG.'
      );
      return;
    }

    setIsCopying(true);

    const buildPngBlob = async (): Promise<Blob> => {
      const exportQr = new QRCodeStyling({
        ...buildQrOptions(exportSize),
        type: 'canvas',
      });
      const rawData = await exportQr.getRawData('png');
      if (!rawData) {
        throw new Error('Không thể tạo ảnh PNG để sao chép.');
      }
      if (rawData instanceof Blob) {
        return rawData.type === 'image/png'
          ? rawData
          : new Blob([await rawData.arrayBuffer()], { type: 'image/png' });
      }
      return new Blob([new Uint8Array(rawData)], { type: 'image/png' });
    };

    try {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': buildPngBlob() }),
        ]);
      } catch {
        const resolvedBlob = await buildPngBlob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': resolvedBlob }),
        ]);
      }
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch {
      setExportError(
        'Không thể sao chép ảnh QR vào clipboard (có thể do trình duyệt chặn quyền truy cập clipboard). Vui lòng dùng nút Tải PNG.'
      );
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
          Tạo & Tùy chỉnh mã QR
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tạo mã QR chất lượng cao cho liên kết, Wi-Fi hoặc danh thiếp tiếng Việt, hỗ trợ chèn logo và xuất PNG/SVG sắc nét.
        </p>
      </div>

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Content + Style Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Content Input */}
          <section
            aria-label="Nội dung mã QR"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
          >
            {/* Segmented Content Type Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
              {(
                [
                  { id: 'text', label: 'Văn bản / URL', icon: Link2 },
                  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
                  { id: 'vcard', label: 'Danh thiếp', icon: Contact },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = contentType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setContentType(tab.id)}
                    className={`h-9 px-2.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-slate-800 text-[#4169E1] dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mode: Text / URL */}
            {contentType === 'text' && (
              <div className="space-y-2">
                <label
                  htmlFor="qr-text-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Đường dẫn URL hoặc nội dung văn bản
                </label>
                <textarea
                  id="qr-text-input"
                  rows={4}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Ví dụ: https://ndh.io.vn hoặc lời nhắn tiếng Việt có dấu..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1] resize-y"
                />
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>Hỗ trợ đầy đủ tiếng Việt có dấu (UTF-8)</span>
                  <span>{textValue.length} ký tự</span>
                </div>
              </div>
            )}

            {/* Mode: Wi-Fi */}
            {contentType === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label
                    htmlFor="wifi-ssid"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Tên mạng Wi-Fi (SSID) *
                  </label>
                  <input
                    id="wifi-ssid"
                    type="text"
                    value={wifi.ssid}
                    onChange={(e) => setWifi((prev) => ({ ...prev, ssid: e.target.value }))}
                    placeholder="Ví dụ: NDH_Office_5G"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="wifi-security"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Loại bảo mật
                  </label>
                  <select
                    id="wifi-security"
                    value={wifi.encryption}
                    onChange={(e) =>
                      setWifi((prev) => ({
                        ...prev,
                        encryption: e.target.value as WifiEncryption,
                      }))
                    }
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Không mật khẩu (Mở)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="wifi-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu Wi-Fi
                  </label>
                  <div className="relative">
                    <input
                      id="wifi-password"
                      type={showWifiPassword ? 'text' : 'password'}
                      disabled={wifi.encryption === 'nopass'}
                      value={wifi.password}
                      onChange={(e) => setWifi((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder={
                        wifi.encryption === 'nopass' ? 'Không cần mật khẩu' : 'Nhập mật khẩu'
                      }
                      className="w-full h-10 pl-3.5 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1] disabled:opacity-50"
                    />
                    {wifi.encryption !== 'nopass' && (
                      <button
                        type="button"
                        onClick={() => setShowWifiPassword((v) => !v)}
                        aria-label={showWifiPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showWifiPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <label className="sm:col-span-2 inline-flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={wifi.hidden}
                    onChange={(e) => setWifi((prev) => ({ ...prev, hidden: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[#4169E1]"
                  />
                  <span>Mạng ẩn (Hidden SSID)</span>
                </label>
              </div>
            )}

            {/* Mode: vCard */}
            {contentType === 'vcard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="vcard-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Họ và tên
                  </label>
                  <input
                    id="vcard-name"
                    type="text"
                    value={vcard.fullName}
                    onChange={(e) => setVcard((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Hoàng Lam"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="vcard-phone"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Số điện thoại
                  </label>
                  <input
                    id="vcard-phone"
                    type="tel"
                    value={vcard.phone}
                    onChange={(e) => setVcard((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0912 345 678"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="vcard-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email
                  </label>
                  <input
                    id="vcard-email"
                    type="email"
                    value={vcard.email}
                    onChange={(e) => setVcard((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="lienhe@ndh.io.vn"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="vcard-website"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Website
                  </label>
                  <input
                    id="vcard-website"
                    type="url"
                    value={vcard.website}
                    onChange={(e) => setVcard((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder="https://ndh.io.vn"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label
                    htmlFor="vcard-org"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Công ty / Tổ chức (tùy chọn)
                  </label>
                  <input
                    id="vcard-org"
                    type="text"
                    value={vcard.organization}
                    onChange={(e) =>
                      setVcard((prev) => ({ ...prev, organization: e.target.value }))
                    }
                    placeholder="Trường Đại học A"
                    className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Card 2: Appearance & Logo Customization */}
          <section
            aria-label="Tùy chỉnh giao diện mã QR"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6"
          >
            {/* Colors */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <Palette className="w-4 h-4 text-[#4169E1]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Màu sắc & Bảng màu gợi ý
                </h2>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const selected =
                    !transparentBg &&
                    fgColor.toLowerCase() === preset.fg.toLowerCase() &&
                    bgColor.toLowerCase() === preset.bg.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setFgColor(preset.fg);
                        setBgColor(preset.bg);
                        setTransparentBg(false);
                      }}
                      className={`h-9 px-3 inline-flex items-center gap-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#4169E1] bg-[#4169E1]/8 text-[#4169E1] dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-sm border border-slate-300 dark:border-slate-600 shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: preset.bg }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-[2px]"
                          style={{ backgroundColor: preset.fg }}
                        />
                      </span>
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label
                    htmlFor="qr-fg-color"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Màu mã QR (Foreground)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="qr-fg-color"
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-10 h-10 p-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={fgColor.toUpperCase()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setFgColor(v);
                      }}
                      aria-label="Mã màu hex của mã QR"
                      className="flex-1 h-10 px-3 font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="qr-bg-color"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Màu nền (Background)
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={transparentBg}
                        onChange={(e) => setTransparentBg(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[#4169E1]"
                      />
                      <span>Nền trong suốt</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="qr-bg-color"
                      type="color"
                      disabled={transparentBg}
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-10 h-10 p-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer shrink-0 disabled:opacity-40"
                    />
                    <input
                      type="text"
                      disabled={transparentBg}
                      value={transparentBg ? 'TRONG SUỐT' : bgColor.toUpperCase()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setBgColor(v);
                      }}
                      aria-label="Mã màu hex của nền QR"
                      className="flex-1 h-10 px-3 font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 uppercase disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Shapes & Technical Options */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <Sliders className="w-4 h-4 text-[#4169E1]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Kiểu dáng, Logo & Độ sửa lỗi
                </h2>
              </div>

              {/* Dot style */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kiểu điểm ảnh (Dots)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DOT_STYLES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setDotType(st.value)}
                      className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        dotType === st.value
                          ? 'bg-[#4169E1] text-white border-[#4169E1]'
                          : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]/60'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corner styles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Khung góc định vị
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {CORNER_SQUARE_STYLES.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => setCornerSquareType(st.value)}
                        className={`h-9 px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          cornerSquareType === st.value
                            ? 'bg-[#4169E1] text-white border-[#4169E1]'
                            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]/60'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tâm góc định vị
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {CORNER_DOT_STYLES.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => setCornerDotType(st.value)}
                        className={`h-9 px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          cornerDotType === st.value
                            ? 'bg-[#4169E1] text-white border-[#4169E1]'
                            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]/60'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chèn Logo ở giữa (tùy chọn)
                </span>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />

                {!logoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#4169E1] hover:text-[#4169E1] transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Tải ảnh logo từ máy tính (PNG, SVG, JPG)</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={logoDataUrl}
                        alt="Logo chèn vào mã QR"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded object-contain bg-white border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {logoFileName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Đã tự động chỉnh kích thước an toàn & bật mức sửa lỗi H
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      aria-label="Gỡ bỏ logo"
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {logoError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{logoError}</p>
                )}
              </div>

              {/* Error Correction & Export Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="qr-ecc-select"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mức độ sửa lỗi
                  </label>
                  <select
                    id="qr-ecc-select"
                    value={errorLevel}
                    onChange={(e) => setErrorLevel(e.target.value as ErrorCorrectionLevel)}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 focus:border-[#4169E1]"
                  >
                    {ERROR_LEVELS.map((lv) => (
                      <option key={lv.value} value={lv.value}>
                        {lv.label} — {lv.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kích thước xuất file
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {EXPORT_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setExportSize(sz)}
                        className={`h-10 px-2 text-xs font-mono font-medium tabular-nums rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          exportSize === sz
                            ? 'bg-[#4169E1] text-white border-[#4169E1]'
                            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#4169E1]/60'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Live QR Preview & Export */}
        <aside
          aria-label="Xem trước và tải mã QR"
          className="lg:col-span-5 lg:sticky lg:top-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center space-y-5"
        >
          <div className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Xem trước trực tiếp
            </span>
            <span className="font-mono tabular-nums">
              {exportSize}×{exportSize} px · Mức {errorLevel}
            </span>
          </div>

          {/* Preview Box */}
          <div
            className={`w-full max-w-[310px] aspect-square rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center p-4 overflow-hidden ${
              transparentBg ? 'checkerboard-bg' : 'bg-slate-50 dark:bg-slate-950'
            }`}
          >
            {emptyMessage ? (
              <div className="text-center px-4 space-y-2">
                <Info className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {emptyMessage}
                </p>
              </div>
            ) : (
              <div
                ref={qrContainerRef}
                className="flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-[272px] [&>svg]:max-h-[272px]"
              />
            )}
          </div>

          {/* Warnings */}
          {lowContrastWarning && !emptyMessage && (
            <div className="w-full flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Độ tương phản giữa màu mã và màu nền hơi thấp, camera điện thoại có thể khó quét. Hãy chọn màu mã đậm hơn màu nền.
              </span>
            </div>
          )}

          {logoDataUrl && errorLevel !== 'H' && (
            <div className="w-full flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Đang chèn logo ở giữa: khuyên dùng mức sửa lỗi <strong>H (30%)</strong> để đảm bảo quét ổn định.
              </span>
            </div>
          )}

          {exportError && (
            <div className="w-full p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {exportError}
            </div>
          )}

          {/* Export & Copy Buttons */}
          <div className="w-full space-y-2.5 pt-1">
            <div className="w-full grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!rawPayload || isExporting !== null || isCopying}
                onClick={() => void handleExport('png')}
                className="h-11 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg bg-[#4169E1] hover:bg-[#3358CC] text-white transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting === 'png' ? 'Đang xuất...' : 'Tải PNG'}</span>
              </button>
              <button
                type="button"
                disabled={!rawPayload || isExporting !== null || isCopying}
                onClick={() => void handleExport('svg')}
                className="h-11 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting === 'svg' ? 'Đang xuất...' : 'Tải SVG'}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!rawPayload || isExporting !== null || isCopying}
              onClick={() => void handleCopyImage()}
              className={`w-full h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                copiedImage
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-[#4169E1] hover:text-[#4169E1] dark:hover:text-blue-400'
              }`}
            >
              {copiedImage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>
                {isCopying
                  ? 'Đang sao chép ảnh...'
                  : copiedImage
                    ? 'Đã sao chép ảnh QR ✓'
                    : 'Sao chép QR'}
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
