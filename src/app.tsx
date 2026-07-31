import { useCallback, useRef, useState } from "react";

import { analyzeSave } from "./save/analyze";
import type { DecodedSave } from "./save/types";
import { Hero, PageFooter, Topbar } from "./ui/page-chrome";
import { SaveReport } from "./ui/save-report";
import { SaveReader } from "./ui/save-reader";
import {
  StatusBanner,
  type StatusKind,
} from "./ui/status-banner";

const MAX_SAVE_BYTES = 64 * 1024 * 1024;

interface OpenedSave {
  decoded: DecodedSave;
  file: File;
  id: number;
}

interface AppStatus {
  kind: StatusKind;
  message: string;
}

export function App() {
  const requestId = useRef(0);
  const [openedSave, setOpenedSave] = useState<OpenedSave | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);

  const showStatus = useCallback(
    (message: string, kind: StatusKind): void => {
      setStatus({ kind, message });
    },
    [],
  );

  const inspectFile = useCallback(
    async (file: File): Promise<void> => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setOpenedSave(null);

      if (file.size > MAX_SAVE_BYTES) {
        showStatus(
          "That file is larger than the 64 MiB safety limit.",
          "error",
        );
        return;
      }

      showStatus(`Opening ${file.name}…`, "loading");
      try {
        const { decodeSave } = await import("./save/decode");
        const decoded = await decodeSave(await file.arrayBuffer());
        if (requestId.current !== currentRequest) {
          return;
        }
        setOpenedSave({
          decoded,
          file,
          id: currentRequest,
        });
        showStatus("Save opened successfully.", "ready");
      } catch (error) {
        if (requestId.current !== currentRequest) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown error.";
        showStatus(message, "error");
      }
    },
    [showStatus],
  );

  return (
    <>
      <Topbar />
      <main className="shell">
        <Hero />
        <SaveReader onFile={(file) => void inspectFile(file)} />

        {status ? (
          <StatusBanner kind={status.kind} message={status.message} />
        ) : null}

        {openedSave ? (
          <SaveReport
            key={openedSave.id}
            decoded={openedSave.decoded}
            file={openedSave.file}
            report={analyzeSave(openedSave.decoded.data)}
            onStatus={showStatus}
          />
        ) : null}

        <PageFooter />
      </main>
    </>
  );
}
