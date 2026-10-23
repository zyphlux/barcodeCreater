import JsBarcode from "jsbarcode";

export type PrintSize = "15x10" | "7x4" | "7x2";
export type LabelSize = PrintSize | "fluid";

export type LabelExtras = {
  above?: string[];
  below?: string[];
};

const SIZE_CLASS: Record<LabelSize, string> = {
  fluid: "label-fluid",
  "15x10": "label-15x10",
  "7x4": "label-7x4",
  "7x2": "label-7x2",
};

const SIZE_CLASSES = Object.values(SIZE_CLASS);

export function labelSizeClass(size: LabelSize): string {
  return SIZE_CLASS[size];
}

export function isPrintSize(value: string | undefined): value is PrintSize {
  return value === "15x10" || value === "7x4" || value === "7x2";
}

function barcodeHeight(size: LabelSize): number {
  if (size === "7x2") return 40;
  if (size === "7x4") return 72;
  return 160;
}

function cleanLines(lines: string[] | undefined): string[] {
  return (lines ?? []).map((line) => line.trim()).filter((line) => line.length > 0);
}

function fillLines(host: HTMLElement, lines: string[]): void {
  host.replaceChildren();
  for (const text of lines) {
    const line = document.createElement("p");
    line.className = "label-line";
    line.textContent = text;
    host.append(line);
  }
  host.hidden = lines.length === 0;
}

export function setLabelCopy(label: HTMLElement, above: string[] | undefined, below: string[] | undefined): void {
  const aboveLines = cleanLines(above);
  const belowLines = cleanLines(below);
  const aboveHost = label.querySelector<HTMLElement>(".label-above");
  const belowHost = label.querySelector<HTMLElement>(".label-below");
  if (aboveHost) fillLines(aboveHost, aboveLines);
  if (belowHost) fillLines(belowHost, belowLines);

  const hasCopy = aboveLines.length + belowLines.length > 0;
  label.classList.toggle("has-copy", hasCopy);
  if (hasCopy) label.style.setProperty("--text-lines", String(aboveLines.length + belowLines.length + 1));
  else {
    label.style.removeProperty("--text-lines");
    const caption = label.querySelector<HTMLElement>(".label-code");
    if (caption) {
      caption.style.fontSize = "";
      caption.style.lineHeight = "";
    }
  }
}

export function renderLabels(
  container: HTMLElement,
  codes: string[],
  size: LabelSize,
  extras?: LabelExtras,
): void {
  container.replaceChildren();
  const moduleWidth = 2;

  for (const code of codes) {
    const label = document.createElement("article");
    label.className = `label ${SIZE_CLASS[size]}`;

    const aboveHost = document.createElement("div");
    aboveHost.className = "label-above";

    const barcodeWrap = document.createElement("div");
    barcodeWrap.className = "barcode-wrap";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Code 39 ${code}`);

    const caption = document.createElement("p");
    caption.className = "label-code";
    caption.textContent = code;

    const belowHost = document.createElement("div");
    belowHost.className = "label-below";

    barcodeWrap.append(svg);
    label.append(aboveHost, barcodeWrap, caption, belowHost);
    setLabelCopy(label, extras?.above, extras?.below);
    container.append(label);

    const quiet = moduleWidth * 10;
    JsBarcode(svg, code, {
      format: "CODE39",
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
      width: moduleWidth,
      height: barcodeHeight(size),
      ...(size === "fluid"
        ? { margin: quiet }
        : {
            marginTop: moduleWidth,
            marginBottom: moduleWidth,
            marginLeft: quiet,
            marginRight: quiet,
          }),
    });

    const drawnWidth = Number(svg.getAttribute("width"));
    const drawnHeight = Number(svg.getAttribute("height"));
    if (drawnWidth > 0 && drawnHeight > 0) {
      svg.setAttribute("viewBox", `0 0 ${drawnWidth} ${drawnHeight}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  }
}

const CAPTION_SCALE = 0.92;

function contentWidth(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
}

function applyTypeSize(lines: HTMLElement[], caption: HTMLElement | null, fontSize: number): void {
  for (const line of lines) {
    line.style.fontSize = `${fontSize}px`;
    line.style.lineHeight = "1.25";
    line.style.whiteSpace = "nowrap";
  }
  if (!caption) return;
  caption.style.fontSize = `${fontSize * CAPTION_SCALE}px`;
  caption.style.lineHeight = "1.15";
  caption.style.whiteSpace = "nowrap";
}

function widestText(lines: HTMLElement[], caption: HTMLElement | null): number {
  const widths = lines.map(contentWidth);
  if (caption) widths.push(contentWidth(caption));
  return widths.reduce((max, width) => Math.max(max, width), 0);
}

function typeFits(
  lines: HTMLElement[],
  caption: HTMLElement | null,
  maxWidth: number,
  maxTextHeight: number,
): boolean {
  const textHeight = lines.reduce((sum, line) => sum + line.offsetHeight, 0) + (caption?.offsetHeight ?? 0);
  return widestText(lines, caption) <= maxWidth && textHeight <= maxTextHeight + 0.5;
}

function fitLabel(label: HTMLElement): void {
  const lines = [...label.querySelectorAll<HTMLElement>(".label-line")];
  const caption = label.querySelector<HTMLElement>(".label-code");
  if (lines.length === 0 && !caption) return;

  const style = getComputedStyle(label);
  const padY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const padX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const innerH = label.clientHeight - padY;
  const innerW = label.clientWidth - padX;
  if (innerH <= 0 || innerW <= 0) return;

  const maxWidth = Math.max(1, innerW - 2);
  const maxTextHeight = innerH * 0.52;
  const preferred = Math.min(innerW * 0.048, innerH * 0.16);
  let low = 1;
  let high = Math.max(low, preferred);
  let best = 1;
  for (let step = 0; step < 16; step += 1) {
    const mid = (low + high) / 2;
    applyTypeSize(lines, caption, mid);
    if (typeFits(lines, caption, maxWidth, maxTextHeight)) {
      best = mid;
      low = mid;
    } else high = mid;
  }
  applyTypeSize(lines, caption, best);
  let guard = 0;
  while (guard < 24 && !typeFits(lines, caption, maxWidth, maxTextHeight) && best > 1) {
    best = Math.max(1, best - 0.25);
    applyTypeSize(lines, caption, best);
    guard += 1;
  }
}

export function fitLabels(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".label.has-copy").forEach(fitLabel);
}

export function applyLabelSize(label: HTMLElement, size: LabelSize): void {
  label.classList.remove(...SIZE_CLASSES);
  label.classList.add(SIZE_CLASS[size]);
}
