import assert from "node:assert/strict";
import {
  countLocationGroups,
  DEFAULT_SEGMENTS,
  generateCodes,
  groupLocationCodes,
  type SegmentConfig,
} from "./generate.ts";

const defaults = generateCodes(DEFAULT_SEGMENTS);
assert.equal(defaults.ok, true);
if (!defaults.ok) throw new Error(defaults.error);
assert.equal(defaults.count, 17);
assert.equal(defaults.codes[0], "403.04.1.1");
assert.equal(defaults.codes[1], "403.05.1.1");
assert.equal(defaults.codes[16], "403.20.1.1");

const nested: SegmentConfig[] = [
  { start: 403, end: 405, mode: "fixed", step: 1, digits: 0 },
  { start: 4, end: 5, mode: "inc", step: 1, digits: 2 },
  { start: 1, end: 9, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 3, mode: "inc", step: 1, digits: 0 },
];
const nestedResult = generateCodes(nested);
assert.equal(nestedResult.ok, true);
if (!nestedResult.ok) throw new Error(nestedResult.error);
assert.deepEqual(nestedResult.codes, [
  "403.04.1.1",
  "403.04.1.2",
  "403.04.1.3",
  "403.05.1.1",
  "403.05.1.2",
  "403.05.1.3",
]);

const decreasing = generateCodes([
  { start: 2, end: 1, mode: "dec", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
]);
assert.equal(decreasing.ok, true);
if (!decreasing.ok) throw new Error(decreasing.error);
assert.deepEqual(decreasing.codes, ["2.1.1.1", "1.1.1.1"]);

const invalidRange = generateCodes([
  { start: 5, end: 1, mode: "inc", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
]);
assert.equal(invalidRange.ok, false);

const tooMany = generateCodes([
  { start: 1, end: 50, mode: "inc", step: 1, digits: 0 },
  { start: 1, end: 50, mode: "inc", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
]);
assert.equal(tooMany.ok, false);
if (tooMany.ok) throw new Error("expected limit");
assert.match(tooMany.error, /1000/);

const rack: SegmentConfig[] = [
  { start: 204, end: 204, mode: "fixed", step: 1, digits: 0 },
  { start: 2, end: 3, mode: "inc", step: 1, digits: 2 },
  { start: 5, end: 1, mode: "dec", step: 1, digits: 0 },
  { start: 2, end: 2, mode: "fixed", step: 1, digits: 0 },
];
const rackCodes = generateCodes(rack);
assert.equal(rackCodes.ok, true);
if (!rackCodes.ok) throw new Error(rackCodes.error);
const rackGroups = groupLocationCodes(rack, rackCodes.codes, 2);
assert.equal(rackGroups.length, 2);
assert.deepEqual(rackGroups[0], ["204.02.5.2", "204.02.4.2", "204.02.3.2", "204.02.2.2", "204.02.1.2"]);
assert.deepEqual(rackGroups[1], ["204.03.5.2", "204.03.4.2", "204.03.3.2", "204.03.2.2", "204.03.1.2"]);

const rackCount = countLocationGroups(rack, 2);
assert.deepEqual(rackCount, { groups: 2, count: 10 });

const crossed: SegmentConfig[] = [
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 2, mode: "inc", step: 1, digits: 0 },
  { start: 1, end: 1, mode: "fixed", step: 1, digits: 0 },
  { start: 1, end: 2, mode: "inc", step: 1, digits: 0 },
];
const crossedCodes = generateCodes(crossed);
assert.equal(crossedCodes.ok, true);
if (!crossedCodes.ok) throw new Error(crossedCodes.error);
assert.deepEqual(groupLocationCodes(crossed, crossedCodes.codes, 1), [
  ["1.1.1.1", "1.2.1.1"],
  ["1.1.1.2", "1.2.1.2"],
]);

const badAxis = countLocationGroups(rack, 4);
assert.ok("error" in badAxis);

console.log("generate checks passed");
