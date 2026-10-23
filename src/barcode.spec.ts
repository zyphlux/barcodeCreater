import assert from "node:assert/strict";
import { barcodeCode } from "./barcode.ts";

const generated = barcodeCode(" abc-12 ");
assert.equal(generated.ok, true);
if (!generated.ok) throw new Error(generated.error);
assert.equal(generated.code, "ABC-12");

const symbols = barcodeCode("a.b$c/d+e% f-1");
assert.equal(symbols.ok, true);
if (!symbols.ok) throw new Error(symbols.error);
assert.equal(symbols.code, "A.B$C/D+E% F-1");

const empty = barcodeCode("  ");
assert.equal(empty.ok, false);
if (empty.ok) throw new Error("expected empty content to fail");
assert.match(empty.error, /条码内容/);

const invalid = barcodeCode("箱-01");
assert.equal(invalid.ok, false);
if (invalid.ok) throw new Error("expected invalid characters to fail");
assert.match(invalid.error, /不支持/);

console.log("barcode checks passed");
