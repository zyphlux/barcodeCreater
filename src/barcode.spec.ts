import assert from "node:assert/strict";
import { barcodeBatch, barcodeCode } from "./barcode.ts";

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

const batch = barcodeBatch({
  prefix: " FA ",
  suffix: " x",
  start: 1,
  end: 3,
  step: 1,
  digits: 4,
  mode: "inc",
});
assert.equal(batch.ok, true);
if (!batch.ok) throw new Error(batch.error);
assert.deepEqual(batch.codes, ["FA0001X", "FA0002X", "FA0003X"]);
assert.equal(batch.count, 3);

const plain = barcodeBatch({
  prefix: "abc",
  suffix: "",
  start: 1,
  end: 2,
  step: 1,
  digits: 0,
  mode: "inc",
});
assert.equal(plain.ok, true);
if (!plain.ok) throw new Error(plain.error);
assert.deepEqual(plain.codes, ["ABC1", "ABC2"]);

const descending = barcodeBatch({
  prefix: "",
  suffix: "-B",
  start: 5,
  end: 3,
  step: 2,
  digits: 2,
  mode: "dec",
});
assert.equal(descending.ok, true);
if (!descending.ok) throw new Error(descending.error);
assert.deepEqual(descending.codes, ["05-B", "03-B"]);

const badPrefix = barcodeBatch({
  prefix: "箱",
  suffix: "",
  start: 1,
  end: 1,
  step: 1,
  digits: 0,
  mode: "inc",
});
assert.equal(badPrefix.ok, false);
if (badPrefix.ok) throw new Error("expected invalid prefix to fail");
assert.match(badPrefix.error, /前缀/);

const reversed = barcodeBatch({
  prefix: "",
  suffix: "",
  start: 3,
  end: 1,
  step: 1,
  digits: 0,
  mode: "inc",
});
assert.equal(reversed.ok, false);
if (reversed.ok) throw new Error("expected reversed range to fail");
assert.match(reversed.error, /结束值/);

const tooMany = barcodeBatch({
  prefix: "A",
  suffix: "",
  start: 0,
  end: 1000,
  step: 1,
  digits: 0,
  mode: "inc",
});
assert.equal(tooMany.ok, false);
if (tooMany.ok) throw new Error("expected oversized batch to fail");
assert.match(tooMany.error, /1000/);

console.log("barcode checks passed");
