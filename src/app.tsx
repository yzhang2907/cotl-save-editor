import { useCallback, useEffect, useRef, useState } from "react";

import { analyzeSave } from "./save/analyze";
import { emptyCultEdits, type CultEdits } from "./save/cult-edits";
import type { AppliedDoctrineChange } from "./save/doctrine-workspace";
import { MAX_SAVE_BYTES, MAX_SAVE_MEBIBYTES } from "./save/limits";
import {
  clearCachedSession,
  readCachedSession,
  writeCachedSession,
} from "./save/session-cache";
import type { DecodedSave } from "./save/types";
import { ActionToast, type ToastKind } from "./ui/action-toast";
import { errorMessage } from "./ui/error-message";
import { Hero, PageFooter, Topbar } from "./ui/page-chrome";
import { SaveReport } from "./ui/save-report";
import { SaveReader } from "./ui/save-reader";

const FILE_LOADING_DELAY_MS = 400;

interface OpenedSave {
  bytes: ArrayBuffer;
  decoded: DecodedSave;
  file: File;
  id: number;
  restoredCultEdits: CultEdits;
  restoredDoctrineHistory: AppliedDoctrineChange[];
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
  // Read by the cache writer, which must stay referentially stable.
  const openedSaveRef = useRef<OpenedSave | null>(null);
  openedSaveRef.current = openedSave;

  const showToast = useCallback((message: string, kind: ToastKind): void => {
    const id = toastId.current + 1;
    toastId.current = id;
    setToast({ id, kind, message });
  }, []);

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
          `That file is larger than the ${MAX_SAVE_MEBIBYTES} MiB safety limit.`,
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
        const bytes = await file.arrayBuffer();
        const decoded = await decodeSave(bytes);
        if (requestId.current !== currentRequest) {
          return;
        }
        setOpenedSave({
          bytes,
          decoded,
          file,
          id: currentRequest,
          restoredCultEdits: emptyCultEdits(),
          restoredDoctrineHistory: [],
        });
        showToast(`Opened ${file.name}.`, "ready");
      } catch (error) {
        if (requestId.current !== currentRequest) {
          return;
        }
        showToast(errorMessage(error), "error");
      } finally {
        window.clearTimeout(loadingTimer);
      }
    },
    [showToast],
  );

  /*
   * Persisting the bytes rather than a file handle is deliberate: the save
   * can be moved or deleted on disk between the edit and the refresh, and a
   * restored session still has to work.
   */
  const removeSave = useCallback((): void => {
    const opened = openedSaveRef.current;
    if (opened === null) {
      return;
    }
    requestId.current += 1;
    setOpenedSave(null);
    void clearCachedSession();
    showToast(`Removed ${opened.file.name}.`, "ready");
  }, [showToast]);

  const rememberEdits = useCallback(
    (edits: {
      cultEdits: CultEdits;
      doctrineHistory: AppliedDoctrineChange[];
    }): void => {
      const opened = openedSaveRef.current;
      if (opened === null) {
        return;
      }
      void writeCachedSession({
        bytes: opened.bytes,
        cultEdits: edits.cultEdits,
        doctrineHistory: edits.doctrineHistory,
        fileName: opened.file.name,
        lastModified: opened.file.lastModified,
        savedAt: Date.now(),
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await readCachedSession();
      // Anything the user opened while the cache was being read wins.
      if (session === null || cancelled || requestId.current !== 0) {
        return;
      }
      try {
        const { decodeSave } = await import("./save/decode");
        const decoded = await decodeSave(session.bytes);
        if (cancelled || requestId.current !== 0) {
          return;
        }
        const id = requestId.current + 1;
        requestId.current = id;
        setOpenedSave({
          bytes: session.bytes,
          decoded,
          file: new File([session.bytes], session.fileName, {
            lastModified: session.lastModified,
          }),
          id,
          restoredCultEdits: session.cultEdits,
          restoredDoctrineHistory: session.doctrineHistory,
        });
        showToast(
          `Restored your last session with ${session.fileName}.`,
          "ready",
        );
      } catch {
        // A save the current build can no longer decode is not worth
        // keeping around to fail again on the next refresh.
        void clearCachedSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return (
    <>
      <Topbar />
      <main className="shell">
        <Hero />
        <SaveReader
          loadedFileName={openedSave?.file.name ?? null}
          onFile={(file) => void inspectFile(file)}
          onRemove={removeSave}
          saveId={openedSave?.id ?? null}
        />

        {openedSave ? (
          <SaveReport
            key={openedSave.id}
            decoded={openedSave.decoded}
            file={openedSave.file}
            onEditsChange={rememberEdits}
            report={analyzeSave(openedSave.decoded.data)}
            onNotice={showToast}
            restoredCultEdits={openedSave.restoredCultEdits}
            restoredDoctrineHistory={openedSave.restoredDoctrineHistory}
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
