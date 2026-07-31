// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildCultOverview } from "../src/save/overview";
import type { SaveRecord } from "../src/save/types";
import { CultOverview } from "../src/ui/cult-overview";
import { SaveReader } from "../src/ui/save-reader";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
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
    CultTraits: [11],
    DoctrineUnlockedUpgrades: [10],
    Followers: [],
    UnlockedSermonsAndRituals: [],
    UnlockedUpgrades: [],
    items: [],
  };

  it("starts with every overview section closed", () => {
    const { container } = render(
      <CultOverview data={save} overview={buildCultOverview(save)} />,
    );
    const sections = [
      ...container.querySelectorAll<HTMLDetailsElement>(
        "details.overview-panel",
      ),
    ];

    expect(sections).toHaveLength(4);
    expect(sections.every((section) => !section.open)).toBe(true);
  });

  it("opens doctrines and renders a replacement preview", async () => {
    const user = userEvent.setup();
    render(<CultOverview data={save} overview={buildCultOverview(save)} />);

    await user.click(screen.getByText("Doctrines"));
    await user.click(
      screen.getByRole("button", { name: "Preview Industrious" }),
    );

    expect(screen.getByText("Faithful → Industrious")).toBeTruthy();
    expect(screen.getByText("You lose")).toBeTruthy();
    expect(screen.getByText("You gain")).toBeTruthy();
  });
});
