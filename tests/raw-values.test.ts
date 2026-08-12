import { describe, expect, it } from "vitest";

import { rawValuesMatch } from "../src/save/raw-values";

describe("rawValuesMatch", () => {
  it("matches primitives with Object.is semantics", () => {
    expect(rawValuesMatch(7, 7)).toBe(true);
    expect(rawValuesMatch("slot", "slot")).toBe(true);
    expect(rawValuesMatch(true, true)).toBe(true);
    expect(rawValuesMatch(null, null)).toBe(true);
    expect(rawValuesMatch(undefined, undefined)).toBe(true);
    expect(rawValuesMatch(Number.NaN, Number.NaN)).toBe(true);
    expect(
      rawValuesMatch(9_007_199_254_740_993n, 9_007_199_254_740_993n),
    ).toBe(true);

    expect(rawValuesMatch(7, 8)).toBe(false);
    expect(rawValuesMatch(7, "7")).toBe(false);
    expect(rawValuesMatch(7n, 7)).toBe(false);
    expect(rawValuesMatch(0, -0)).toBe(false);
    expect(rawValuesMatch(null, undefined)).toBe(false);
    expect(rawValuesMatch(false, 0)).toBe(false);
  });

  it("compares byte arrays by content", () => {
    expect(
      rawValuesMatch(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3)),
    ).toBe(true);
    expect(
      rawValuesMatch(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 4)),
    ).toBe(false);
    expect(
      rawValuesMatch(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2)),
    ).toBe(false);
    expect(rawValuesMatch(Uint8Array.of(1), [1])).toBe(false);
  });

  it("compares dates by timestamp", () => {
    expect(
      rawValuesMatch(new Date(1_700_000_000_000), new Date(1_700_000_000_000)),
    ).toBe(true);
    expect(
      rawValuesMatch(new Date(1_700_000_000_000), new Date(1_700_000_000_001)),
    ).toBe(false);
  });

  it("compares arrays element by element in order", () => {
    expect(rawValuesMatch([1, [2, "x"]], [1, [2, "x"]])).toBe(true);
    expect(rawValuesMatch([], [])).toBe(true);
    expect(rawValuesMatch([1, 2], [2, 1])).toBe(false);
    expect(rawValuesMatch([1, 2], [1, 2, 3])).toBe(false);
    expect(rawValuesMatch([], {})).toBe(false);
  });

  it("requires identical key order on records", () => {
    expect(rawValuesMatch({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(
      rawValuesMatch({ a: { b: [1] } }, { a: { b: [1] } }),
    ).toBe(true);
    // Positional writes rely on stable field order, so records holding
    // the same entries in a different order must not match.
    expect(rawValuesMatch({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
    expect(rawValuesMatch({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(rawValuesMatch({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("requires a shared prototype", () => {
    expect(rawValuesMatch(Object.create(null), {})).toBe(false);
    expect(rawValuesMatch(new Date(0), {})).toBe(false);
  });
});
