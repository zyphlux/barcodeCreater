import "./style.css";
import {
  countLabels,
  generateCodes,
  type GrowthMode,
  type SegmentConfig,
} from "./generate";
import { barcodeBatch, barcodeCode, type BarcodeBatchConfig } from "./barcode";
import {
  applyLabelSize,
  fitLabels,
  isPrintSize,
  labelSizeClass,
  renderLabels,
  setLabelCopy,
  type LabelExtras,
  type PrintSize,
} from "./labels";
import { pickingCodes } from "./picking";

const MODES: { value: GrowthMode; label: string }[] = [
  { value: "fixed", label: "固定" },
  { value: "inc", label: "递增" },
  { value: "dec", label: "递减" },
];

const PLACEHOLDERS = [
  { start: "1", end: "1", step: "1", digits: "3" },
  { start: "1", end: "1", step: "1", digits: "2" },
  { start: "1", end: "1", step: "1", digits: "0" },
  { start: "1", end: "1", step: "1", digits: "0" },
];

const EXAMPLE_CODE = "001.01.1.1";
const TITLES = {
  home: "条码生成",
  location: "库位条码",
  pick: "拣选框",
  barcode: "条码生成器",
} as const;

const PAGE_SIZE: Record<PrintSize, string> = {
  "15x10": "15cm 10cm",
  "7x4": "7cm 4cm",
  "7x2": "7cm 2cm",
};

type AppRoute = keyof typeof TITLES;

const home = document.querySelector<HTMLElement>("#home")!;
const tabs = document.querySelector<HTMLElement>("#tabs")!;
const form = document.querySelector<HTMLFormElement>("#form")!;
const pickForm = document.querySelector<HTMLFormElement>("#pick-form")!;
const barcodeForm = document.querySelector<HTMLFormElement>("#barcode-form")!;
const barcodeInput = document.querySelector<HTMLInputElement>("#barcode-value")!;
const containerInput = document.querySelector<HTMLInputElement>("#container")!;
const segmentsRoot = document.querySelector<HTMLElement>("#segments")!;
const countEl = document.querySelector<HTMLElement>("#count")!;
const errorEl = document.querySelector<HTMLElement>("#error")!;
const errorText = document.querySelector<HTMLElement>("#error-text")!;
const pickErrorEl = document.querySelector<HTMLElement>("#pick-error")!;
const pickErrorText = document.querySelector<HTMLElement>("#pick-error-text")!;
const barcodeErrorEl = document.querySelector<HTMLElement>("#barcode-error")!;
const barcodeErrorText = document.querySelector<HTMLElement>("#barcode-error-text")!;
const barcodeCountEl = document.querySelector<HTMLElement>("#barcode-count")!;
const barcodeSingle = document.querySelector<HTMLElement>("#barcode-single")!;
const barcodeBatchPanel = document.querySelector<HTMLElement>("#barcode-batch")!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const preview = document.querySelector<HTMLElement>("#preview")!;
const printLabelButtons = [...document.querySelectorAll<HTMLButtonElement>(".print-label")];
const printA4Buttons = [...document.querySelectorAll<HTMLButtonElement>(".print-a4")];
const pageSize = document.querySelector<HTMLStyleElement>("#page-size")!;
const exportDialog = document.querySelector<HTMLDialogElement>("#export-dialog")!;
const pickMask = document.querySelector<HTMLButtonElement>("#pick-mask")!;
const exportMode = document.querySelector<HTMLElement>("#export-mode")!;

let currentRoute: AppRoute = "home";
let currentCodes: string[] = [];
let locationCodes: string[] = [];
let pickCodes: string[] = [];
let barcodeCodes: string[] = [];
let barcodeSize: PrintSize = "15x10";
let opened = false;
let pendingPrint: "label" | "a4" | null = null;

function field(name: string, label: string, placeholder: string, min: number): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const title = document.createElement("span");
  title.className = "field-label";
  title.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.name = name;
  input.min = String(min);
  input.step = "1";
  input.required = true;
  input.placeholder = placeholder;
  input.value = "";
  input.inputMode = "numeric";
  wrapper.append(title, input);
  return wrapper;
}

function buildSegments(): void {
  PLACEHOLDERS.forEach((segment, index) => {
    const row = document.createElement("div");
    row.className = "segment";
    row.dataset.index = String(index);

    const legend = document.createElement("div");
    legend.className = "segment-name";
    legend.textContent = `第 ${index + 1} 段`;

    const modeLabel = document.createElement("label");
    modeLabel.className = "field";
    const modeTitle = document.createElement("span");
    modeTitle.className = "field-label";
    modeTitle.textContent = "增长方式";
    const select = document.createElement("select");
    select.name = "mode";
    for (const mode of MODES) {
      const option = document.createElement("option");
      option.value = mode.value;
      option.textContent = mode.label;
      option.selected = mode.value === "fixed";
      select.append(option);
    }
    modeLabel.append(modeTitle, select);

    row.append(
      legend,
      field("start", "起始值", segment.start, 0),
      field("end", "结束值", segment.end, 0),
      modeLabel,
      field("step", "步长", segment.step, 1),
      field("digits", "位数", segment.digits, 0),
    );
    segmentsRoot.append(row);
    syncMode(row);
    select.addEventListener("change", () => syncMode(row));
  });
}

function syncMode(row: HTMLElement): void {
  const mode = row.querySelector<HTMLSelectElement>('[name="mode"]')!.value;
  const locked = mode === "fixed";
  const sample = PLACEHOLDERS[Number(row.dataset.index)];
  for (const name of ["end", "step"] as const) {
    const input = row.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    input.disabled = locked;
    input.placeholder = locked ? "" : sample[name];
  }
}

function readInteger(input: HTMLInputElement): number {
  if (input.value.trim() === "") return Number.NaN;
  return Number(input.value);
}

function fieldsAreEmpty(): boolean {
  return [...segmentsRoot.querySelectorAll<HTMLInputElement>("input")].every((input) => input.value.trim() === "");
}

function readSegments(): SegmentConfig[] {
  return [...segmentsRoot.querySelectorAll<HTMLElement>(".segment")].map((row) => ({
    start: readInteger(row.querySelector<HTMLInputElement>('[name="start"]')!),
    end: readInteger(row.querySelector<HTMLInputElement>('[name="end"]')!),
    mode: row.querySelector<HTMLSelectElement>('[name="mode"]')!.value as GrowthMode,
    step: readInteger(row.querySelector<HTMLInputElement>('[name="step"]')!),
    digits: readInteger(row.querySelector<HTMLInputElement>('[name="digits"]')!),
  }));
}

function exportSize(): PrintSize {
  const selected = exportDialog.querySelector<HTMLInputElement>('input[name="export-size"]:checked');
  return isPrintSize(selected?.value) ? selected.value : "15x10";
}

function setPrintEnabled(enabled: boolean): void {
  for (const button of printLabelButtons) button.disabled = !enabled;
  for (const button of printA4Buttons) button.disabled = !enabled;
}

function setError(message: string): void {
  errorText.textContent = message;
  errorEl.hidden = message.length === 0;
}

function setPickError(message: string): void {
  pickErrorText.textContent = message;
  pickErrorEl.hidden = message.length === 0;
}

function setBarcodeError(message: string): void {
  barcodeErrorText.textContent = message;
  barcodeErrorEl.hidden = message.length === 0;
}

function renderCount(count: number | null, tick: boolean): void {
  countEl.replaceChildren();
  if (count === null) {
    countEl.textContent = "无法计算张数";
    return;
  }
  countEl.append("将生成 ");
  const number = document.createElement("strong");
  number.className = tick ? "count-num tick" : "count-num";
  number.textContent = String(count);
  countEl.append(number, " 张");
}

function setBarcodeFit(mode: "meet" | "slice"): void {
  preview.querySelectorAll("svg").forEach((svg) => {
    svg.setAttribute("preserveAspectRatio", `xMidYMid ${mode}`);
  });
}

function setLabelSizeClass(size: PrintSize | "fluid"): void {
  preview.querySelectorAll<HTMLElement>(".label").forEach((label) => applyLabelSize(label, size));
}

function readCopy(side: "above" | "below"): string[] {
  const host = barcodeForm.querySelector<HTMLElement>(`.copy-lines[data-side="${side}"]`);
  if (!host) return [];
  return [...host.querySelectorAll<HTMLInputElement>("input")]
    .map((input) => input.value.trim())
    .filter((line) => line.length > 0);
}

function barcodeExtras(): LabelExtras {
  return { above: readCopy("above"), below: readCopy("below") };
}

function refreshBarcodeCopy(): void {
  if (currentRoute !== "barcode" || barcodeCodes.length === 0) return;
  const labels = [...preview.querySelectorAll<HTMLElement>(".label")];
  if (labels.length === 0) return;
  const extras = barcodeExtras();
  for (const label of labels) setLabelCopy(label, extras.above, extras.below);
  fitLabels(preview);
}

function barcodeMode(): "single" | "batch" {
  const selected = barcodeForm.querySelector<HTMLInputElement>('input[name="barcode-mode"]:checked');
  return selected?.value === "batch" ? "batch" : "single";
}

function syncBarcodeMode(): void {
  const batch = barcodeMode() === "batch";
  barcodeSingle.hidden = batch;
  barcodeBatchPanel.hidden = !batch;
}

function batchInput(name: string): HTMLInputElement {
  return barcodeBatchPanel.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
}

function batchNumbersReady(): boolean {
  return ["batch-start", "batch-end", "batch-step", "batch-digits"].every(
    (name) => batchInput(name).value.trim() !== "",
  );
}

function readBatch(): BarcodeBatchConfig {
  const mode = barcodeBatchPanel.querySelector<HTMLSelectElement>('[name="batch-mode"]')!.value;
  return {
    prefix: batchInput("batch-prefix").value,
    suffix: batchInput("batch-suffix").value,
    start: readInteger(batchInput("batch-start")),
    end: readInteger(batchInput("batch-end")),
    step: readInteger(batchInput("batch-step")),
    digits: readInteger(batchInput("batch-digits")),
    mode: mode === "dec" ? "dec" : "inc",
  };
}

function renderBarcodeCount(count: number | null): void {
  barcodeCountEl.replaceChildren();
  if (count === null) {
    barcodeCountEl.textContent = "无法计算张数";
    return;
  }
  barcodeCountEl.append("将生成 ");
  const number = document.createElement("strong");
  number.className = "count-num";
  number.textContent = String(count);
  barcodeCountEl.append(number, " 张");
}

function refreshBarcodeCount(): void {
  if (barcodeMode() !== "batch") return;
  if (!batchNumbersReady()) {
    setBarcodeError("");
    barcodeCountEl.textContent = "填写后生成";
    return;
  }
  const result = barcodeBatch(readBatch());
  if (!result.ok) {
    renderBarcodeCount(null);
    setBarcodeError(result.error);
    return;
  }
  setBarcodeError("");
  renderBarcodeCount(result.count);
}

function addCopyLine(side: "above" | "below"): void {
  const host = barcodeForm.querySelector<HTMLElement>(`.copy-lines[data-side="${side}"]`);
  if (!host) return;
  const row = document.createElement("div");
  row.className = "copy-row";
  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = side === "above" ? "条码上方的一行" : "条码下方的一行";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "copy-remove";
  remove.textContent = "删除";
  row.append(input, remove);
  host.append(row);
  input.focus();
}

function sameCodes(codes: string[]): boolean {
  return codes.length === currentCodes.length && codes.every((code, index) => code === currentCodes[index]);
}

function refreshCount(): void {
  if (fieldsAreEmpty()) {
    setError("");
    countEl.textContent = "填写后生成";
    return;
  }
  const counted = countLabels(readSegments());
  if ("error" in counted) {
    renderCount(null, false);
    setError(counted.error);
    return;
  }
  setError("");
  renderCount(counted.count, false);
}

function showExample(): void {
  currentCodes = [];
  document.body.dataset.size = "fluid";
  preview.classList.add("is-example");
  preview.classList.remove("preview-pick", "preview-barcode");
  renderLabels(preview, [EXAMPLE_CODE], "fluid");
  setPrintEnabled(false);
}

function showPickEmpty(): void {
  currentCodes = [];
  preview.classList.remove("is-example", "preview-pick", "preview-barcode");
  preview.replaceChildren();
  setPrintEnabled(false);
}

function showBarcodeEmpty(): void {
  currentCodes = [];
  preview.classList.remove("is-example", "preview-pick", "preview-barcode", "is-batch");
  preview.replaceChildren();
  setPrintEnabled(false);
}

function showBarcode(): void {
  const extras = barcodeExtras();
  const sizeClass = labelSizeClass(barcodeSize);
  const existing = preview.querySelector<HTMLElement>(".label");
  const reuse =
    existing !== null &&
    sameCodes(barcodeCodes) &&
    preview.childElementCount === barcodeCodes.length &&
    preview.classList.contains("preview-barcode") &&
    existing.classList.contains(sizeClass);

  currentCodes = barcodeCodes.slice();
  document.body.dataset.size = barcodeSize;
  preview.classList.remove("is-example", "preview-pick");
  preview.classList.add("preview-barcode");
  preview.classList.toggle("is-batch", barcodeCodes.length > 1);
  if (reuse) {
    for (const label of preview.querySelectorAll<HTMLElement>(".label")) {
      setLabelCopy(label, extras.above, extras.below);
    }
  } else renderLabels(preview, barcodeCodes, barcodeSize, extras);
  setBarcodeFit("meet");
  fitLabels(preview);
  setPrintEnabled(barcodeCodes.length > 0);
}

function showLabels(codes: string[]): void {
  const pickLayout = currentRoute === "pick";
  const reuse =
    sameCodes(codes) &&
    preview.childElementCount === codes.length &&
    preview.classList.contains("preview-pick") === pickLayout &&
    !preview.classList.contains("preview-barcode");
  currentCodes = codes;
  document.body.dataset.size = "fluid";
  preview.classList.remove("is-example", "preview-barcode");
  preview.classList.toggle("preview-pick", pickLayout);
  if (reuse) setLabelSizeClass("fluid");
  else renderLabels(preview, codes, "fluid");
  setBarcodeFit(pickLayout ? "slice" : "meet");
  setPrintEnabled(codes.length > 0);
}

function syncPreview(): void {
  if (currentRoute === "pick") {
    if (pickCodes.length > 0) showLabels(pickCodes);
    else showPickEmpty();
    return;
  }
  if (currentRoute === "barcode") {
    if (barcodeCodes.length > 0) showBarcode();
    else showBarcodeEmpty();
    return;
  }
  if (currentRoute === "location") {
    if (locationCodes.length > 0) showLabels(locationCodes);
    else showExample();
  }
}

function generate(): void {
  const result = generateCodes(readSegments());
  if (!result.ok) {
    locationCodes = [];
    currentCodes = [];
    preview.classList.remove("is-example", "preview-pick", "preview-barcode");
    preview.replaceChildren();
    renderCount(null, false);
    setError(result.error);
    setPrintEnabled(false);
    return;
  }
  setError("");
  renderCount(result.count, opened);
  opened = true;
  locationCodes = result.codes;
  showLabels(result.codes);
}

function selectContainerText(): void {
  const length = containerInput.value.length;
  if (document.activeElement !== containerInput || length === 0) return;
  if (containerInput.selectionStart === 0 && containerInput.selectionEnd === length) return;
  containerInput.setSelectionRange(0, length);
}

let suppressCaret = false;
let suppressUntil = 0;

function armContainerSelect(): void {
  suppressCaret = true;
  suppressUntil = performance.now() + 300;
  const tick = (): void => {
    selectContainerText();
    if (performance.now() < suppressUntil) requestAnimationFrame(tick);
    else suppressCaret = false;
  };
  tick();
}

function focusContainer(selectAll: boolean): void {
  containerInput.focus();
  if (selectAll) armContainerSelect();
}

function syncPickMask(): void {
  const blurred = document.activeElement !== containerInput;
  pickMask.hidden = !(currentRoute === "pick" && blurred && !exportDialog.open);
}

function generatePick(): void {
  const result = pickingCodes(containerInput.value);
  if (!result.ok) {
    pickCodes = [];
    currentCodes = [];
    preview.classList.remove("is-example", "preview-pick", "preview-barcode");
    preview.replaceChildren();
    setPickError(result.error);
    setPrintEnabled(false);
  } else {
    setPickError("");
    pickCodes = result.codes;
    showLabels(result.codes);
  }
  focusContainer(true);
}

function clearBarcodePreview(message: string): void {
  barcodeCodes = [];
  currentCodes = [];
  preview.classList.remove("is-example", "preview-pick", "preview-barcode", "is-batch");
  preview.replaceChildren();
  setBarcodeError(message);
  setPrintEnabled(false);
}

function generateBarcode(): void {
  if (barcodeMode() === "batch") {
    const result = barcodeBatch(readBatch());
    if (!result.ok) {
      clearBarcodePreview(result.error);
      renderBarcodeCount(null);
      return;
    }
    setBarcodeError("");
    renderBarcodeCount(result.count);
    barcodeCodes = result.codes;
    showBarcode();
    return;
  }
  const result = barcodeCode(barcodeInput.value);
  if (!result.ok) {
    clearBarcodePreview(result.error);
    return;
  }
  setBarcodeError("");
  barcodeCodes = [result.code];
  showBarcode();
}

function applyPage(mode: "label" | "a4"): void {
  const size = exportSize();
  document.body.dataset.print = mode;
  document.body.dataset.size = size;
  setLabelSizeClass(size);
  setBarcodeFit("meet");
  const page = mode === "a4" ? "A4" : PAGE_SIZE[size];
  const margin = mode === "a4" ? "6mm" : "0";
  pageSize.textContent = `@page { size: ${page}; margin: ${margin}; }`;
}

function restoreScreen(): void {
  document.body.removeAttribute("data-print");
  if (currentRoute === "barcode" && barcodeCodes.length > 0) {
    document.body.dataset.size = barcodeSize;
    setLabelSizeClass(barcodeSize);
    setBarcodeFit("meet");
    fitLabels(preview);
    return;
  }
  document.body.dataset.size = "fluid";
  if (preview.querySelector(".label")) {
    setLabelSizeClass("fluid");
    setBarcodeFit(currentRoute === "pick" ? "slice" : "meet");
  }
}

function openExport(mode: "label" | "a4"): void {
  pendingPrint = mode;
  exportMode.textContent = mode === "a4" ? "A4 拼版打印" : "打印 / 导出 PDF";
  if (currentRoute === "barcode") {
    const radio = exportDialog.querySelector<HTMLInputElement>(`input[name="export-size"][value="${barcodeSize}"]`);
    if (radio) radio.checked = true;
  }
  pickMask.hidden = true;
  exportDialog.showModal();
}

function routeFromPath(pathname: string): { path: string; route: AppRoute } {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/location") return { path, route: "location" };
  if (path === "/pick") return { path, route: "pick" };
  if (path === "/barcode") return { path, route: "barcode" };
  return { path: "/", route: "home" };
}

function renderRoute(): void {
  const next = routeFromPath(location.pathname);
  if (next.path !== location.pathname) history.replaceState(null, "", next.path);
  currentRoute = next.route;
  document.body.dataset.route = next.route;
  document.title = TITLES[next.route];

  const atHome = next.route === "home";
  home.hidden = !atHome;
  tabs.hidden = atHome;
  form.hidden = next.route !== "location";
  pickForm.hidden = next.route !== "pick";
  barcodeForm.hidden = next.route !== "barcode";
  stage.hidden = atHome;

  tabs.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    const active = link.dataset.route === next.route;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (!atHome) syncPreview();
  pickMask.hidden = true;
  if (next.route === "pick") {
    requestAnimationFrame(() => {
      if (currentRoute === "pick") focusContainer(true);
      syncPickMask();
    });
  }
}

function navigate(pathname: string): void {
  const next = routeFromPath(pathname);
  if (next.path === location.pathname) return;
  history.pushState(null, "", next.path);
  renderRoute();
}

buildSegments();
refreshCount();
syncBarcodeMode();
renderRoute();
window.addEventListener("popstate", renderRoute);

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest("a");
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.target && link.target !== "_self") return;
  if (link.origin !== location.origin) return;
  const href = link.getAttribute("href");
  if (!href || !href.startsWith("/")) return;
  event.preventDefault();
  navigate(link.pathname);
});

form.addEventListener("input", () => {
  refreshCount();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});

pickForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generatePick();
});

barcodeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateBarcode();
});

barcodeForm.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.closest(".copy-lines")) refreshBarcodeCopy();
  if (target.closest("#barcode-batch")) refreshBarcodeCount();
});

barcodeForm.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === "barcode-mode") {
    syncBarcodeMode();
    refreshBarcodeCount();
    return;
  }
  if (target instanceof HTMLSelectElement && target.name === "batch-mode") {
    refreshBarcodeCount();
    return;
  }
  if (!(target instanceof HTMLInputElement) || target.name !== "barcode-size") return;
  if (!isPrintSize(target.value)) return;
  barcodeSize = target.value;
  if (barcodeCodes.length > 0) showBarcode();
});

barcodeForm.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest("button");
  if (!(button instanceof HTMLButtonElement)) return;
  if (button.classList.contains("copy-add")) {
    addCopyLine(button.dataset.side === "below" ? "below" : "above");
    return;
  }
  if (button.classList.contains("copy-remove")) {
    button.closest(".copy-row")?.remove();
    refreshBarcodeCopy();
  }
});

function reclaimFromMask(event: Event): void {
  event.preventDefault();
  focusContainer(containerInput.value.length > 0);
  setTimeout(() => {
    if (document.activeElement === pickMask) focusContainer(containerInput.value.length > 0);
  }, 0);
}

pickMask.addEventListener("pointerdown", reclaimFromMask);
pickMask.addEventListener("click", reclaimFromMask);

function schedulePickMask(): void {
  setTimeout(syncPickMask, 0);
}

containerInput.addEventListener("focus", () => {
  pickMask.hidden = true;
  if (containerInput.value.length > 0) armContainerSelect();
});

containerInput.addEventListener("blur", schedulePickMask);
document.addEventListener("pointerup", schedulePickMask);
document.addEventListener("focusin", () => {
  if (document.activeElement === containerInput) pickMask.hidden = true;
  else schedulePickMask();
});

document.addEventListener("selectionchange", () => {
  if (!suppressCaret) return;
  selectContainerText();
});

stage.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest("button");
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  if (button.classList.contains("print-label")) openExport("label");
  if (button.classList.contains("print-a4")) openExport("a4");
});

exportDialog.addEventListener("close", () => {
  const mode = pendingPrint;
  pendingPrint = null;
  syncPickMask();
  if (exportDialog.returnValue !== "ok" || !mode) return;
  applyPage(mode);
  window.print();
});

window.addEventListener("beforeprint", () => {
  if (!document.body.dataset.print) applyPage("label");
  fitLabels(preview);
});

function refitBarcode(): void {
  if (document.body.dataset.print) return;
  if (currentRoute === "barcode") fitLabels(preview);
}

window.addEventListener("resize", refitBarcode);
document.fonts.ready.then(refitBarcode);

window.addEventListener("afterprint", () => {
  restoreScreen();
});
