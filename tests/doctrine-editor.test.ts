import { describe, expect, it } from "vitest";

import {
  assessDoctrineEditing,
  planDoctrineChange,
  planDoctrineRemoval,
} from "../src/save/doctrine-editor";
import type { SaveRecord } from "../src/save/types";
import {
  BELIEF_IN_AFTERLIFE,
  FAITHFUL,
  FEASTING_RITUAL,
  FUNERAL,
  FURNACE_FOLLOWERS,
  GLORY_OF_CONSTRUCTION,
  completedWorkDoctrineSave,
  HOLY_DAY_RITUAL,
  INDUSTRIOUS,
  INSPIRE,
  PRESERVED_SPECIAL_DOCTRINE_ID,
  PRESERVED_TRAIT_ID,
  PRESERVED_UPGRADE_ID,
  RITUAL_OF_RESURRECTION,
  STANDARD_DOCTRINE_IDS,
  STANDARD_TRAIT_IDS,
  STANDARD_UPGRADE_IDS,
  standardDoctrineSave,
  doctrineCategory,
  doctrineSaveFromChoices,
  WORK_CATEGORY,
  WORK_HIGHEST_CHOICE,
  WORK_HIGHEST_PAIR,
  WORK_PREVIOUS_CHOICE,
  WORK_PREVIOUS_PAIR,
  WORK_SELECTED_CHOICES,
} from "./doctrine-fixtures";
import {
  UNKNOWN_CATALOG_ID,
  UNKNOWN_SLOT_POSITION,
} from "./save-fixtures";

function doctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return standardDoctrineSave({
    [String(UNKNOWN_SLOT_POSITION)]: [],
    ...overrides,
  });
}

const SUSTENANCE_CATEGORY = doctrineCategory("sustenance");
const WOOLHAVEN_CATEGORY = doctrineCategory("winter");

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
      CultTrait: [
        ...FAITHFUL.cultTraitIds,
        ...BELIEF_IN_AFTERLIFE.cultTraitIds,
      ],
      CultTraits: undefined,
    });

    expect(assessDoctrineEditing(data)).toMatchObject({
      blockers: [],
      cultTraitsField: "CultTrait",
    });
  });

  it("blocks unknown and duplicate doctrine data", () => {
    const assessment = assessDoctrineEditing(
      doctrineSave({
        DoctrineUnlockedUpgrades: [
          FAITHFUL.doctrineId,
          FAITHFUL.doctrineId,
          INDUSTRIOUS.doctrineId,
          UNKNOWN_CATALOG_ID,
        ],
      }),
    );

    expect(assessment.blockers).toEqual(
      expect.arrayContaining([
        `DoctrineUnlockedUpgrades contains duplicate IDs: ${FAITHFUL.doctrineId}.`,
        `The doctrine catalog does not know IDs: ${UNKNOWN_CATALOG_ID}.`,
      ]),
    );
  });

  it("accepts both choices unlocked with Forgotten Commandment Stones", () => {
    const data = doctrineSave({
      CultTraits: [
        ...FAITHFUL.cultTraitIds,
        ...INDUSTRIOUS.cultTraitIds,
        ...BELIEF_IN_AFTERLIFE.cultTraitIds,
        PRESERVED_TRAIT_ID,
      ],
      DoctrineUnlockedUpgrades: [
        FAITHFUL.doctrineId,
        INDUSTRIOUS.doctrineId,
        FUNERAL.doctrineId,
        PRESERVED_SPECIAL_DOCTRINE_ID,
      ],
    });

    expect(assessDoctrineEditing(data)).toEqual({
      blockers: [],
      cultTraitsField: "CultTraits",
      declaredPairCount: 2,
    });
    expect(planDoctrineChange(data, FAITHFUL.doctrineId)).toMatchObject({
      blockers: [],
      from: { doctrineId: FAITHFUL.doctrineId },
      state: "unchanged",
      to: { doctrineId: FAITHFUL.doctrineId },
    });
    expect(
      planDoctrineChange(data, RITUAL_OF_RESURRECTION.doctrineId),
    ).toMatchObject({
      blockers: [],
      state: "ready",
    });
  });
});

describe("planDoctrineChange", () => {
  it("previews a trait doctrine replacement without changing its input", () => {
    const data = doctrineSave();
    const original = structuredClone(data);
    const plan = planDoctrineChange(data, INDUSTRIOUS.doctrineId);

    expect(plan).toMatchObject({
      blockers: [],
      categoryKey: "work",
      categoryName: WORK_CATEGORY.name,
      from: FAITHFUL,
      operation: "replace",
      rank: 1,
      state: "ready",
      to: INDUSTRIOUS,
    });
    expect(plan.changes).toEqual([
      {
        added: [INDUSTRIOUS.doctrineId],
        after: [
          INDUSTRIOUS.doctrineId,
          FUNERAL.doctrineId,
          PRESERVED_SPECIAL_DOCTRINE_ID,
        ],
        before: STANDARD_DOCTRINE_IDS,
        changed: true,
        field: "DoctrineUnlockedUpgrades",
        removed: [FAITHFUL.doctrineId],
      },
      {
        added: INDUSTRIOUS.cultTraitIds,
        after: [
          ...INDUSTRIOUS.cultTraitIds,
          ...BELIEF_IN_AFTERLIFE.cultTraitIds,
          PRESERVED_TRAIT_ID,
        ],
        before: STANDARD_TRAIT_IDS,
        changed: true,
        field: "CultTraits",
        removed: FAITHFUL.cultTraitIds,
      },
      {
        added: [],
        after: STANDARD_UPGRADE_IDS,
        before: STANDARD_UPGRADE_IDS,
        changed: false,
        field: "UnlockedUpgrades",
        removed: [],
      },
    ]);
    expect(data).toEqual(original);
  });

  it("previews a ritual doctrine replacement", () => {
    const plan = planDoctrineChange(
      doctrineSave(),
      RITUAL_OF_RESURRECTION.doctrineId,
    );

    expect(plan.state).toBe("ready");
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          added: [RITUAL_OF_RESURRECTION.doctrineId],
          after: [
            FAITHFUL.doctrineId,
            RITUAL_OF_RESURRECTION.doctrineId,
            PRESERVED_SPECIAL_DOCTRINE_ID,
          ],
          field: "DoctrineUnlockedUpgrades",
          removed: [FUNERAL.doctrineId],
        }),
        expect.objectContaining({
          added: RITUAL_OF_RESURRECTION.upgradeIds,
          after: [
            ...RITUAL_OF_RESURRECTION.upgradeIds,
            PRESERVED_UPGRADE_ID,
            UNKNOWN_CATALOG_ID,
          ],
          field: "UnlockedUpgrades",
          removed: FUNERAL.upgradeIds,
        }),
      ]),
    );
  });

  it("reports the current choice as unchanged", () => {
    const plan = planDoctrineChange(doctrineSave(), FAITHFUL.doctrineId);

    expect(plan.state).toBe("unchanged");
    expect(plan.changes).toEqual([]);
  });

  it("unlocks a missing first rank with all linked grants", () => {
    const plan = planDoctrineChange(
      doctrineSave(),
      FEASTING_RITUAL.doctrineId,
    );

    expect(plan).toMatchObject({
      blockers: [],
      categoryName: SUSTENANCE_CATEGORY.name,
      from: null,
      operation: "unlock",
      rank: doctrineCategory("sustenance").pairs[0]?.rank,
      state: "ready",
      to: FEASTING_RITUAL,
    });
    expect(plan.changes).toEqual([
      expect.objectContaining({
        added: [FEASTING_RITUAL.doctrineId],
        after: [...STANDARD_DOCTRINE_IDS, FEASTING_RITUAL.doctrineId],
        field: "DoctrineUnlockedUpgrades",
        removed: [],
      }),
      expect.objectContaining({
        added: [],
        after: STANDARD_TRAIT_IDS,
        field: "CultTraits",
        removed: [],
      }),
      expect.objectContaining({
        added: FEASTING_RITUAL.upgradeIds,
        after: [...STANDARD_UPGRADE_IDS, ...FEASTING_RITUAL.upgradeIds],
        field: "UnlockedUpgrades",
        removed: [],
      }),
    ]);
  });

  it("unlocks a missing fourth rank after its earlier ranks", () => {
    const earlierChoices = [
      FAITHFUL,
      INSPIRE,
      GLORY_OF_CONSTRUCTION,
    ];
    const plan = planDoctrineChange(
      doctrineSaveFromChoices(earlierChoices),
      HOLY_DAY_RITUAL.doctrineId,
    );

    expect(plan).toMatchObject({
      blockers: [],
      from: null,
      operation: "unlock",
      rank: WORK_HIGHEST_PAIR.rank,
      state: "ready",
      to: HOLY_DAY_RITUAL,
    });
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          added: [HOLY_DAY_RITUAL.doctrineId],
          after: [
            ...earlierChoices.map((choice) => choice.doctrineId),
            HOLY_DAY_RITUAL.doctrineId,
          ],
          field: "DoctrineUnlockedUpgrades",
        }),
        expect.objectContaining({
          added: HOLY_DAY_RITUAL.upgradeIds,
          after: [
            ...GLORY_OF_CONSTRUCTION.upgradeIds,
            ...HOLY_DAY_RITUAL.upgradeIds,
          ],
          field: "UnlockedUpgrades",
        }),
      ]),
    );
  });

  it("blocks a later rank while earlier ranks are still missing", () => {
    const plan = planDoctrineChange(
      doctrineSave(),
      HOLY_DAY_RITUAL.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    const missingRanks = WORK_CATEGORY.pairs
      .slice(1, -1)
      .map((pair) => pair.rank);
    expect(plan.blockers).toContain(
      `${WORK_CATEGORY.name} rank ${WORK_HIGHEST_PAIR.rank} cannot be unlocked before ranks ${missingRanks.join(", ")}.`,
    );
  });

  it("blocks an unlock when an undeclared pair already has a grant", () => {
    const earlierChoices = [
      FAITHFUL,
      INSPIRE,
      GLORY_OF_CONSTRUCTION,
    ];
    const plan = planDoctrineChange(
      doctrineSaveFromChoices(earlierChoices, {
        UnlockedUpgrades: [
          ...GLORY_OF_CONSTRUCTION.upgradeIds,
          ...HOLY_DAY_RITUAL.upgradeIds,
        ],
      }),
      HOLY_DAY_RITUAL.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      `UnlockedUpgrades already contains ID ${HOLY_DAY_RITUAL.upgradeIds[0]} for undeclared doctrine ${HOLY_DAY_RITUAL.name}.`,
    );
  });

  it("blocks Woolhaven changes before the save activates the DLC", () => {
    const plan = planDoctrineChange(
      doctrineSave({ MAJOR_DLC: false }),
      FURNACE_FOLLOWERS.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      `${WOOLHAVEN_CATEGORY.name} changes require this save to have ${WOOLHAVEN_CATEGORY.name} activated in the game.`,
    );
  });

  it("allows Woolhaven changes after the save activates the DLC", () => {
    const plan = planDoctrineChange(
      doctrineSave({ MAJOR_DLC: true }),
      FURNACE_FOLLOWERS.doctrineId,
    );

    expect(plan).toMatchObject({
      blockers: [],
      categoryName: WOOLHAVEN_CATEGORY.name,
      from: null,
      operation: "unlock",
      rank: WOOLHAVEN_CATEGORY.pairs[0]?.rank,
      requiredDlc: "woolhaven",
      state: "ready",
      to: FURNACE_FOLLOWERS,
    });
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          added: FURNACE_FOLLOWERS.cultTraitIds,
          field: "CultTraits",
        }),
      ]),
    );
  });

  it("blocks a replacement when the current trait grant is missing", () => {
    const plan = planDoctrineChange(
      doctrineSave({
        CultTraits: [
          ...BELIEF_IN_AFTERLIFE.cultTraitIds,
          PRESERVED_TRAIT_ID,
        ],
      }),
      INDUSTRIOUS.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      `CultTraits does not contain the expected current ID ${FAITHFUL.cultTraitIds[0]} exactly once.`,
    );
  });

  it("blocks a replacement when the new grant already exists", () => {
    const plan = planDoctrineChange(
      doctrineSave({
        CultTraits: [
          ...FAITHFUL.cultTraitIds,
          ...INDUSTRIOUS.cultTraitIds,
          ...BELIEF_IN_AFTERLIFE.cultTraitIds,
          PRESERVED_TRAIT_ID,
        ],
      }),
      INDUSTRIOUS.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      `CultTraits already contains replacement ID ${INDUSTRIOUS.cultTraitIds[0]}. Its source is unclear.`,
    );
  });
});

describe("planDoctrineRemoval", () => {
  const completedWorkCategory = completedWorkDoctrineSave();
  const earlierWorkChoices = WORK_SELECTED_CHOICES.slice(0, -1);

  it("removes a highest-rank doctrine and its linked grants", () => {
    const plan = planDoctrineRemoval(
      completedWorkCategory,
      WORK_HIGHEST_CHOICE.doctrineId,
    );

    expect(plan).toMatchObject({
      blockers: [],
      categoryName: WORK_CATEGORY.name,
      from: {
        doctrineId: WORK_HIGHEST_CHOICE.doctrineId,
        name: WORK_HIGHEST_CHOICE.name,
      },
      operation: "remove",
      rank: WORK_HIGHEST_PAIR.rank,
      state: "ready",
      to: null,
    });
    expect(plan.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          after: earlierWorkChoices.map(
            (choice) => choice.doctrineId,
          ),
          field: "DoctrineUnlockedUpgrades",
          removed: [WORK_HIGHEST_CHOICE.doctrineId],
        }),
        expect.objectContaining({
          after: earlierWorkChoices.flatMap(
            (choice) => choice.upgradeIds,
          ),
          field: "UnlockedUpgrades",
          removed: WORK_HIGHEST_CHOICE.upgradeIds,
        }),
      ]),
    );
  });

  it("blocks removal below a later occupied rank", () => {
    const plan = planDoctrineRemoval(
      completedWorkCategory,
      WORK_PREVIOUS_CHOICE.doctrineId,
    );

    expect(plan.state).toBe("blocked");
    expect(plan.blockers).toContain(
      `${WORK_CATEGORY.name} rank ${WORK_PREVIOUS_PAIR.rank} cannot be removed while later rank ${WORK_HIGHEST_PAIR.rank} is unlocked.`,
    );
  });
});
