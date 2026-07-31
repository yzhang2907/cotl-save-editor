import { describe, expect, it } from "vitest";

import {
  planDoctrineChange,
  planDoctrineRemoval,
} from "../src/save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  DoctrineWorkspaceError,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
} from "../src/save/doctrine-workspace";
import type { SaveRecord } from "../src/save/types";
import {
  BELIEF_IN_AFTERLIFE,
  completedWorkDoctrineSave,
  FAITHFUL,
  FEASTING_RITUAL,
  FUNERAL,
  GLORY_OF_CONSTRUCTION,
  HOLY_DAY_RITUAL,
  INDUSTRIOUS,
  INSPIRE,
  PRESERVED_SPECIAL_DOCTRINE_ID,
  PRESERVED_TRAIT_ID,
  RITUAL_FAST,
  RITUAL_OF_RESURRECTION,
  STANDARD_DOCTRINE_IDS,
  STANDARD_TRAIT_IDS,
  STANDARD_UPGRADE_IDS,
  standardDoctrineSave,
  WORK_CATEGORY,
  WORK_HIGHEST_CHOICE,
  WORK_HIGHEST_PAIR,
  WORK_SELECTED_CHOICES,
} from "./doctrine-fixtures";
import {
  UNKNOWN_SLOT_POSITION,
} from "./save-fixtures";

function doctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return standardDoctrineSave({
    [String(UNKNOWN_SLOT_POSITION)]: [],
    nested: { keep: true },
    ...overrides,
  });
}

describe("doctrine workspace", () => {
  it("applies a valid selection without changing the original save", () => {
    const original = doctrineSave();
    const snapshot = structuredClone(original);
    const selection = planDoctrineChange(
      original,
      INDUSTRIOUS.doctrineId,
    );
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      selection,
    );

    expect(workspace.data.DoctrineUnlockedUpgrades).toEqual([
      INDUSTRIOUS.doctrineId,
      FUNERAL.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(workspace.data.CultTraits).toEqual([
      ...INDUSTRIOUS.cultTraitIds,
      ...BELIEF_IN_AFTERLIFE.cultTraitIds,
      PRESERVED_TRAIT_ID,
    ]);
    expect(workspace.data.UnlockedUpgrades).toBe(original.UnlockedUpgrades);
    expect(workspace.data.nested).toBe(original.nested);
    expect(workspace.data[String(UNKNOWN_SLOT_POSITION)]).toBe(
      original[String(UNKNOWN_SLOT_POSITION)],
    );
    expect(original).toEqual(snapshot);
    expect(workspace.history).toMatchObject([
      {
        categoryName: WORK_CATEGORY.name,
        fromDoctrineId: FAITHFUL.doctrineId,
        fromName: FAITHFUL.name,
        operation: "replace",
        rank: WORK_CATEGORY.pairs[0]?.rank,
        toDoctrineId: INDUSTRIOUS.doctrineId,
        toName: INDUSTRIOUS.name,
      },
    ]);
  });

  it("rejects a stale or blocked selection", () => {
    const original = doctrineSave();
    const selection = planDoctrineChange(
      original,
      INDUSTRIOUS.doctrineId,
    );
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      selection,
    );

    expect(() => applyDoctrineChange(workspace, selection)).toThrow(
      DoctrineWorkspaceError,
    );
    expect(() =>
      applyDoctrineChange(
        createDoctrineWorkspace(original),
        planDoctrineChange(original, HOLY_DAY_RITUAL.doctrineId),
      ),
    ).toThrow("Only a valid doctrine selection can be applied.");
  });

  it("rejects a working copy with changes outside doctrine fields", () => {
    const original = doctrineSave();
    const workspace = {
      ...createDoctrineWorkspace(original),
      data: {
        ...original,
        nested: { keep: false },
      },
    };

    expect(() =>
      applyDoctrineChange(
        workspace,
        planDoctrineChange(workspace.data, INDUSTRIOUS.doctrineId),
      ),
    ).toThrow("The working copy changed unapproved field nested.");
  });

  it("uses the legacy CultTrait field when it is active", () => {
    const original = doctrineSave({
      CultTrait: STANDARD_TRAIT_IDS,
      CultTraits: undefined,
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, INDUSTRIOUS.doctrineId),
    );

    expect(workspace.data.CultTrait).toEqual([
      ...INDUSTRIOUS.cultTraitIds,
      ...BELIEF_IN_AFTERLIFE.cultTraitIds,
      PRESERVED_TRAIT_ID,
    ]);
    expect(workspace.data.CultTraits).toBeUndefined();
  });

  it("stages and discards a missing-tier unlock", () => {
    const original = doctrineSave({
      CultTraits: FAITHFUL.cultTraitIds,
      DoctrineUnlockedUpgrades: [
        FAITHFUL.doctrineId,
        INSPIRE.doctrineId,
        GLORY_OF_CONSTRUCTION.doctrineId,
      ],
      UnlockedUpgrades: GLORY_OF_CONSTRUCTION.upgradeIds,
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, HOLY_DAY_RITUAL.doctrineId),
    );

    expect(workspace.data.DoctrineUnlockedUpgrades).toEqual([
      FAITHFUL.doctrineId,
      INSPIRE.doctrineId,
      GLORY_OF_CONSTRUCTION.doctrineId,
      HOLY_DAY_RITUAL.doctrineId,
    ]);
    expect(workspace.data.CultTraits).toEqual(FAITHFUL.cultTraitIds);
    expect(workspace.data.UnlockedUpgrades).toEqual([
      ...GLORY_OF_CONSTRUCTION.upgradeIds,
      ...HOLY_DAY_RITUAL.upgradeIds,
    ]);
    expect(listPendingDoctrineChanges(workspace)).toEqual([
      {
        categoryName: WORK_CATEGORY.name,
        fromDoctrineId: null,
        fromName: null,
        operation: "unlock",
        rank: WORK_HIGHEST_PAIR.rank,
        requiredDlc: null,
        toDoctrineId: HOLY_DAY_RITUAL.doctrineId,
        toName: HOLY_DAY_RITUAL.name,
      },
    ]);

    const pending = listPendingDoctrineChanges(workspace)[0];
    if (!pending) {
      throw new Error("Expected the tier-four unlock.");
    }
    const discarded = discardDoctrineChange(workspace, pending);
    expect(discarded.data).toBe(original);
    expect(discarded.history).toEqual([]);
  });

  it("removes a highest tier and restores it as one net change", () => {
    const original = completedWorkDoctrineSave({
      [String(UNKNOWN_SLOT_POSITION)]: [],
      nested: { keep: true },
    });
    const earlierChoices = WORK_SELECTED_CHOICES.slice(0, -1);
    const removed = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineRemoval(
        original,
        WORK_HIGHEST_CHOICE.doctrineId,
      ),
    );

    expect(removed.data.DoctrineUnlockedUpgrades).toEqual(
      earlierChoices.map((choice) => choice.doctrineId),
    );
    expect(removed.data.UnlockedUpgrades).toEqual(
      earlierChoices.flatMap((choice) => choice.upgradeIds),
    );
    expect(listPendingDoctrineChanges(removed)).toEqual([
      {
        categoryName: WORK_CATEGORY.name,
        fromDoctrineId: WORK_HIGHEST_CHOICE.doctrineId,
        fromName: WORK_HIGHEST_CHOICE.name,
        operation: "remove",
        rank: WORK_HIGHEST_PAIR.rank,
        requiredDlc: null,
        toDoctrineId: null,
        toName: null,
      },
    ]);

    const restored = applyDoctrineChange(
      removed,
      planDoctrineChange(
        removed.data,
        WORK_HIGHEST_CHOICE.doctrineId,
      ),
    );
    expect(restored.data).toBe(original);
    expect(restored.history).toEqual([]);
  });

  it("undoes a staged unlock through the inverse removal plan", () => {
    const original = completedWorkDoctrineSave({
      [String(UNKNOWN_SLOT_POSITION)]: [],
      nested: { keep: true },
    });
    original.CultTraits = WORK_SELECTED_CHOICES.slice(0, -1).flatMap(
      (choice) => choice.cultTraitIds,
    );
    original.DoctrineUnlockedUpgrades = WORK_SELECTED_CHOICES.slice(
      0,
      -1,
    ).map((choice) => choice.doctrineId);
    original.UnlockedUpgrades = WORK_SELECTED_CHOICES.slice(
      0,
      -1,
    ).flatMap((choice) => choice.upgradeIds);
    const unlocked = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(
        original,
        WORK_HIGHEST_CHOICE.doctrineId,
      ),
    );
    const restored = applyDoctrineChange(
      unlocked,
      planDoctrineRemoval(
        unlocked.data,
        WORK_HIGHEST_CHOICE.doctrineId,
      ),
    );

    expect(restored.data).toBe(original);
    expect(restored.history).toEqual([]);
  });

  it("keeps a missing tier as one unlock when its choice changes", () => {
    const original = doctrineSave();
    const unlocked = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, FEASTING_RITUAL.doctrineId),
    );
    const changed = applyDoctrineChange(
      unlocked,
      planDoctrineChange(unlocked.data, RITUAL_FAST.doctrineId),
    );

    expect(changed.data.DoctrineUnlockedUpgrades).toEqual([
      ...STANDARD_DOCTRINE_IDS,
      RITUAL_FAST.doctrineId,
    ]);
    expect(changed.data.UnlockedUpgrades).toEqual([
      ...STANDARD_UPGRADE_IDS,
      ...RITUAL_FAST.upgradeIds,
    ]);
    expect(listPendingDoctrineChanges(changed)).toMatchObject([
      {
        categoryName: "Sustenance",
        fromDoctrineId: null,
        operation: "unlock",
        rank: 1,
        toDoctrineId: RITUAL_FAST.doctrineId,
      },
    ]);
  });

  it("supports several changes, one-change discard, and full reset", () => {
    const original = doctrineSave();
    const first = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, INDUSTRIOUS.doctrineId),
    );
    const second = applyDoctrineChange(
      first,
      planDoctrineChange(
        first.data,
        RITUAL_OF_RESURRECTION.doctrineId,
      ),
    );

    expect(second.history).toHaveLength(2);
    expect(second.data.DoctrineUnlockedUpgrades).toEqual([
      INDUSTRIOUS.doctrineId,
      RITUAL_OF_RESURRECTION.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);

    const workChange = listPendingDoctrineChanges(second)[0];
    if (!workChange) {
      throw new Error("Expected the Work & Worship change.");
    }
    const discarded = discardDoctrineChange(second, workChange);
    expect(discarded.data.DoctrineUnlockedUpgrades).toEqual([
      FAITHFUL.doctrineId,
      RITUAL_OF_RESURRECTION.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(listPendingDoctrineChanges(discarded)).toMatchObject([
      {
        categoryName: "Afterlife",
        fromDoctrineId: FUNERAL.doctrineId,
        toDoctrineId: RITUAL_OF_RESURRECTION.doctrineId,
      },
    ]);

    const reset = resetDoctrineChanges(discarded);
    expect(reset.history).toEqual([]);
    expect(reset.data).toBe(original);
  });

  it("clears pending history when a second change restores the original", () => {
    const original = doctrineSave();
    const first = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, INDUSTRIOUS.doctrineId),
    );
    const restored = applyDoctrineChange(
      first,
      planDoctrineChange(first.data, FAITHFUL.doctrineId),
    );

    expect(restored.history).toEqual([]);
    expect(restored.data).toBe(original);
  });

  it("lists only net changes across several selections", () => {
    const original = doctrineSave();
    const workChange = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, INDUSTRIOUS.doctrineId),
    );
    const afterlifeChange = applyDoctrineChange(
      workChange,
      planDoctrineChange(
        workChange.data,
        RITUAL_OF_RESURRECTION.doctrineId,
      ),
    );
    const workRestored = applyDoctrineChange(
      afterlifeChange,
      planDoctrineChange(afterlifeChange.data, FAITHFUL.doctrineId),
    );

    expect(workRestored.history).toHaveLength(3);
    expect(listPendingDoctrineChanges(workRestored)).toEqual([
      {
        categoryName: "Afterlife",
        fromDoctrineId: FUNERAL.doctrineId,
        fromName: FUNERAL.name,
        operation: "replace",
        rank: 2,
        requiredDlc: null,
        toDoctrineId: RITUAL_OF_RESURRECTION.doctrineId,
        toName: RITUAL_OF_RESURRECTION.name,
      },
    ]);
  });
});
