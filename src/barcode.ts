import { MAX_DIGITS, MAX_LABELS, MAX_VALUE } from "./generate.ts";

const CODE39 = /^[0-9A-Z.$/+% -]+$/;

export type BarcodeSuccess = { ok: true; code: string };
export type BarcodeFailure = { ok: false; error: string };
export type BarcodeResult = BarcodeSuccess | BarcodeFailure;

export type BarcodeGrowth = "inc" | "dec";

export interface BarcodeBatchConfig {
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  step: number;
  digits: number;
  mode: BarcodeGrowth;
}

export type BarcodeBatchSuccess = { ok: true; codes: string[]; count: number };
export type BarcodeBatchResult = BarcodeBatchSuccess | BarcodeFailure;

export function barcodeCode(raw: string): BarcodeResult {
  const code = raw.trim().toUpperCase();
  if (!code) return { ok: false, error: "请输入条码内容" };
  if (!CODE39.test(code)) return { ok: false, error: "条码内容含有不支持的字符" };
  return { ok: true, code };
}

function textPart(raw: string, label: string): { ok: true; text: string } | BarcodeFailure {
  const text = raw.trim().toUpperCase();
  if (text && !CODE39.test(text)) return { ok: false, error: `${label}含有条码不支持的字符` };
  return { ok: true, text };
}

function checkInteger(value: number, label: string): string | null {
  if (!Number.isInteger(value) || value < 0) return `${label}须为非负整数`;
  if (value > MAX_VALUE) return `${label}不能超过 ${MAX_VALUE}`;
  return null;
}

export function barcodeBatch(config: BarcodeBatchConfig): BarcodeBatchResult {
  const prefix = textPart(config.prefix, "前缀");
  if (!prefix.ok) return prefix;
  const suffix = textPart(config.suffix, "后缀");
  if (!suffix.ok) return suffix;

  const startError = checkInteger(config.start, "起始值");
  if (startError) return { ok: false, error: startError };
  const digitsError = checkInteger(config.digits, "位数");
  if (digitsError) return { ok: false, error: digitsError };
  if (config.digits > MAX_DIGITS) return { ok: false, error: `位数不能超过 ${MAX_DIGITS}` };
  if (config.mode !== "inc" && config.mode !== "dec") return { ok: false, error: "增长方式无效" };

  const stepError = checkInteger(config.step, "步长");
  if (stepError) return { ok: false, error: stepError };
  if (config.step < 1) return { ok: false, error: "步长须为正整数" };

  const endError = checkInteger(config.end, "结束值");
  if (endError) return { ok: false, error: endError };
  if (config.mode === "inc" && config.end < config.start) {
    return { ok: false, error: "递增时，结束值不能小于起始值" };
  }
  if (config.mode === "dec" && config.end > config.start) {
    return { ok: false, error: "递减时，结束值不能大于起始值" };
  }

  const span = config.mode === "inc" ? config.end - config.start : config.start - config.end;
  const count = Math.floor(span / config.step) + 1;
  if (count > MAX_LABELS) return { ok: false, error: `将生成超过 ${MAX_LABELS} 张，请缩小范围` };

  const codes: string[] = [];
  const format = (value: number): string =>
    `${prefix.text}${String(value).padStart(config.digits, "0")}${suffix.text}`;
  if (config.mode === "inc") {
    for (let value = config.start; value <= config.end; value += config.step) codes.push(format(value));
  } else {
    for (let value = config.start; value >= config.end; value -= config.step) codes.push(format(value));
  }
  return { ok: true, codes, count: codes.length };
}
