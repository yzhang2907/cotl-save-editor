import { describe, expect, it } from "vitest";

import type { PendingCultEdit } from "../src/save/cult-edits";
import type { PendingFollowerEdit } from "../src/save/follower-edits";
import type { PendingDoctrineChange } from "../src/save/doctrine-workspace";
import {
  cultEditPendingSaveChange,
  doctrinePendingSaveChange,
  followerEditPendingSaveChange,
} from "../src/ui/pending-save-changes";

describe("doctrinePendingSaveChange", () => {
  it("keys the change by category and rank", () => {
    const change: PendingDoctrineChange = {
      categoryName: "Work & Worship",
      fromDoctrineId: 1,
      fromName: "Faithful",
      operation: "replace",
      rank: 2,
      requiredDlc: "woolhaven",
      toDoctrineId: 2,
      toName: "Industrious",
    };

    expect(doctrinePendingSaveChange(change)).toEqual({
      key: "doctrine-Work & Worship-2",
      label: "Faithful → Industrious",
      requiredDlc: "woolhaven",
      scope: "Work & Worship · Rank 2",
    });
  });
});

describe("followerEditPendingSaveChange", () => {
  const edit: PendingFollowerEdit = {
    field: "XPLevel",
    fieldLabel: "Level",
    followerId: 7,
    followerName: "Webb",
    from: "3",
    to: "10",
  };

  it("keys a direct edit by follower and field", () => {
    expect(followerEditPendingSaveChange(edit)).toEqual({
      key: "follower-7-XPLevel",
      label: "Level: 3 → 10",
      requiredDlc: null,
      scope: "Followers · Webb",
    });
  });

  it("keys a derived edit through its source field", () => {
    // The discard flow routes a derived row through its source field,
    // so the key must stay distinct from a direct edit of the same
    // field.
    expect(
      followerEditPendingSaveChange({
        ...edit,
        field: "LifeExpectancy",
        fieldLabel: "Life expectancy",
        from: "60",
        sourceField: "Status",
        to: "75",
      }),
    ).toEqual({
      key: "follower-7-Status-LifeExpectancy",
      label: "Life expectancy: 60 → 75",
      requiredDlc: null,
      scope: "Followers · Webb",
    });
  });
});

describe("cultEditPendingSaveChange", () => {
  it("labels a rename with both names quoted", () => {
    const edit: PendingCultEdit = {
      from: "Test Cult",
      kind: "cult-name",
      to: "Chosen of the Isopod",
    };

    expect(cultEditPendingSaveChange(edit)).toEqual({
      key: "cult-name",
      label: "“Test Cult” → “Chosen of the Isopod”",
      requiredDlc: null,
      scope: "Cult name",
    });
  });

  it("labels an addition and keeps its DLC requirement", () => {
    const edit: PendingCultEdit = {
      itemName: "Woolhaven Necklace",
      itemType: 185,
      kind: "resource-add",
      quantity: 250,
      requiredDlc: "woolhaven",
      reserved: 0,
    };

    expect(cultEditPendingSaveChange(edit)).toEqual({
      key: "resource-add-185",
      label: "Add 250",
      requiredDlc: "woolhaven",
      scope: "Resources · Woolhaven Necklace",
    });
  });

  it("mentions a reserved quantity only when one is added", () => {
    const edit: PendingCultEdit = {
      itemName: "Stone",
      itemType: 2,
      kind: "resource-add",
      quantity: 250,
      requiredDlc: null,
      reserved: 25,
    };

    expect(cultEditPendingSaveChange(edit).label).toBe(
      "Add 250 (reserved 25)",
    );
  });

  it("lists only the quantities that changed on an edit", () => {
    const base: PendingCultEdit = {
      itemName: "Gold Coins",
      itemType: 20,
      kind: "resource",
      quantityFrom: 123,
      quantityTo: 400,
      reservedFrom: 5,
      reservedTo: 5,
    };

    expect(cultEditPendingSaveChange(base)).toEqual({
      key: "resource-20",
      label: "123 → 400",
      requiredDlc: null,
      scope: "Resources · Gold Coins",
    });
    expect(
      cultEditPendingSaveChange({
        ...base,
        quantityTo: 123,
        reservedTo: 9,
      }).label,
    ).toBe("reserved 5 → 9");
    expect(
      cultEditPendingSaveChange({ ...base, reservedTo: 9 }).label,
    ).toBe("123 → 400, reserved 5 → 9");
  });
});
