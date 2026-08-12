// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadLocalFile } from "../src/ui/local-download";

afterEach(() => {
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("downloadLocalFile", () => {
  it("clicks a download link for the bytes, then revokes the URL", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(
      (_source: Blob | MediaSource) => "blob:cotl-test",
    );
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const bytes = Uint8Array.of(69, 1, 2, 3);

    downloadLocalFile(bytes, "slot_0.edited.mp");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0];
    if (!(blob instanceof Blob)) {
      throw new Error("Expected a Blob download source.");
    }
    expect(blob.type).toBe("application/octet-stream");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe("blob:cotl-test");
    expect(anchor.download).toBe("slot_0.edited.mp");

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cotl-test");
  });
});
