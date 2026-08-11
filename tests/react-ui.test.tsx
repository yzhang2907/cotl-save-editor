// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app";
import { analyzeSave } from "../src/save/analyze";
import { MAX_SAVE_BYTES } from "../src/save/limits";
import { dlcDefinition } from "../src/save/dlc";
import type { DoctrineChangePlan } from "../src/save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
  type PendingDoctrineChange,
} from "../src/save/doctrine-workspace";
import { buildCultOverview } from "../src/save/overview";
import type { SaveRecord } from "../src/save/types";
import { ActionToast, TOAST_DISMISS_AFTER_MS } from "../src/ui/action-toast";
import { AdvancedDiagnostics } from "../src/ui/advanced-diagnostics";
import { CultOverview } from "../src/ui/cult-overview";
import { EditedSaveDownload } from "../src/ui/edited-save-download";
import { doctrinePendingSaveChange } from "../src/ui/pending-save-changes";
import { SaveReader } from "../src/ui/save-reader";
import { SaveReport } from "../src/ui/save-report";
import { UnchangedRebuild } from "../src/ui/unchanged-rebuild";
import {
  ADVANCED_DIAGNOSTICS_TITLE,
  EDITED_SAVE_REVIEW_LABEL,
  EDITED_SAVE_STEP_TITLE,
  GO_TO_DOWNLOAD_LABEL,
  NO_DOCTRINE_CHANGES_LABEL,
  NO_EDITED_SAVE_CHANGES_LABEL,
  READ_ONLY_LABEL,
  SAVE_REPORT_TITLE,
  TECHNICAL_SAVE_PREVIEW_COPIED_LABEL,
  TECHNICAL_SAVE_PREVIEW_COPY_LABEL,
  TECHNICAL_SAVE_PREVIEW_LABEL,
  UNCHANGED_REBUILD_DISCLOSURE_LABEL,
  UNCHANGED_REBUILD_DOWNLOAD_LABEL,
  doctrineChangeCountLabel,
  viewPendingChangesLabel,
} from "../src/ui/copy";
import {
  BELIEF_IN_AFTERLIFE,
  FAITHFUL,
  FUNERAL,
  FURNACE_FOLLOWERS,
  INDUSTRIOUS,
  FEASTING_RITUAL,
  RITUAL_OF_RESURRECTION,
  WORK_CATEGORY,
  WORK_FIRST_PAIR,
  doctrineCategory,
  doctrineSaveFromChoices,
} from "./doctrine-fixtures";
import { EMPTY_SLOT_MESSAGEPACK_SOURCE } from "./save-fixtures";

const { currentSaveWriter, verifiedSaveBytes } = vi.hoisted(() => {
  const bytes = Uint8Array.of(1, 2, 3, 4);
  return {
    currentSaveWriter: vi.fn(async () => bytes),
    verifiedSaveBytes: bytes,
  };
});
const localFileDownload = vi.hoisted(() => vi.fn());
const TEMPORARY_NOTICE_ID = 7;
const READY_NOTICE_ID = 9;
const LOADING_NOTICE_ID = 8;
const FAILED_RAW_POSITION = 42;

vi.mock("../src/save/current-save", () => ({
  encodeVerifiedModifiedCurrentSave: currentSaveWriter,
}));
vi.mock("../src/ui/local-download", () => ({
  downloadLocalFile: localFileDownload,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ActionToast", () => {
  it("dismisses temporary notices after a short delay", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={TEMPORARY_NOTICE_ID}
        kind="info"
        message="Change staged."
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(TOAST_DISMISS_AFTER_MS.info ?? 0));

    expect(onDismiss).toHaveBeenCalledWith(TEMPORARY_NOTICE_ID);
  });

  it("dismisses a successful file notice after 3.5 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={READY_NOTICE_ID}
        kind="ready"
        message="Opened slot_0.mp."
        onDismiss={onDismiss}
      />,
    );

    const readyDelay = TOAST_DISMISS_AFTER_MS.ready ?? 0;
    act(() => vi.advanceTimersByTime(readyDelay - 1));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledWith(READY_NOTICE_ID);
  });

  it("keeps loading notices until the operation replaces them", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={LOADING_NOTICE_ID}
        kind="loading"
        message="Rebuilding…"
        onDismiss={onDismiss}
      />,
    );

    const longestDismissDelay = Math.max(
      ...Object.values(TOAST_DISMISS_AFTER_MS).filter(
        (delay): delay is number => delay !== undefined,
      ),
    );
    act(() => vi.advanceTimersByTime(longestDismissDelay * 2));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe("App", () => {
  it("refuses an oversized file without reading it", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const input = container.querySelector<HTMLInputElement>("#file-input");
    const file = new File(["save"], "slot_0.mp");
    Object.defineProperty(file, "size", { value: MAX_SAVE_BYTES + 1 });
    const readFile = vi.spyOn(file, "arrayBuffer");

    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText(/larger than the .* safety limit/),
    ).toBeTruthy();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("swaps the drop zone for a loaded state and back", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const input = container.querySelector<HTMLInputElement>("#file-input");
    const file = new File(
      [
        JSON.stringify({
          CultName: "Test",
          DoctrineUnlockedUpgrades: [],
          Followers: [],
        }),
      ],
      "slot_2.json",
      { type: "application/json" },
    );

    await user.upload(input as HTMLInputElement, file);
    await screen.findByText("slot_2.json successfully loaded");

    expect(container.querySelectorAll(".reader")).toHaveLength(1);
    expect(container.querySelectorAll(".drop-zone")).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: /choose another save/i }),
    );

    expect(container.querySelectorAll(".reader")).toHaveLength(1);
    expect(container.querySelectorAll(".save-loaded")).toHaveLength(0);
    expect(container.querySelectorAll(".drop-zone")).toHaveLength(1);
  });
});

describe("SaveReader", () => {
  it("passes the selected local file to the application", async () => {
    const user = userEvent.setup();
    const onFile = vi.fn<(file: File) => void>();
    const { container } = render(
      <SaveReader
        loadedFileName={null}
        onFile={onFile}
        onRemove={() => undefined}
        saveId={null}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("#file-input");
    const file = new File(["save"], "slot_0.mp", {
      type: "application/octet-stream",
    });

    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledWith(file);
  });
});

describe("step headers", () => {
  it("reuses the same header structure for every top-level step", () => {
    const data: SaveRecord = {
      CultTraits: FAITHFUL.cultTraitIds,
      DoctrineUnlockedUpgrades: [FAITHFUL.doctrineId],
      UnlockedUpgrades: [],
    };
    const { container } = render(
      <>
        <SaveReader
          loadedFileName={null}
          onFile={() => undefined}
          onRemove={() => undefined}
          saveId={null}
        />
        <SaveReport
          decoded={{
            data,
            format: "encrypted-messagepack",
            messagePack: EMPTY_SLOT_MESSAGEPACK_SOURCE,
          }}
          file={new File(["save"], "slot_0.mp")}
          onNotice={() => undefined}
          report={analyzeSave(data)}
        />
      </>,
    );
    const markers = [
      ...container.querySelectorAll<HTMLElement>(".step-header > .step"),
    ];

    expect(container.querySelectorAll(".step-header")).toHaveLength(3);
    expect(markers.map((marker) => marker.tagName)).toEqual([
      "SPAN",
      "SPAN",
      "SPAN",
    ]);
    expect(markers.map((marker) => marker.textContent?.trim())).toEqual([
      "I",
      "II",
      "III",
    ]);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: SAVE_REPORT_TITLE,
      }),
    ).toBeTruthy();
    const downloadCard = screen
      .getByRole("heading", {
        level: 2,
        name: EDITED_SAVE_STEP_TITLE,
      })
      .closest(".report");
    expect(downloadCard?.classList).toContain("modified-save-check");
    const noChangesButton = screen.getByRole("button", {
      name: NO_EDITED_SAVE_CHANGES_LABEL,
    });
    expect(noChangesButton.hasAttribute("disabled")).toBe(true);
  });
});

describe("EditedSaveDownload", () => {
  const workReplacementLabel = `${FAITHFUL.name} → ${INDUSTRIOUS.name}`;
  const replacement: PendingDoctrineChange = {
    categoryName: WORK_CATEGORY.name,
    fromDoctrineId: FAITHFUL.doctrineId,
    fromName: FAITHFUL.name,
    operation: "replace",
    rank: WORK_FIRST_PAIR.rank,
    requiredDlc: null,
    toDoctrineId: INDUSTRIOUS.doctrineId,
    toName: INDUSTRIOUS.name,
  };

  function saveData() {
    const original: SaveRecord = {
      CultTraits: FAITHFUL.cultTraitIds,
      DoctrineUnlockedUpgrades: [FAITHFUL.doctrineId],
      UnlockedUpgrades: [],
    };
    const working: SaveRecord = {
      ...original,
      CultTraits: INDUSTRIOUS.cultTraitIds,
      DoctrineUnlockedUpgrades: [INDUSTRIOUS.doctrineId],
    };
    const source = EMPTY_SLOT_MESSAGEPACK_SOURCE;
    return { original, source, working };
  }

  it("reviews, verifies, and downloads in one guarded action", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    const { original, source, working } = saveData();

    const { container } = render(
      <EditedSaveDownload
        changes={[doctrinePendingSaveChange(replacement)]}
        fileName="slot_0.mp"
        onNotice={onNotice}
        original={original}
        source={source}
        working={working}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: EDITED_SAVE_STEP_TITLE,
      }),
    ).toBeTruthy();
    expect(
      container.querySelector(".modified-save-check .step")?.textContent,
    ).toBe("III");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Final changes")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Final changes")).toBeTruthy();
    expect(screen.getByText(workReplacementLabel)).toBeTruthy();
    const download = screen.getByRole("button", {
      name: "Verify and download slot_0.edited.mp",
    });
    expect(download.hasAttribute("disabled")).toBe(true);
    expect(localFileDownload).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /backed up the entire Cult of the Lamb save folder/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /game is completely closed/,
      }),
    );
    expect(download.hasAttribute("disabled")).toBe(false);

    await user.click(download);
    expect(currentSaveWriter).toHaveBeenCalledWith(source, original, working);
    expect(localFileDownload).toHaveBeenCalledWith(
      verifiedSaveBytes,
      "slot_0.edited.mp",
    );
    expect(onNotice).toHaveBeenLastCalledWith(
      "Downloaded slot_0.edited.mp.",
      "ready",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector(".edited-save-status")).toBeNull();
  });

  it("shows recovery guidance and never enables a failed file", async () => {
    const user = userEvent.setup();
    const { original, source, working } = saveData();
    currentSaveWriter.mockRejectedValueOnce(
      new Error(`raw position ${FAILED_RAW_POSITION} changed`),
    );

    render(
      <EditedSaveDownload
        changes={[doctrinePendingSaveChange(replacement)]}
        fileName="slot_0.mp"
        onNotice={() => undefined}
        original={original}
        source={source}
        working={working}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /backed up the entire Cult of the Lamb save folder/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /game is completely closed/,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Verify and download slot_0.edited.mp",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      `raw position ${FAILED_RAW_POSITION} changed`,
    );
    const recovery = screen
      .getByText("If the edited save does not work")
      .closest("details");
    expect(recovery?.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(localFileDownload).not.toHaveBeenCalled();
  });

  it("requires Woolhaven installation confirmation for DLC changes", async () => {
    const user = userEvent.setup();
    const { original, source, working } = saveData();
    const woolhaven: PendingDoctrineChange = {
      ...replacement,
      categoryName: doctrineCategory("winter").name,
      fromDoctrineId: null,
      fromName: null,
      operation: "unlock",
      requiredDlc: "woolhaven",
      toDoctrineId: FURNACE_FOLLOWERS.doctrineId,
      toName: FURNACE_FOLLOWERS.name,
    };

    render(
      <EditedSaveDownload
        changes={[doctrinePendingSaveChange(woolhaven)]}
        fileName="slot_4.MP"
        onNotice={() => undefined}
        original={original}
        source={source}
        working={working}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /backed up the entire Cult of the Lamb save folder/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /game is completely closed/,
      }),
    );
    const download = screen.getByRole("button", {
      name: "Verify and download slot_4.edited.mp",
    });
    expect(
      screen.getByText("slot_4.edited.mp", { selector: "code" }),
    ).toBeTruthy();
    expect(screen.getByText("slot_4.MP", { selector: "code" })).toBeTruthy();
    expect(download.hasAttribute("disabled")).toBe(true);

    await user.click(
      screen.getByRole("checkbox", {
        name: new RegExp(
          `${dlcDefinition("woolhaven").displayName} is installed`,
        ),
      }),
    );
    expect(download.hasAttribute("disabled")).toBe(false);
  });
});

describe("AdvancedDiagnostics", () => {
  it("keeps secondary tools in low-emphasis disclosures", async () => {
    const user = userEvent.setup();
    const source = EMPTY_SLOT_MESSAGEPACK_SOURCE;

    render(
      <AdvancedDiagnostics data={{}}>
        <UnchangedRebuild
          file={new File(["save"], "slot_2.mp")}
          onNotice={() => undefined}
          pendingChangeCount={0}
          source={source}
        />
      </AdvancedDiagnostics>,
    );

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: ADVANCED_DIAGNOSTICS_TITLE,
      }),
    ).toBeTruthy();

    const preview = screen
      .getByText(TECHNICAL_SAVE_PREVIEW_LABEL)
      .closest("details") as HTMLDetailsElement;
    const rebuild = screen
      .getByText(UNCHANGED_REBUILD_DISCLOSURE_LABEL)
      .closest("details") as HTMLDetailsElement;
    expect(preview.open).toBe(false);
    expect(rebuild.open).toBe(false);
    expect(rebuild.querySelector("button")?.textContent).toBe(
      UNCHANGED_REBUILD_DOWNLOAD_LABEL,
    );

    await user.click(screen.getByText(UNCHANGED_REBUILD_DISCLOSURE_LABEL));
    expect(rebuild.open).toBe(true);
  });

  it("copies the serialized record to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>(
      async () => undefined,
    );
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<AdvancedDiagnostics data={{ CultName: "Copy Cult" }} />);

    await user.click(
      screen.getByRole("button", {
        name: TECHNICAL_SAVE_PREVIEW_COPY_LABEL,
      }),
    );

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain("Copy Cult");
    expect(
      await screen.findByRole("button", {
        name: TECHNICAL_SAVE_PREVIEW_COPIED_LABEL,
      }),
    ).toBeTruthy();
  });
});

describe("SaveReport editing", () => {
  const GOLD = { QuantityReserved: 5, quantity: 123, type: 20 };
  const editingSave: SaveRecord = doctrineSaveFromChoices(
    [FAITHFUL, BELIEF_IN_AFTERLIFE, FUNERAL],
    {
      BaseStructures: [],
      CultName: "Test Cult",
      Followers: [],
      UnlockedSermonsAndRituals: [],
      items: [{ ...GOLD }, { QuantityReserved: 0, quantity: 4, type: 154 }],
    },
  );

  function renderEditingReport(onNotice = () => undefined) {
    return render(
      <SaveReport
        decoded={{
          data: structuredClone(editingSave),
          format: "encrypted-messagepack",
          messagePack: EMPTY_SLOT_MESSAGEPACK_SOURCE,
        }}
        file={new File(["save"], "slot_0.mp")}
        onNotice={onNotice}
        report={analyzeSave(editingSave)}
      />,
    );
  }

  it("stages and discards a cult rename", async () => {
    const user = userEvent.setup();
    const { container } = renderEditingReport();

    await user.click(screen.getByRole("button", { name: "Rename the cult" }));
    const nameInput = screen.getByRole("textbox", {
      name: "New cult name",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Chosen of the Isopod");
    await user.click(
      screen.getByRole("button", { name: "Stage the cult name edit" }),
    );

    expect(screen.getByText("Chosen of the Isopod")).toBeTruthy();
    expect(screen.getByText("was “Test Cult”")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );

    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Cult name")).toBeTruthy();
    expect(
      within(dialog).getByText("“Test Cult” → “Chosen of the Isopod”"),
    ).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Discard the cult name edit" }),
    );
    expect(screen.getByText("Test Cult")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      NO_DOCTRINE_CHANGES_LABEL,
    );
  });

  it("shows jump shortcuts only while changes are staged", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView() {
      scrolled.push((this as Element).id);
    };
    const user = userEvent.setup();
    renderEditingReport();

    expect(
      screen.queryByRole("button", { name: GO_TO_DOWNLOAD_LABEL }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Rename the cult" }));
    const nameInput = screen.getByRole("textbox", {
      name: "New cult name",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Flock");
    await user.click(
      screen.getByRole("button", { name: "Stage the cult name edit" }),
    );

    await user.click(
      screen.getByRole("button", { name: viewPendingChangesLabel(1) }),
    );
    await user.click(
      screen.getByRole("button", { name: GO_TO_DOWNLOAD_LABEL }),
    );
    expect(scrolled).toEqual(["pending-changes", "edited-save-download"]);

    await user.click(
      screen.getByRole("button", { name: "Discard the cult name edit" }),
    );
    expect(
      screen.queryByRole("button", { name: GO_TO_DOWNLOAD_LABEL }),
    ).toBeNull();
  });

  it("warns about names beyond the game's entry limit, but stages them", async () => {
    const user = userEvent.setup();
    const { container } = renderEditingReport();

    await user.click(screen.getByRole("button", { name: "Rename the cult" }));
    const nameInput = screen.getByRole("textbox", {
      name: "New cult name",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Congregation of the Woolly Deep");
    expect(
      screen.getByText(/rename screen cannot type it back in/),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Stage the cult name edit" }),
    );

    expect(screen.getByText("Congregation of the Woolly Deep")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );
  });

  it("stages, lists, and discards a resource edit", async () => {
    const user = userEvent.setup();
    const { container } = renderEditingReport();

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Edit Gold Coins" }));
    const quantityInput = screen.getByRole("spinbutton", {
      name: "Gold Coins quantity",
    });
    await user.clear(quantityInput);
    await user.type(quantityInput, "400");
    await user.click(
      screen.getByRole("button", { name: "Stage the Gold Coins edit" }),
    );

    expect(screen.getByText("Item 20 · edited")).toBeTruthy();
    expect(screen.getByText("400")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );

    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );
    const review = screen.getByRole("dialog");
    expect(within(review).getByText("Resources · Gold Coins")).toBeTruthy();
    expect(within(review).getByText("123 → 400")).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Discard the Gold Coins edit" }),
    );
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      NO_DOCTRINE_CHANGES_LABEL,
    );
    expect(screen.queryByText("Item 20 · edited")).toBeNull();
  });

  it("keeps a single quantity editor open at a time", async () => {
    const user = userEvent.setup();
    renderEditingReport();

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Edit Gold Coins" }));
    expect(
      screen.getByRole("spinbutton", { name: "Gold Coins quantity" }),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit Sin" }));
    expect(
      screen.queryByRole("spinbutton", { name: "Gold Coins quantity" }),
    ).toBeNull();
    expect(
      screen.getByRole("spinbutton", { name: "Sin quantity" }),
    ).toBeTruthy();
  });

  it("stages an added item from the catalog picker", async () => {
    const user = userEvent.setup();
    const { container } = renderEditingReport();

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Add an item" }));
    const picker = screen.getByRole("dialog");
    await user.type(
      within(picker).getByRole("searchbox", {
        name: "Search the item catalog",
      }),
      "Stone",
    );
    await user.click(
      within(picker).getByRole("button", { name: "Stone (Item 2)" }),
    );
    const quantityInput = within(picker).getByRole("spinbutton", {
      name: "Quantity",
    });
    await user.clear(quantityInput);
    await user.type(quantityInput, "250");
    await user.click(within(picker).getByRole("button", { name: "Add Stone" }));

    expect(screen.getByText("Stone")).toBeTruthy();
    expect(screen.getByText("Item 2 · edited")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );

    await user.click(
      screen.getByRole("button", { name: EDITED_SAVE_REVIEW_LABEL }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Add 250"),
    ).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Discard the Stone edit" }),
    );
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      NO_DOCTRINE_CHANGES_LABEL,
    );
    expect(screen.queryByText("Item 2 · edited")).toBeNull();
  });

  it("disables Woolhaven items in the picker without the DLC", async () => {
    const user = userEvent.setup();
    renderEditingReport();

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Add an item" }));
    const picker = screen.getByRole("dialog");
    await user.type(
      within(picker).getByRole("searchbox", {
        name: "Search the item catalog",
      }),
      "Woolhaven",
    );
    const option = within(picker).getByRole("button", {
      name: "Woolhaven Necklace (Item 185)",
    });
    expect((option as HTMLButtonElement).disabled).toBe(true);
    expect(within(picker).getByText(/needs Woolhaven/)).toBeTruthy();
  });

  it("lists never-obtainable items in their own picker section", async () => {
    const user = userEvent.setup();
    renderEditingReport();

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Add an item" }));
    const picker = screen.getByRole("dialog");
    await user.type(
      within(picker).getByRole("searchbox", {
        name: "Search the item catalog",
      }),
      "Cod",
    );
    const section = within(picker)
      .getByText("Unobtainable items")
      .closest("section");
    expect(section).not.toBeNull();
    expect(
      within(section as HTMLElement).getByRole("button", {
        name: "Cod (Item 135)",
      }),
    ).toBeTruthy();
  });

  it("refuses an invalid resource quantity with a notice", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    const { container } = renderEditingReport(onNotice);

    await user.click(screen.getByText("Resources"));
    await user.click(screen.getByRole("button", { name: "Edit Gold Coins" }));
    const quantityInput = screen.getByRole("spinbutton", {
      name: "Gold Coins quantity",
    });
    await user.clear(quantityInput);
    await user.type(quantityInput, "99999999");
    await user.click(
      screen.getByRole("button", { name: "Stage the Gold Coins edit" }),
    );

    expect(onNotice).toHaveBeenCalledWith(
      expect.stringContaining("The resource edit was not staged"),
      "error",
    );
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      NO_DOCTRINE_CHANGES_LABEL,
    );
  });
});

describe("CultOverview", () => {
  const workReplacementLabel = `${FAITHFUL.name} → ${INDUSTRIOUS.name}`;
  const sustenanceUnlockLabel = `Unlock ${FEASTING_RITUAL.name}`;
  const afterlifeReplacementLabel = `${FUNERAL.name} → ${RITUAL_OF_RESURRECTION.name}`;
  const save: SaveRecord = doctrineSaveFromChoices(
    [FAITHFUL, BELIEF_IN_AFTERLIFE, FUNERAL],
    {
      BaseStructures: [],
      CultName: "Test Cult",
      Followers: [],
      UnlockedSermonsAndRituals: [],
      items: [],
    },
  );

  function CultOverviewHarness() {
    const [workspace, setWorkspace] = useState(() =>
      createDoctrineWorkspace(save),
    );

    function apply(plan: DoctrineChangePlan): boolean {
      setWorkspace(applyDoctrineChange(workspace, plan));
      return true;
    }

    return (
      <CultOverview
        data={workspace.data}
        onApplyDoctrine={apply}
        onDiscardAllChanges={() =>
          setWorkspace(resetDoctrineChanges(workspace))
        }
        originalDoctrine={buildCultOverview(workspace.original).doctrine}
        overview={buildCultOverview(workspace.data)}
        pendingChanges={listPendingDoctrineChanges(workspace).map((change) => ({
          ...doctrinePendingSaveChange(change),
          onDiscard: () =>
            setWorkspace(discardDoctrineChange(workspace, change)),
        }))}
      />
    );
  }

  it("starts with every overview section closed", () => {
    const { container } = render(<CultOverviewHarness />);
    const sections = [
      ...container.querySelectorAll<HTMLDetailsElement>(
        "details.overview-panel",
      ),
    ];

    expect(sections).toHaveLength(4);
    expect(sections.every((section) => !section.open)).toBe(true);
    const readOnlySections = sections.filter(
      (section) =>
        section.querySelector("summary .summary-badge")?.textContent ===
        READ_ONLY_LABEL,
    );
    expect(readOnlySections).toHaveLength(3);
    expect(screen.getByText(NO_DOCTRINE_CHANGES_LABEL)).toBeTruthy();
  });

  it("changes a doctrine directly and marks the new choice", async () => {
    const user = userEvent.setup();
    const { container } = render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    const industrious = screen.getByRole("button", {
      name: new RegExp(INDUSTRIOUS.name),
    });
    await user.click(industrious);

    expect(industrious.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );
    expect(screen.getByText("Changed")).toBeTruthy();
    expect(screen.getByText("Pending changes")).toBeTruthy();
    expect(screen.getByText(workReplacementLabel)).toBeTruthy();
    expect(screen.queryByText(/Catalog for game/)).toBeNull();
  });

  it("unlocks a missing tier and labels it as an unlock", async () => {
    const user = userEvent.setup();
    render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    const feast = screen.getByRole("button", {
      name: new RegExp(FEASTING_RITUAL.name),
    });
    expect(feast.hasAttribute("disabled")).toBe(false);
    await user.click(feast);

    expect(feast.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Unlocked")).toBeTruthy();
    expect(screen.getByText(sustenanceUnlockLabel)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `Discard ${sustenanceUnlockLabel}`,
      }),
    ).toBeTruthy();

    await user.click(feast);
    expect(feast.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText("Pending changes")).toBeNull();
    expect(screen.queryByText("Unlocked")).toBeNull();
  });

  it("marks only the immediate next missing rank as unlockable", async () => {
    const user = userEvent.setup();
    render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    const nextChoice = screen.getByRole("button", { name: /Inspire/ });
    const laterChoice = screen.getByRole("button", {
      name: /Glory of Construction/,
    });
    const gatedChoice = screen.getByRole("button", {
      name: /Furnace Followers/,
    });

    expect(nextChoice.closest(".doctrine-pair")?.classList).toContain(
      "unlockable",
    );
    expect(nextChoice.hasAttribute("disabled")).toBe(false);
    expect(laterChoice.closest(".doctrine-pair")?.classList).toContain(
      "locked",
    );
    expect(laterChoice.hasAttribute("disabled")).toBe(true);
    expect(gatedChoice.closest(".doctrine-pair")?.classList).toContain(
      "locked",
    );
    expect(gatedChoice.hasAttribute("disabled")).toBe(true);
  });

  it("stages several net changes and discards one by name", async () => {
    const user = userEvent.setup();
    const { container } = render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(INDUSTRIOUS.name),
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(RITUAL_OF_RESURRECTION.name),
      }),
    );

    expect(screen.getByText("Pending changes")).toBeTruthy();
    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(2),
    );
    expect(screen.getByText(workReplacementLabel)).toBeTruthy();
    expect(screen.getByText(afterlifeReplacementLabel)).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: `Discard ${afterlifeReplacementLabel}`,
      }),
    );

    expect(container.querySelector(".change-count-seal")?.textContent).toBe(
      doctrineChangeCountLabel(1),
    );
    expect(screen.queryByText(afterlifeReplacementLabel)).toBeNull();
    expect(
      screen
        .getByRole("button", {
          name: new RegExp(FUNERAL.name),
        })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
