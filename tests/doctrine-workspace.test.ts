import { describe, expect, it } from "vitest";

import { planDoctrineChange } from "../src/save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  DoctrineWorkspaceError,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
} from "../src/save/doctrine-workspace";
import type { SaveRecord } from "../src/save/types";

function doctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return {
    CultTraits: [11, 3, 99],
    DoctrineUnlockedUpgrades: [10, 33, 47],
    UnlockedUpgrades: [111, 60, 999],
    "1395": [],
    nested: { keep: true },
    ...overrides,
  };
}

describe("doctrine workspace", () => {
  it("applies a valid selection without changing the original save", () => {
    const original = doctrineSave();
    const snapshot = structuredClone(original);
    const selection = planDoctrineChange(original, 11);
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      selection,
    );

    expect(workspace.data.DoctrineUnlockedUpgrades).toEqual([11, 33, 47]);
    expect(workspace.data.CultTraits).toEqual([24, 3, 99]);
    expect(workspace.data.UnlockedUpgrades).toBe(original.UnlockedUpgrades);
    expect(workspace.data.nested).toBe(original.nested);
    expect(workspace.data["1395"]).toBe(original["1395"]);
    expect(original).toEqual(snapshot);
    expect(workspace.history).toMatchObject([
      {
        categoryName: "Work & Worship",
        fromDoctrineId: 10,
        fromName: "Faithful",
        rank: 1,
        toDoctrineId: 11,
        toName: "Industrious",
      },
    ]);
  });

  it("rejects a stale or blocked selection", () => {
    const original = doctrineSave();
    const selection = planDoctrineChange(original, 11);
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
        planDoctrineChange(original, 23),
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
        planDoctrineChange(workspace.data, 11),
      ),
    ).toThrow("The working copy changed unapproved field nested.");
  });

  it("uses the legacy CultTrait field when it is active", () => {
    const original = doctrineSave({
      CultTrait: [11, 3, 99],
      CultTraits: undefined,
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, 11),
    );

    expect(workspace.data.CultTrait).toEqual([24, 3, 99]);
    expect(workspace.data.CultTraits).toBeUndefined();
  });

  it("supports several changes, one-change discard, and full reset", () => {
    const original = doctrineSave();
    const first = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, 11),
    );
    const second = applyDoctrineChange(
      first,
      planDoctrineChange(first.data, 32),
    );

    expect(second.history).toHaveLength(2);
    expect(second.data.DoctrineUnlockedUpgrades).toEqual([11, 32, 47]);

    const workChange = listPendingDoctrineChanges(second)[0];
    if (!workChange) {
      throw new Error("Expected the Work & Worship change.");
    }
    const discarded = discardDoctrineChange(second, workChange);
    expect(discarded.data.DoctrineUnlockedUpgrades).toEqual([10, 32, 47]);
    expect(listPendingDoctrineChanges(discarded)).toMatchObject([
      {
        categoryName: "Afterlife",
        fromDoctrineId: 33,
        toDoctrineId: 32,
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
      planDoctrineChange(original, 11),
    );
    const restored = applyDoctrineChange(
      first,
      planDoctrineChange(first.data, 10),
    );

    expect(restored.history).toEqual([]);
    expect(restored.data).toBe(original);
  });

  it("lists only net changes across several selections", () => {
    const original = doctrineSave();
    const workChange = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, 11),
    );
    const afterlifeChange = applyDoctrineChange(
      workChange,
      planDoctrineChange(workChange.data, 32),
    );
    const workRestored = applyDoctrineChange(
      afterlifeChange,
      planDoctrineChange(afterlifeChange.data, 10),
    );

    expect(workRestored.history).toHaveLength(3);
    expect(listPendingDoctrineChanges(workRestored)).toEqual([
      {
        categoryName: "Afterlife",
        fromDoctrineId: 33,
        fromName: "Funeral",
        rank: 2,
        toDoctrineId: 32,
        toName: "Ritual of Resurrection",
      },
    ]);
  });
});
