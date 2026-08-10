import { describe, expect, it } from "vitest";

import {
  STALE_MODULE_MESSAGE,
  errorMessage,
} from "../src/ui/error-message";

describe("errorMessage", () => {
  it("passes ordinary error messages through", () => {
    expect(errorMessage(new Error("bad quantity"))).toBe("bad quantity");
  });

  it("labels non-Error values as unknown", () => {
    expect(errorMessage("boom")).toBe("Unknown error.");
  });

  it("translates every browser's stale-chunk failure", () => {
    const failures = [
      "error loading dynamically imported module: https://x/y.js",
      "Failed to fetch dynamically imported module: https://x/y.js",
      "Importing a module script failed.",
    ];
    for (const failure of failures) {
      expect(errorMessage(new Error(failure))).toBe(STALE_MODULE_MESSAGE);
    }
  });
});
