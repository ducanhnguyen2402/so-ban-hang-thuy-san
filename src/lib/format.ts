import type { WeightUnit } from '../types/database';

export const WEIGHT_UNIT_OPTIONS: ReadonlyArray<{
  unit: WeightUnit;
  label: string;
  toKgFactor: number;
}> = [
  { unit: 'kg', label: 'kg', toKgFactor: 1 },
  { unit: 'lang', label: 'lạng', toKgFactor: 0.1 },
  { unit: 'g', label: 'g', toKgFactor: 0.001 },
  { unit: 'yen', label: 'yến', toKgFactor: 10 },
];

export function formatVnd(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const sign = rounded < 0 ? '-' : '';
  const absFormatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));
  return `${sign}${absFormatted}đ`;
}

export function formatKg(kg: number): string {
  const safe = Number.isFinite(kg) ? kg : 0;
  const formatted = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(safe);
  return `${formatted} kg`;
}

/**
 * Chuyển chuỗi người dùng nhập (hỗ trợ cả dấu phẩy "," và dấu chấm ".") sang số thực.
 * Trả về null nếu không hợp lệ.
 */
export function parseDecimalInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Quy đổi số lượng từ đơn vị người bán chọn (kg, lạng, g, yến) sang kg chuẩn.
 */
export function convertToKg(quantity: number, unit: WeightUnit): number {
  const option = WEIGHT_UNIT_OPTIONS.find((u) => u.unit === unit);
  const factor = option ? option.toKgFactor : 1;
  return Math.round(quantity * factor * 1000) / 1000;
}

export function calculateLineTotal(quantityKg: number, unitPrice: number): number {
  if (!Number.isFinite(quantityKg) || !Number.isFinite(unitPrice)) return 0;
  if (quantityKg < 0 || unitPrice < 0) return 0;
  return Math.round(quantityKg * unitPrice);
}

/**
 * Chuyển chuỗi tiền VND (có thể chứa dấu chấm, phẩy, khoảng trắng, chữ đ) sang số nguyên >= 0.
 * Trả về null nếu không hợp lệ hoặc âm.
 */
export function parseVndInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[.,\sđĐdD]/g, '');
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt bỏ dấu, chữ thường để tìm kiếm nhanh.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
