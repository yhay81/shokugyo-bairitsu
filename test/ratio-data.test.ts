import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Pair = [number | null, number | null];
type RecordRow = {
  p: string;
  o: string;
  a: Pair[];
  f: Pair[];
  t: Pair[];
};

const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const records = JSON.parse(
  readFileSync(resolve(root, "public/data/ratios.json"), "utf8"),
) as RecordRow[];
const find = (placeId: string, occupationId: string) =>
  records.find((item) => item.p === placeId && item.o === occupationId)!;

describe("matched official occupation openings and job-seeker tables", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      schemaVersion: 1,
      asOf: "2026-08-02",
      edition: "2023〜2025年度（現行表）",
      years: [2023, 2024, 2025],
      placeCount: 48,
      prefectureCount: 47,
      groupCount: 11,
      occupationCount: 73,
      recordCount: 3504,
      employmentCount: 3,
      pairCount: 31_536,
      sourceValueCount: 63_072,
      availableSourceValueCount: 62_593,
      unavailableSourceValueCount: 479,
      calculableRatioCount: 30_454,
      unavailablePairCount: 479,
      zeroDenominatorCount: 603,
      zeroOpeningCount: 1356,
      sexTotalChecked: 31_536,
      sexTotalMismatchCount: 8777,
      employmentIdentityChecked: { openings: 10_137, seekers: 10_512 },
      nationalSumChecked: { openings: 622, seekers: 657 },
    });
    expect(index.sources).toEqual([
      {
        kind: "openings",
        url: "https://www.mhlw.go.jp/toukei/list/xls/114-1d-04.xlsx",
        bytes: 1_001_209,
        sha256: "4c740910e86217951ea7ccfe9f0ed32ff53b3f088c3c97e2328fd13c5d5070ce",
      },
      {
        kind: "seekers",
        url: "https://www.mhlw.go.jp/toukei/list/xls/114-1d-05.xlsx",
        bytes: 24_574_237,
        sha256: "0f2ce1388a319c36771e7e9115ab4562bf6d12d63f4289b0bc52a199c1381d55",
      },
    ]);
  });

  it("contains one unique row for every place and occupation", () => {
    expect(records).toHaveLength(3504);
    expect(new Set(records.map((item) => `${item.p}|${item.o}`)).size).toBe(3504);
    expect(index.places).toHaveLength(48);
    expect(index.groups).toHaveLength(11);
    expect(index.occupations).toHaveLength(73);
    expect(index.coverage).toHaveLength(48);
  });

  it("keeps every occupation attached to one published group", () => {
    const groupIds = new Set(index.groups.map((item: { id: string }) => item.id));
    for (const occupation of index.occupations as { group: string; id: string; name: string }[]) {
      expect(occupation.id).toMatch(/^\d{2}$/u);
      expect(occupation.name.length).toBeGreaterThan(1);
      expect(groupIds.has(occupation.group)).toBe(true);
    }
    expect(index.occupations.find((item: { id: string }) => item.id === "10")).toMatchObject({
      group: "Ｂ",
      name: "情報処理・通信技術者",
    });
    expect(index.occupations.find((item: { id: string }) => item.id === "36")).toMatchObject({
      group: "Ｅ",
      name: "介護サービス職業従事者",
    });
  });

  it("retains nationwide and known prefecture source values", () => {
    expect(find("JP-00", "10").a).toEqual([
      [622_094, 406_130],
      [642_616, 420_808],
      [633_590, 435_484],
    ]);
    expect(find("JP-00", "25").a.at(-1)).toEqual([1_633_497, 4_836_025]);
    expect(find("JP-00", "36").a.at(-1)).toEqual([2_419_704, 629_871]);
    expect(find("JP-13", "36").f.at(-1)).toEqual([211_799, 23_927]);
    expect(find("JP-47", "25").t.at(-1)).toEqual([9122, 20_436]);
  });

  it("keeps missing and zero-denominator states separate", () => {
    let sourceValues = 0;
    let calculable = 0;
    let unavailable = 0;
    let zeroDenominator = 0;
    let zeroOpening = 0;
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["a", "f", "o", "p", "t"]);
      for (const employment of ["a", "f", "t"] as const) {
        expect(record[employment]).toHaveLength(3);
        for (const [opening, seeker] of record[employment]) {
          for (const value of [opening, seeker]) {
            if (value !== null) {
              expect(Number.isInteger(value)).toBe(true);
              expect(value).toBeGreaterThanOrEqual(0);
              sourceValues += 1;
            }
          }
          if (opening === null || seeker === null) unavailable += 1;
          else if (seeker === 0) zeroDenominator += 1;
          else calculable += 1;
          if (opening === 0) zeroOpening += 1;
        }
      }
    }
    expect({ sourceValues, calculable, unavailable, zeroDenominator, zeroOpening }).toEqual({
      sourceValues: 62_593,
      calculable: 30_454,
      unavailable: 479,
      zeroDenominator: 603,
      zeroOpening: 1356,
    });
    expect(statSync(resolve(root, "public/data/ratios.json")).size).toBeLessThan(520_000);
  });

  it("preserves employment identities and classification coverage", () => {
    for (const record of records) {
      for (let year = 0; year < 3; year += 1) {
        for (let side = 0; side < 2; side += 1) {
          const all = record.a[year][side];
          const full = record.f[year][side];
          const part = record.t[year][side];
          if (all !== null && full !== null && part !== null) expect(all).toBe(full + part);
        }
      }
    }
    const nationwide = index.coverage.find((item: { p: string }) => item.p === "JP-00");
    expect(nationwide.a.at(-1)).toEqual([4_403_017, 22_698_922]);
    expect((nationwide.a.at(-1)[0] / nationwide.a.at(-1)[1]) * 100).toBeCloseTo(19.3975, 4);
  });
});
