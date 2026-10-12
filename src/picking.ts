export const PICK_SLOTS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"] as const;

const CODE39 = /^[0-9A-Z.$/+% -]+$/;

export type PickingSuccess = { ok: true; codes: string[]; count: number };
export type PickingFailure = { ok: false; error: string };
export type PickingResult = PickingSuccess | PickingFailure;

export function pickingCodes(raw: string): PickingResult {
  const container = raw.trim().toUpperCase();
  if (!container) return { ok: false, error: "请输入容器号" };
  if (!CODE39.test(container)) return { ok: false, error: "容器号含有条码不支持的字符" };

  const codes = PICK_SLOTS.map((slot) => `${container}-${slot}`);
  return { ok: true, codes, count: codes.length };
}
