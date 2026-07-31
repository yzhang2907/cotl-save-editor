// @vitest-environment jsdom

import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DoctrineChangePlan } from "../src/save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
} from "../src/save/doctrine-workspace";
import { buildCultOverview } from "../src/save/overview";
import type { SaveRecord } from "../src/save/types";
import { ActionToast } from "../src/ui/action-toast";
import { CultOverview } from "../src/ui/cult-overview";
import { SaveReader } from "../src/ui/save-reader";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ActionToast", () => {
  it("dismisses temporary notices after a short delay", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={7}
        kind="info"
        message="Change staged."
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(3_500));

    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it("dismisses a successful file notice after 3.5 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={9}
        kind="ready"
        message="Opened slot_0.mp."
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(3_499));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledWith(9);
  });

  it("keeps loading notices until the operation replaces them", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn<(id: number) => void>();

    render(
      <ActionToast
        id={8}
        kind="loading"
        message="Rebuilding…"
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(30_000));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe("SaveReader", () => {
  it("passes the selected local file to the application", async () => {
    const user = userEvent.setup();
    const onFile = vi.fn<(file: File) => void>();
    const { container } = render(<SaveReader onFile={onFile} />);
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

describe("CultOverview", () => {
  const save: SaveRecord = {
    BaseStructures: [],
    CultName: "Test Cult",
    CultTraits: [11, 3],
    DoctrineUnlockedUpgrades: [10, 33],
    Followers: [],
    UnlockedSermonsAndRituals: [],
    UnlockedUpgrades: [111, 60],
    items: [],
  };

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
        doctrineChanges={listPendingDoctrineChanges(workspace)}
        onApplyDoctrine={apply}
        onDiscardDoctrine={(change) =>
          setWorkspace(discardDoctrineChange(workspace, change))
        }
        originalDoctrine={buildCultOverview(workspace.original).doctrine}
        onResetDoctrines={() =>
          setWorkspace(resetDoctrineChanges(workspace))
        }
        overview={buildCultOverview(workspace.data)}
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
  });

  it("changes a doctrine directly and marks the new choice", async () => {
    const user = userEvent.setup();
    render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    const industrious = screen.getByRole("button", {
      name: /Industrious/,
    });
    await user.click(industrious);

    expect(industrious.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Changed")).toBeTruthy();
    expect(screen.getByText("Pending doctrine changes")).toBeTruthy();
    expect(screen.getByText("Faithful → Industrious")).toBeTruthy();
    expect(screen.queryByText(/Catalog for game/)).toBeNull();
  });

  it("stages several net changes and discards one by name", async () => {
    const user = userEvent.setup();
    render(<CultOverviewHarness />);

    await user.click(screen.getByText("Doctrines"));
    await user.click(
      screen.getByRole("button", { name: /Industrious/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Ritual of Resurrection/ }),
    );

    expect(screen.getByText("Pending doctrine changes")).toBeTruthy();
    expect(screen.getByText("2 changes")).toBeTruthy();
    expect(screen.getByText("Faithful → Industrious")).toBeTruthy();
    expect(
      screen.getByText("Funeral → Ritual of Resurrection"),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: "Discard Funeral → Ritual of Resurrection",
      }),
    );

    expect(screen.getByText("1 change")).toBeTruthy();
    expect(screen.queryByText("Funeral → Ritual of Resurrection")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Funeral/ }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });
});
