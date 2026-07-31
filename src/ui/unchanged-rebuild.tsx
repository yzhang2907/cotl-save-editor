import { useState } from "react";

import type { MessagePackSource } from "../save/types";
import type { ToastKind } from "./action-toast";

interface UnchangedRebuildProps {
  file: File;
  onNotice: (message: string, kind: ToastKind) => void;
  pendingChangeCount: number;
  source: MessagePackSource;
}

function roundTripFileName(fileName: string): string {
  return /\.mp$/i.test(fileName)
    ? fileName.replace(/\.mp$/i, ".roundtrip.mp")
    : `${fileName}.roundtrip.mp`;
}

export function UnchangedRebuild({
  file,
  onNotice,
  pendingChangeCount,
  source,
}: UnchangedRebuildProps) {
  const [busy, setBusy] = useState(false);

  async function download(): Promise<void> {
    setBusy(true);
    onNotice("Rebuilding the save locally…", "loading");
    try {
      const { encodeVerifiedMessagePackSave } = await import("../save/encode");
      const encoded = await encodeVerifiedMessagePackSave(source);
      const outputName = roundTripFileName(file.name);
      const bytes = encoded.slice().buffer as ArrayBuffer;
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/octet-stream",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = outputName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      onNotice(`Downloaded ${outputName}.`, "ready");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(`The test copy could not be created: ${message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="write-check">
      <div>
        <p className="section-label">Compatibility check</p>
        <h3>Download an unchanged rebuild</h3>
        <p>
          This keeps the original game-data bytes and only rebuilds their
          compression and encryption. It cannot replace the file you opened.
        </p>
        {pendingChangeCount > 0 ? (
          <p className="write-check-warning">
            This test rebuild will not include the pending doctrine changes.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Rebuilding…" : "Download unchanged rebuild"}
      </button>
    </section>
  );
}
