import { describe, expect, it } from "vitest";

import {
  displayDuration,
  displayNumber,
  displayPercent,
} from "../src/ui/overview-format";

describe("displayNumber", () => {
  it("keeps whole numbers without a fraction", () => {
    expect(displayNumber(0)).toBe("0");
    expect(displayNumber(999)).toBe("999");
  });

  it("rounds fractions to one digit", () => {
    expect(displayNumber(2.5)).toBe("2.5");
    expect(displayNumber(2.44)).toBe("2.4");
    expect(displayNumber(2.46)).toBe("2.5");
  });
});

describe("displayDuration", () => {
  it("shows minutes below one hour", () => {
    expect(displayDuration(0)).toBe("0m");
    expect(displayDuration(59)).toBe("0m");
    expect(displayDuration(60)).toBe("1m");
    expect(displayDuration(3599)).toBe("59m");
  });

  it("shows hours with a minute remainder", () => {
    expect(displayDuration(3600)).toBe("1h 0m");
    expect(displayDuration(3725)).toBe("1h 2m");
    expect(displayDuration(90_061)).toBe("25h 1m");
  });

  it("clamps negative play time to zero", () => {
    expect(displayDuration(-30)).toBe("0m");
  });
});

describe("displayPercent", () => {
  it("shows a placeholder for missing values", () => {
    expect(displayPercent(null)).toBe("—");
  });

  it("rounds and clamps into the 0-100 range", () => {
    expect(displayPercent(0)).toBe("0%");
    expect(displayPercent(54.4)).toBe("54%");
    expect(displayPercent(54.5)).toBe("55%");
    expect(displayPercent(150)).toBe("100%");
    expect(displayPercent(-5)).toBe("0%");
  });
});
