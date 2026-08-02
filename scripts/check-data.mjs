import { readFile } from "node:fs/promises";

const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const records = JSON.parse(
  await readFile(new URL("../public/data/ratios.json", import.meta.url), "utf8"),
);
const employments = ["a", "f", "t"];

if (
  index.placeCount !== 48 ||
  index.prefectureCount !== 47 ||
  index.groupCount !== 11 ||
  index.occupationCount !== 73 ||
  index.recordCount !== 3504 ||
  index.employmentCount !== 3 ||
  index.pairCount !== 31536 ||
  index.sourceValueCount !== 63072 ||
  index.availableSourceValueCount !== 62593 ||
  index.unavailableSourceValueCount !== 479 ||
  index.calculableRatioCount !== 30454 ||
  index.unavailablePairCount !== 479 ||
  index.zeroDenominatorCount !== 603 ||
  index.zeroOpeningCount !== 1356 ||
  index.sexTotalChecked !== 31536 ||
  index.sexTotalMismatchCount !== 8777
)
  throw new Error("Unexpected data dimensions");
if (records.length !== 3504 || index.coverage.length !== 48)
  throw new Error("Unexpected record dimensions");
if (index.years.join(",") !== "2023,2024,2025") throw new Error("Unexpected years");
if (
  index.sources[0].sha256 !== "4c740910e86217951ea7ccfe9f0ed32ff53b3f088c3c97e2328fd13c5d5070ce" ||
  index.sources[1].sha256 !== "0f2ce1388a319c36771e7e9115ab4562bf6d12d63f4289b0bc52a199c1381d55"
)
  throw new Error("Unexpected source SHA-256");

const placeIds = new Set(index.places.map((item) => item.id));
const occupationIds = new Set(index.occupations.map((item) => item.id));
const keys = new Set();
let availableSourceValues = 0;
let calculableRatios = 0;
let unavailablePairs = 0;
let zeroDenominators = 0;
let zeroOpenings = 0;
for (const record of records) {
  if (!placeIds.has(record.p) || !occupationIds.has(record.o)) throw new Error("Unknown dimension");
  const key = `${record.p}|${record.o}`;
  if (keys.has(key)) throw new Error(`Duplicate record: ${key}`);
  keys.add(key);
  if (Object.keys(record).sort().join(",") !== "a,f,o,p,t")
    throw new Error(`${key}: unexpected record shape`);
  for (const employment of employments) {
    if (record[employment].length !== 3) throw new Error(`${key}: invalid series length`);
    for (const pair of record[employment]) {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`${key}: invalid pair`);
      const [opening, seeker] = pair;
      for (const value of pair) {
        if (value !== null && (!Number.isInteger(value) || value < 0))
          throw new Error(`${key}: invalid published value`);
        if (value !== null) availableSourceValues += 1;
      }
      if (opening === null || seeker === null) unavailablePairs += 1;
      else if (seeker === 0) zeroDenominators += 1;
      else calculableRatios += 1;
      if (opening === 0) zeroOpenings += 1;
    }
  }
  for (let year = 0; year < 3; year += 1) {
    for (let side = 0; side < 2; side += 1) {
      const all = record.a[year][side];
      const full = record.f[year][side];
      const part = record.t[year][side];
      if (all !== null && full !== null && part !== null && all !== full + part)
        throw new Error(`${key}: employment identity mismatch`);
    }
  }
}
if (
  availableSourceValues !== 62593 ||
  calculableRatios !== 30454 ||
  unavailablePairs !== 479 ||
  zeroDenominators !== 603 ||
  zeroOpenings !== 1356
)
  throw new Error("Published state counts changed");

const find = (place, occupation) =>
  records.find((record) => record.p === place && record.o === occupation);
if (JSON.stringify(find("JP-00", "10").a.at(-1)) !== "[633590,435484]")
  throw new Error("National IT values changed");
if (JSON.stringify(find("JP-00", "25").a.at(-1)) !== "[1633497,4836025]")
  throw new Error("National office values changed");
if (JSON.stringify(find("JP-13", "36").f.at(-1)) !== "[211799,23927]")
  throw new Error("Tokyo care values changed");
if (JSON.stringify(find("JP-47", "25").t.at(-1)) !== "[9122,20436]")
  throw new Error("Okinawa office values changed");
const nationalCoverage = index.coverage.find((item) => item.p === "JP-00");
if (JSON.stringify(nationalCoverage.a.at(-1)) !== "[4403017,22698922]")
  throw new Error("National classification coverage changed");

console.log(
  JSON.stringify({
    calculableRatios,
    occupations: index.occupationCount,
    pairs: index.pairCount,
    places: index.placeCount,
    sourceValues: index.sourceValueCount,
    unavailablePairs,
    zeroDenominators,
  }),
);
