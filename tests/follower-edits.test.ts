import { describe, expect, it } from "vitest";

import {
  applyFollowerEdits,
  discardFollowerEdit,
  editedFollowerIds,
  emptyFollowerEdits,
  FollowerEditError,
  hasFollowerEdits,
  listPendingFollowerEdits,
  MAX_FOLLOWER_NAME_LENGTH,
  stageFollowerEdit,
} from "../src/save/follower-edits";
import { DEATH_CAUSES } from "../src/save/overview";
import type { SaveRecord } from "../src/save/types";

function deathFlags(...trueFlags: string[]): SaveRecord {
  return Object.fromEntries(
    DEATH_CAUSES.map(([flag]) => [flag, trueFlags.includes(flag)]),
  );
}

function lamb(): SaveRecord {
  return {
    Age: 12,
    ID: 7,
    OldAge: false,
    Outfit: 2,
    Traits: [16, 51],
    XPLevel: 3,
    _happiness: 80,
    _illness: 0,
    _name: "Lamby",
    _satiation: 55,
    ...deathFlags(),
  };
}

function goat(): SaveRecord {
  return {
    Age: 4,
    ID: 9,
    OldAge: true,
    Traits: [],
    XPLevel: 1,
    _happiness: 50,
    _illness: 10,
    _name: "Goatrude",
    _satiation: 70,
    ...deathFlags(),
  };
}

function ghost(): SaveRecord {
  return {
    ID: 30,
    OldAge: false,
    _name: "Ghost",
    ...deathFlags("DiedOfOldAge"),
  };
}

function originalSave(): SaveRecord {
  return {
    CurrentDayIndex: 12,
    Followers: [lamb(), goat()],
    Followers_Dead: [ghost()],
    Followers_Dead_IDs: [30],
    Followers_Elderly_IDs: [9, 30],
  };
}

describe("stageFollowerEdit", () => {
  it("stages a field edit and lists it as pending", () => {
    const original = originalSave();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: 7,
      value: 10,
    });

    expect(hasFollowerEdits(edits)).toBe(true);
    expect(editedFollowerIds(edits)).toEqual(new Set([7]));
    expect(listPendingFollowerEdits(original, edits)).toEqual([
      {
        field: "XPLevel",
        fieldLabel: "Level",
        followerId: 7,
        followerName: "Lamby",
        from: "3",
        to: "10",
      },
    ]);
  });

  it("drops a staged edit that returns to the original value", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: 7,
      value: 10,
    });
    edits = stageFollowerEdit(original, edits, {
      field: "XPLevel",
      followerId: 7,
      value: 3,
    });

    expect(hasFollowerEdits(edits)).toBe(false);
  });

  it("keeps edits to different fields and followers apart", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: 7,
      value: 10,
    });
    edits = stageFollowerEdit(original, edits, {
      field: "_name",
      followerId: 9,
      value: "Goatrude II",
    });

    expect(edits.fields).toHaveLength(2);
    edits = discardFollowerEdit(edits, 7, "XPLevel");
    expect(edits.fields).toEqual([
      { field: "_name", followerId: 9, value: "Goatrude II" },
    ]);
  });

  it("rejects unknown fields and unknown followers", () => {
    const original = originalSave();

    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "ID",
        followerId: 7,
        value: 8,
      }),
    ).toThrow("not editable");
    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "XPLevel",
        followerId: 999,
        value: 1,
      }),
    ).toThrow("not in this save's living or dead follower lists");
  });

  it("stages field edits on dead followers", () => {
    const original = originalSave();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "_name",
      followerId: 30,
      value: "Late Ghost",
    });

    expect(listPendingFollowerEdits(original, edits)).toEqual([
      {
        field: "_name",
        fieldLabel: "Name",
        followerId: 30,
        followerName: "Ghost",
        from: "“Ghost”",
        to: "“Late Ghost”",
      },
    ]);
  });

  it("stages a single-flag cause of death on dead followers only", () => {
    const original = originalSave();

    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "DeathCause",
        followerId: 7,
        value: "DiedFromMurder",
      }),
    ).toThrow("Only a dead follower's cause of death");
    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "DeathCause",
        followerId: 30,
        value: "DiedOfBoredom",
      }),
    ).toThrow("known death flag");

    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "DeathCause",
      followerId: 30,
      value: "DiedFromMurder",
    });
    expect(listPendingFollowerEdits(original, edits)).toEqual([
      {
        field: "DeathCause",
        fieldLabel: "Cause of death",
        followerId: 30,
        followerName: "Ghost",
        from: "Old age",
        to: "Murdered",
      },
    ]);

    // Returning to the stored cause drops the staged edit.
    expect(
      hasFollowerEdits(
        stageFollowerEdit(original, edits, {
          field: "DeathCause",
          followerId: 30,
          value: "DiedOfOldAge",
        }),
      ),
    ).toBe(false);
  });

  it("applies a cause change with exactly one flag set", () => {
    const original = originalSave();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "DeathCause",
      followerId: 30,
      value: "DiedFromMurder",
    });

    const working = applyFollowerEdits(original, original, edits);
    const dead = (working.Followers_Dead as SaveRecord[])[0];

    expect(dead).toEqual({
      ...ghost(),
      DiedFromMurder: true,
      DiedOfOldAge: false,
    });
    expect(working.Followers).toBe(original.Followers);
  });

  it("validates values per field", () => {
    const original = originalSave();
    const stage = (field: string, value: unknown) =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field,
        followerId: 7,
        value,
      });

    expect(() => stage("XPLevel", -1)).toThrow("whole number");
    expect(() => stage("_happiness", 101)).toThrow(
      "between 0 and 100",
    );
    expect(() => stage("_name", "   ")).toThrow("non-empty text");
    expect(() =>
      stage("_name", "n".repeat(MAX_FOLLOWER_NAME_LENGTH + 1)),
    ).toThrow(`${MAX_FOLLOWER_NAME_LENGTH} characters`);
    expect(() => stage("_name", "bad\u0000name")).toThrow(
      "control characters",
    );
    expect(() => stage("Traits", [16, 99999])).toThrow(
      "catalogued trait ids",
    );
    expect(() => stage("Traits", [16, 16])).toThrow("repeat a trait");
    expect(() => stage("Outfit", 99999)).toThrow("catalogued outfit id");
  });

  it("names catalog values in the pending list", () => {
    const original = originalSave();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "Traits",
      followerId: 7,
      value: [16],
    });

    const pending = listPendingFollowerEdits(original, edits);
    expect(pending[0]?.from).toContain("Strong Constitution");
    expect(pending[0]?.to).toBe("Strong Constitution");
  });

  it("refuses a save without a follower list", () => {
    expect(() =>
      stageFollowerEdit({}, emptyFollowerEdits(), {
        field: "XPLevel",
        followerId: 7,
        value: 1,
      }),
    ).toThrow(FollowerEditError);
  });
});

describe("applyFollowerEdits", () => {
  it("applies staged edits without touching other fields", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: 7,
      value: 10,
    });
    edits = stageFollowerEdit(original, edits, {
      field: "Traits",
      followerId: 7,
      value: [16],
    });

    const working = applyFollowerEdits(original, original, edits);
    const followers = working.Followers as SaveRecord[];

    expect(working).not.toBe(original);
    expect(followers[0]).toEqual({
      ...lamb(),
      Traits: [16],
      XPLevel: 10,
    });
    expect(followers[1]).toBe((original.Followers as SaveRecord[])[1]);
    expect(working.Followers_Dead).toBe(original.Followers_Dead);
    expect((original.Followers as SaveRecord[])[0]).toEqual(lamb());
  });

  it("returns the same record when nothing is staged", () => {
    const original = originalSave();

    expect(
      applyFollowerEdits(original, original, emptyFollowerEdits()),
    ).toBe(original);
  });

  it("toggles elder status on a living follower", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "Status",
      followerId: 7,
      value: "Elder",
    });
    edits = stageFollowerEdit(original, edits, {
      field: "Status",
      followerId: 9,
      value: "Active",
    });

    const working = applyFollowerEdits(original, original, edits);
    const followers = working.Followers as SaveRecord[];

    expect(followers[0]).toEqual({ ...lamb(), OldAge: true });
    expect(followers[1]).toEqual({ ...goat(), OldAge: false });
    expect(working.Followers_Elderly_IDs).toEqual([30, 7]);
    expect(working.Followers_Dead).toBe(original.Followers_Dead);
    expect(working.Followers_Dead_IDs).toBe(
      original.Followers_Dead_IDs,
    );
  });

  it("drops a status staged back to the original", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "Status",
      followerId: 7,
      value: "Elder",
    });
    edits = stageFollowerEdit(original, edits, {
      field: "Status",
      followerId: 7,
      value: "Active",
    });

    expect(hasFollowerEdits(edits)).toBe(false);
    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "Status",
        followerId: 7,
        value: "Ghostly",
      }),
    ).toThrow("Status must be Active, Elder, or Dead");
  });

  it("kills a living follower with a chosen cause", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "Status",
      followerId: 7,
      value: "Dead",
    });
    edits = stageFollowerEdit(original, edits, {
      field: "DeathCause",
      followerId: 7,
      value: "DiedFromMurder",
    });

    expect(listPendingFollowerEdits(original, edits)).toEqual([
      {
        field: "Status",
        fieldLabel: "Status",
        followerId: 7,
        followerName: "Lamby",
        from: "Active",
        to: "Dead",
      },
      {
        field: "DeathCause",
        fieldLabel: "Cause of death",
        followerId: 7,
        followerName: "Lamby",
        from: "Ritual",
        to: "Murdered",
      },
    ]);

    const working = applyFollowerEdits(original, original, edits);
    expect(working.Followers).toEqual([goat()]);
    expect(working.Followers_Dead).toEqual([
      ghost(),
      { ...lamb(), ...deathFlags("DiedFromMurder") },
    ]);
    expect(working.Followers_Dead_IDs).toEqual([30, 7]);
    // Killing leaves elder membership alone, like the game does.
    expect(working.Followers_Elderly_IDs).toBe(
      original.Followers_Elderly_IDs,
    );
  });

  it("refuses a cause of death without a staged kill", () => {
    const original = originalSave();

    expect(() =>
      stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "DeathCause",
        followerId: 7,
        value: "DiedFromMurder",
      }),
    ).toThrow("Only a dead follower's cause of death");
  });

  it("revives a dead follower as active or elder", () => {
    const original = originalSave();
    const revived = (status: string): SaveRecord => {
      const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
        field: "Status",
        followerId: 30,
        value: status,
      });
      return applyFollowerEdits(original, original, edits);
    };

    const asElder = revived("Elder");
    expect(asElder.Followers).toEqual([
      lamb(),
      goat(),
      { ...ghost(), ...deathFlags(), OldAge: true },
    ]);
    expect(asElder.Followers_Dead).toEqual([]);
    expect(asElder.Followers_Dead_IDs).toEqual([]);
    expect(asElder.Followers_Elderly_IDs).toBe(
      original.Followers_Elderly_IDs,
    );

    const asActive = revived("Active");
    expect((asActive.Followers as SaveRecord[])[2]).toEqual({
      ...ghost(),
      ...deathFlags(),
    });
    expect(asActive.Followers_Elderly_IDs).toEqual([9]);
  });

  it("drops a staged cause when the follower is revived", () => {
    const original = originalSave();
    let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "DeathCause",
      followerId: 30,
      value: "DiedFromMurder",
    });
    edits = stageFollowerEdit(original, edits, {
      field: "Status",
      followerId: 30,
      value: "Active",
    });

    expect(edits.fields).toEqual([
      { field: "Status", followerId: 30, value: "Active" },
    ]);
  });

  it("stops when the working followers drifted from the original", () => {
    const original = originalSave();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: 7,
      value: 10,
    });
    const drifted = { ...original, Followers: [goat()] };

    expect(() => applyFollowerEdits(drifted, original, edits)).toThrow(
      "follower lists changed before the staged edits were applied",
    );
  });
});
