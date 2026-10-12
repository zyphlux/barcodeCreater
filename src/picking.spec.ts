import assert from "node:assert/strict";
import { pickingCodes } from "./picking.ts";

const generated = pickingCodes(" c12 ");
assert.equal(generated.ok, true);
if (!generated.ok) throw new Error(generated.error);
assert.deepEqual(generated.codes, [
  "C12-A1",
  "C12-A2",
  "C12-A3",
  "C12-A4",
  "C12-B1",
  "C12-B2",
  "C12-B3",
  "C12-B4",
]);
assert.equal(generated.count, 8);

const empty = pickingCodes("  ");
assert.equal(empty.ok, false);
if (empty.ok) throw new Error("expected empty container to fail");
assert.match(empty.error, /容器号/);

const invalid = pickingCodes("箱-01");
assert.equal(invalid.ok, false);
if (invalid.ok) throw new Error("expected invalid characters to fail");
assert.match(invalid.error, /不支持/);

console.log("picking checks passed");
