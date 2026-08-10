import { useEffect, useState } from "react";

import type { MessagePackSource } from "../save/types";
import type { ToastKind } from "./action-toast";
import {
  UNCHANGED_REBUILD_DISCLOSURE_LABEL,
  UNCHANGED_REBUILD_DOWNLOAD_LABEL,
} from "./copy";
import { errorMessage } from "./error-message";
import { downloadLocalFile } from "./local-download";
import "./unchanged-rebuild.css";

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

  useEffect(() => {
    // Warm the encoder module so a redeploy cannot delete its chunk
    // out from under an already-open tab.
    void import("../save/encode").catch(() => undefined);
  }, []);

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
      onNotice(
        `The test copy could not be created: ${errorMessage(error)}`,
        "error",
      );
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
            Download a test copy that keeps the original game-data bytes
            and rebuilds only the compression and encryption.
          </p>
          {pendingChangeCount > 0 ? (
            <p className="unchanged-rebuild-warning">
              This test rebuild will not include the pending doctrine changes.
            </p>
          ) : null}
        </div>
        <button
          aria-busy={busy}
          className="unchanged-rebuild-download"
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
