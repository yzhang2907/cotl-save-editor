import { useCallback, useRef, useState } from "react";

import { analyzeSave } from "./save/analyze";
import type { DecodedSave } from "./save/types";
import {
  ActionToast,
  type ToastKind,
} from "./ui/action-toast";
import { Hero, PageFooter, Topbar } from "./ui/page-chrome";
import { SaveReport } from "./ui/save-report";
import { SaveReader } from "./ui/save-reader";

const MAX_SAVE_BYTES = 64 * 1024 * 1024;
const FILE_LOADING_DELAY_MS = 400;

interface OpenedSave {
  decoded: DecodedSave;
  file: File;
  id: number;
}

interface AppToast {
  id: number;
  kind: ToastKind;
  message: string;
}

export function App() {
  const requestId = useRef(0);
  const toastId = useRef(0);
  const [openedSave, setOpenedSave] = useState<OpenedSave | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);

  const showToast = useCallback(
    (message: string, kind: ToastKind): void => {
      const id = toastId.current + 1;
      toastId.current = id;
      setToast({ id, kind, message });
    },
    [],
  );

  const dismissToast = useCallback((id: number): void => {
    setToast((current) => (current?.id === id ? null : current));
  }, []);

  const inspectFile = useCallback(
    async (file: File): Promise<void> => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setToast(null);

      if (file.size > MAX_SAVE_BYTES) {
        showToast(
          "That file is larger than the 64 MiB safety limit.",
          "error",
        );
        return;
      }

      const loadingTimer = window.setTimeout(() => {
        if (requestId.current === currentRequest) {
          showToast(`Opening ${file.name}…`, "loading");
        }
      }, FILE_LOADING_DELAY_MS);

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
        showToast(`Opened ${file.name}.`, "ready");
      } catch (error) {
        if (requestId.current !== currentRequest) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown error.";
        showToast(message, "error");
      } finally {
        window.clearTimeout(loadingTimer);
      }
    },
    [showToast],
  );

  return (
    <>
      <Topbar />
      <main className="shell">
        <Hero />
        <SaveReader onFile={(file) => void inspectFile(file)} />

        {openedSave ? (
          <SaveReport
            key={openedSave.id}
            decoded={openedSave.decoded}
            file={openedSave.file}
            report={analyzeSave(openedSave.decoded.data)}
            onNotice={showToast}
          />
        ) : null}

        <PageFooter />
      </main>
      {toast ? (
        <ActionToast
          id={toast.id}
          key={toast.id}
          kind={toast.kind}
          message={toast.message}
          onDismiss={dismissToast}
        />
      ) : null}
    </>
  );
}
