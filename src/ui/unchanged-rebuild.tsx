import { useState } from "react";

import type { MessagePackSource } from "../save/types";
import type { StatusKind } from "./status-banner";

interface UnchangedRebuildProps {
  file: File;
  onStatus: (message: string, kind: StatusKind) => void;
  source: MessagePackSource;
}

function roundTripFileName(fileName: string): string {
  return /\.mp$/i.test(fileName)
    ? fileName.replace(/\.mp$/i, ".roundtrip.mp")
    : `${fileName}.roundtrip.mp`;
}

export function UnchangedRebuild({
  file,
  onStatus,
  source,
}: UnchangedRebuildProps) {
  const [busy, setBusy] = useState(false);

  async function download(): Promise<void> {
    setBusy(true);
    onStatus("Rebuilding the save locally…", "loading");
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
      onStatus(
        `Downloaded ${outputName}. The original file was not changed.`,
        "ready",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onStatus(`The test copy could not be created: ${message}`, "error");
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
