const CODE39 = /^[0-9A-Z.$/+% -]+$/;

export type BarcodeSuccess = { ok: true; code: string };
export type BarcodeFailure = { ok: false; error: string };
export type BarcodeResult = BarcodeSuccess | BarcodeFailure;

export function barcodeCode(raw: string): BarcodeResult {
  const code = raw.trim().toUpperCase();
  if (!code) return { ok: false, error: "请输入条码内容" };
  if (!CODE39.test(code)) return { ok: false, error: "条码内容含有不支持的字符" };
  return { ok: true, code };
}
