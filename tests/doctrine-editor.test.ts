import { describe, expect, it } from "vitest";

import {
  assessDoctrineEditing,
  planDoctrineChange,
} from "../src/save/doctrine-editor";
import type { SaveRecord } from "../src/save/types";

function doctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return {
    CultTraits: [11, 3, 99],
    DoctrineUnlockedUpgrades: [10, 33, 47],
    UnlockedUpgrades: [111, 60, 999],
    "1395": [],
    ...overrides,
  };
}

describe("assessDoctrineEditing", () => {
  it("accepts mapped doctrine data and ignores unknown save positions", () => {
    expect(assessDoctrineEditing(doctrineSave())).toEqual({
      blockers: [],
      cultTraitsField: "CultTraits",
      declaredPairCount: 2,
    });
  });

  it("accepts the legacy CultTrait field", () => {
    const data = doctrineSave({
      CultTrait: [11, 3],
      CultTraits: undefined,
    });

    expect(assessDoctrineEditing(data)).toMatchObject({
      blockers: [],
      cultTraitsField: "CultTrait",
    });
  });

  it("blocks unknown, duplicate, and conflicting doctrine data", () => {
    const assessment = assessDoctrineEditing(
      doctrineSave({
        DoctrineUnlockedUpgrades: [10, 10, 11, 999],
      }),
    );

    expect(assessment.blockers).toEqual(
      expect.arrayContaining([
        "DoctrineUnlockedUpgrades contains duplicate IDs: 10.",
        "The doctrine catalog does not know IDs: 999.",
        "Work & Worship rank 1 contains both choices.",
      ]),
    );
  });
});

describe("planDoctrineChange", () => {
  it("previews a trait doctrine replacement without changing its input", () => {
    const data = doctrineSave();
    const original = structuredClone(data);
    const plan = planDoctrineChange(data, 11);

    expect(plan).toMatchObject({
      blockers: [],
      categoryKey: "work",
      categoryName: "Work & Worship",
      from: { doctrineId: 10, name: "Faithful" },
      rank: 1,
      state: "ready",
      to: { doctrineId: 11, name: "Industrious" },
    });
    expect(plan.changes).toEqual([
      {
        added: [11],
        after: [11, 33, 47],
        before: [10, 33, 47],
        changed: true,
        field: "DoctrineUnlockedUpgrades",
        removed: [10],
      },
      {
        added: [24],
        after: [24, 3, 99],
        before: [11, 3, 99],
        changed: true,
        field: "CultTraits",
        removed: [11],
      },
      {
        added: [],
        after: [111, 60, 999],
        before: [111, 60, 999],
        changed: false,
        field: "UnlockedUpgrades",
        removed: [],
      },
    ]);
    expect(data).toEqual(original);
  });

  it("previews a ritual doctrine replacement", () => {
    const plan = planDoctrineChange(doctrineSave(), 32);

    expect(plan.state).toBe("ready");
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          added: [32],
          after: [10, 32, 47],
          field: "DoctrineUnlockedUpgrades",
          removed: [33],
        }),
        expect.objectContaining({
          added: [110],
          after: [110, 60, 999],
          field: "UnlockedUpgrades",
          removed: [111],
        }),
      ]),
    );
  });

  it("reports the current choice as unchanged", () => {
    const plan = planDoctrineChange(doctrineSave(), 10);

    expect(plan.state).toBe("unchanged");
    expect(plan.changes).toEqual([]);
  });

  it("blocks a choice from an undeclared rank", () => {
    const plan = planDoctrineChange(doctrineSave(), 23);

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      "Sustenance rank 1 has not been declared.",
    );
  });

  it("blocks a replacement when the current trait grant is missing", () => {
    const plan = planDoctrineChange(
      doctrineSave({ CultTraits: [3, 99] }),
      11,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      "CultTraits does not contain the expected current ID 11 exactly once.",
    );
  });

  it("blocks a replacement when the new grant already exists", () => {
    const plan = planDoctrineChange(
      doctrineSave({ CultTraits: [11, 24, 3, 99] }),
      11,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      "CultTraits already contains replacement ID 24. Its source is unclear.",
    );
  });
});
