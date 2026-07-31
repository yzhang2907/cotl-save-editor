import { useState } from "react";

import type { MessagePackSource } from "../save/types";
import type { ToastKind } from "./action-toast";
import {
  UNCHANGED_REBUILD_DISCLOSURE_LABEL,
  UNCHANGED_REBUILD_DOWNLOAD_LABEL,
} from "./copy";
import { downloadLocalFile } from "./local-download";

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
      downloadLocalFile(encoded, outputName);
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
    <details className="diagnostic-disclosure unchanged-rebuild">
      <summary>{UNCHANGED_REBUILD_DISCLOSURE_LABEL}</summary>
      <div className="unchanged-rebuild-content">
        <div>
          <p>
            Download a test copy that keeps the original game-data bytes and
            only rebuilds their compression and encryption. It cannot replace
            the file you opened.
          </p>
          {pendingChangeCount > 0 ? (
            <p className="unchanged-rebuild-warning">
              This test rebuild will not include the pending doctrine changes.
            </p>
          ) : null}
        </div>
        <button
          aria-busy={busy}
          type="button"
          disabled={busy}
          onClick={() => void download()}
        >
          {busy ? "Rebuilding…" : UNCHANGED_REBUILD_DOWNLOAD_LABEL}
        </button>
      </div>
    </details>
  );
}
