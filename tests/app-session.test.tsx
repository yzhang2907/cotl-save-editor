// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app";
import { emptyCultEdits } from "../src/save/cult-edits";
import { emptyFollowerEdits } from "../src/save/follower-edits";
import type { CachedSession } from "../src/save/session-cache";

const { clearCachedSession, readCachedSession, writeCachedSession } =
  vi.hoisted(() => ({
    clearCachedSession: vi.fn(async (): Promise<void> => undefined),
    readCachedSession: vi.fn(
      async (): Promise<CachedSession | null> => null,
    ),
    writeCachedSession: vi.fn(async (): Promise<void> => undefined),
  }));

vi.mock("../src/save/session-cache", () => ({
  clearCachedSession,
  readCachedSession,
  writeCachedSession,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function jsonSaveBytes(): ArrayBuffer {
  return new TextEncoder()
    .encode(
      JSON.stringify({
        CultName: "Cached Cult",
        DoctrineUnlockedUpgrades: [],
        Followers: [],
      }),
    )
    .slice().buffer;
}

function cachedSession(): CachedSession {
  return {
    bytes: jsonSaveBytes(),
    cultEdits: emptyCultEdits(),
    doctrineHistory: [],
    fileName: "slot_3.json",
    followerEdits: emptyFollowerEdits(),
    lastModified: 1_700_000_000_000,
    savedAt: Date.now(),
  };
}

describe("App session restore", () => {
  it("restores the cached session on load", async () => {
    readCachedSession.mockResolvedValueOnce(cachedSession());

    render(<App />);

    expect(
      await screen.findByText(
        "Restored your last session with slot_3.json.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("slot_3.json successfully loaded"),
    ).toBeTruthy();
    expect(screen.getByText("Cached Cult")).toBeTruthy();
    // Reopening the restored save re-caches it with the same identity.
    expect(writeCachedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "slot_3.json",
        lastModified: 1_700_000_000_000,
      }),
    );
  });

  it("clears a cached session that no longer decodes", async () => {
    readCachedSession.mockResolvedValueOnce({
      ...cachedSession(),
      bytes: Uint8Array.of(9, 9, 9).slice().buffer,
    });

    const { container } = render(<App />);

    await waitFor(() => expect(clearCachedSession).toHaveBeenCalled());
    expect(screen.queryByText(/Restored your last session/)).toBeNull();
    expect(container.querySelectorAll(".drop-zone")).toHaveLength(1);
  });

  it("starts with the drop zone when nothing is cached", async () => {
    const { container } = render(<App />);

    await waitFor(() => expect(readCachedSession).toHaveBeenCalled());
    expect(screen.queryByText(/Restored your last session/)).toBeNull();
    expect(container.querySelectorAll(".drop-zone")).toHaveLength(1);
  });

  it("caches an opened file and clears it on removal", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const input = container.querySelector<HTMLInputElement>("#file-input");
    const file = new File([jsonSaveBytes()], "slot_2.json", {
      lastModified: 1_700_000_005_000,
      type: "application/json",
    });

    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);
    await screen.findByText("slot_2.json successfully loaded");

    expect(writeCachedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "slot_2.json",
        lastModified: 1_700_000_005_000,
      }),
    );
    expect(clearCachedSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(clearCachedSession).toHaveBeenCalledOnce();
    expect(await screen.findByText("Removed slot_2.json.")).toBeTruthy();
    expect(container.querySelectorAll(".drop-zone")).toHaveLength(1);
  });
});
