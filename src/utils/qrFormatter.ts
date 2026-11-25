export type QrContentType = 'text' | 'wifi' | 'vcard';

export type WifiEncryption = 'WPA' | 'WEP' | 'nopass';

export interface WifiPayload {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
}

export interface VCardPayload {
  fullName: string;
  phone: string;
  email: string;
  website: string;
  organization: string;
}

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function escapeVCardField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function buildWifiQrString(wifi: WifiPayload): string {
  const ssid = wifi.ssid.trim();
  if (!ssid) return '';
  const enc = wifi.encryption;
  const escapedSsid = escapeWifiField(ssid);
  const escapedPass = enc === 'nopass' ? '' : escapeWifiField(wifi.password);
  const hiddenFlag = wifi.hidden ? 'H:true;' : '';
  return `WIFI:T:${enc};S:${escapedSsid};P:${escapedPass};${hiddenFlag};`;
}

export function buildVCardQrString(vcard: VCardPayload): string {
  const name = vcard.fullName.trim();
  const phone = vcard.phone.trim();
  const email = vcard.email.trim();
  const website = vcard.website.trim();
  const org = vcard.organization.trim();

  if (!name && !phone && !email && !website) {
    return '';
  }

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (name) {
    const escaped = escapeVCardField(name);
    lines.push(`FN;CHARSET=UTF-8:${escaped}`);
    lines.push(`N;CHARSET=UTF-8:${escaped};;;;`);
  }
  if (org) {
    lines.push(`ORG;CHARSET=UTF-8:${escapeVCardField(org)}`);
  }
  if (phone) {
    lines.push(`TEL;TYPE=CELL:${phone}`);
  }
  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET:${email}`);
  }
  if (website) {
    const normalizedUrl = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    lines.push(`URL:${normalizedUrl}`);
  }

  lines.push('END:VCARD');
  return lines.join('\n');
}

export function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * qr-code-styling uses qrcode-generator's default Latin-1 byte encoder (charCodeAt & 0xff).
 * Pre-encoding UTF-8 strings into binary Latin-1 byte strings ensures Vietnamese diacritics
 * are stored as proper UTF-8 bytes and decoded accurately by mobile QR scanners.
 */
export function encodeUtf8ForQr(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

