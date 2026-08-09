import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { dlcDefinition, type DlcKey } from "../save/dlc";
import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import { editedSaveFileName } from "../save/file-names";
import type { MessagePackSource, SaveRecord } from "../save/types";
import type { ToastKind } from "./action-toast";
import {
  EDITED_SAVE_REVIEW_LABEL,
  EDITED_SAVE_STEP_TITLE,
  EDITED_SAVE_SUBSECTION_TITLE,
  NO_EDITED_SAVE_CHANGES_LABEL,
} from "./copy";
import { doctrineChangeLabel } from "./doctrine-change-label";
import { downloadLocalFile } from "./local-download";
import { StepHeader } from "./step-header";

interface EditedSaveDownloadProps {
  changes: PendingDoctrineChange[];
  children?: ReactNode;
  fileName: string;
  onNotice: (message: string, kind: ToastKind) => void;
  original: SaveRecord;
  source: MessagePackSource;
  working: SaveRecord;
}

export function EditedSaveDownload({
  changes,
  children,
  fileName,
  onNotice,
  original,
  source,
  working,
}: EditedSaveDownloadProps) {
  const requestId = useRef(0);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmedDlcs, setConfirmedDlcs] = useState<
    Partial<Record<DlcKey, boolean>>
  >({});
  const [failure, setFailure] = useState<string | null>(null);
  const [gameClosed, setGameClosed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const hasChanges = changes.length > 0;
  const outputName = editedSaveFileName(fileName);
  const requiredDlcKeys = [
    ...new Set(
      changes.flatMap((change) =>
        change.requiredDlc === null ? [] : [change.requiredDlc],
      ),
    ),
  ];
  const confirmationsComplete =
    backupConfirmed &&
    gameClosed &&
    requiredDlcKeys.every((key) => confirmedDlcs[key] === true);

  useEffect(() => {
    requestId.current += 1;
    setBackupConfirmed(false);
    setBusy(false);
    setConfirmedDlcs({});
    setFailure(null);
    setGameClosed(false);
    setReviewOpen(false);
  }, [original, source, working]);

  useEffect(() => {
    if (!reviewOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape" && !busy) {
        setReviewOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, reviewOpen]);

  function closeReview(): void {
    if (!busy) {
      setReviewOpen(false);
    }
  }

  async function verifyAndDownload(): Promise<void> {
    if (!confirmationsComplete || busy) {
      onNotice(
        "Tick every box before downloading.",
        "error",
      );
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setBusy(true);
    setFailure(null);
    onNotice("Checking the edited save…", "loading");

    try {
      const { encodeVerifiedModifiedCurrentSave } = await import(
        "../save/current-save"
      );
      const encoded = await encodeVerifiedModifiedCurrentSave(
        source,
        original,
        working,
      );
      if (requestId.current !== currentRequest) {
        return;
      }

      downloadLocalFile(encoded, outputName);
      setReviewOpen(false);
      onNotice(`Downloaded ${outputName}.`, "ready");
    } catch (error) {
      if (requestId.current !== currentRequest) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      setFailure(message);
      onNotice(`The download was stopped: ${message}`, "error");
    } finally {
      if (requestId.current === currentRequest) {
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="report modified-save-check"
      aria-labelledby="edited-save-step-title"
    >
      <StepHeader
        description="Review the changes, then download the edited save."
        eyebrow="Edited save download"
        step="III"
        title={EDITED_SAVE_STEP_TITLE}
        titleId="edited-save-step-title"
      />

      <div className="edited-save-download-intro">
        <div>
          <h3>{EDITED_SAVE_SUBSECTION_TITLE}</h3>
          <p>
            The rebuilt save is checked against the original before the
            download starts.
          </p>
        </div>
        <button
          className="edited-save-review-button"
          disabled={!hasChanges}
          onClick={() => {
            setFailure(null);
            setReviewOpen(true);
          }}
          type="button"
        >
          {hasChanges
            ? EDITED_SAVE_REVIEW_LABEL
            : NO_EDITED_SAVE_CHANGES_LABEL}
        </button>
      </div>

      <section
        className="edited-save-install"
        aria-labelledby="edited-save-install-title"
      >
        <h4 id="edited-save-install-title">Install the edited file</h4>
        <ol>
          <li>Close the game completely.</li>
          <li>Locate the game’s <code>saves</code> directory.</li>
          <li>Copy the whole directory somewhere safe as a backup.</li>
          <li>
            Move <code>{outputName}</code> into the <code>saves</code>{" "}
            directory and rename it to <code>{fileName}</code>.
          </li>
          <li>
            Replace only that slot file. Leave its matching metadata file
            unchanged.
          </li>
          <li>Start the game and load that slot.</li>
          <li>Save in the game, then reload the slot once.</li>
        </ol>
      </section>

      <details className="edited-save-recovery" open={failure !== null}>
        <summary>If the edited save does not work</summary>
        <div>
          <p>
            <strong>Stopped by this editor:</strong> no download was started
            and your original file was untouched. Review the reported error
            and retry with one staged change if you need to isolate it.
          </p>
          <p>
            <strong>Rejected by the game:</strong> close the game without
            saving, then restore the slot and its matching metadata file from
            your full-folder backup. If Steam reports a conflict, keep the
            restored local files.
          </p>
        </div>
      </details>

      {children}

      {reviewOpen ? (
        <div
          className="edited-save-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReview();
            }
          }}
        >
          <section
            aria-describedby="edited-save-review-description"
            aria-labelledby="edited-save-review-title"
            aria-modal="true"
            className="edited-save-modal"
            role="dialog"
          >
            <header>
              <div>
                <p className="section-label">Edited save download</p>
                <h3 id="edited-save-review-title">
                  Review before downloading
                </h3>
              </div>
              <button
                aria-label="Close download review"
                autoFocus
                className="edited-save-modal-close"
                disabled={busy}
                onClick={closeReview}
                type="button"
              >
                <X aria-hidden="true" size={22} strokeWidth={4} />
              </button>
            </header>

            <p id="edited-save-review-description">
              The editor rebuilds the save with these changes, reopens it,
              and confirms that every other position is byte-for-byte
              unchanged.
            </p>

            <section
              className="final-doctrine-changes"
              aria-labelledby="final-doctrine-changes-title"
            >
              <h4 id="final-doctrine-changes-title">Final changes</h4>
              <ol>
                {changes.map((change) => (
                  <li
                    key={`${change.categoryName}-${change.rank}-${change.toDoctrineId}`}
                  >
                    <span>
                      {change.categoryName} · Rank {change.rank}
                    </span>
                    <strong>{doctrineChangeLabel(change)}</strong>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="edited-save-safety"
              aria-labelledby="edited-save-safety-title"
            >
              <h4 id="edited-save-safety-title">Before downloading</h4>
              <p className="steam-cloud-warning">
                Steam Cloud can overwrite your local replacement or restore
                an older file. Resolve any conflict in favor of the copy you
                intend to keep.
              </p>
              <label>
                <input
                  checked={backupConfirmed}
                  onChange={(event) =>
                    setBackupConfirmed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>
                  I backed up the entire Cult of the Lamb save folder.
                </span>
              </label>
              <label>
                <input
                  checked={gameClosed}
                  onChange={(event) =>
                    setGameClosed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>The game is completely closed.</span>
              </label>
              {requiredDlcKeys.map((key) => {
                const definition = dlcDefinition(key);
                return (
                  <label key={key}>
                    <input
                      checked={confirmedDlcs[key] === true}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setConfirmedDlcs((current) => ({
                          ...current,
                          [key]: checked,
                        }));
                      }}
                      type="checkbox"
                    />
                    <span>
                      {definition.displayName} is installed; this edited save
                      requires it.
                    </span>
                  </label>
                );
              })}
            </section>

            {failure !== null ? (
              <p className="edited-save-modal-error" role="alert">
                Verification or download stopped: {failure}. Your original
                save was not changed.
              </p>
            ) : null}

            <footer className="edited-save-modal-actions">
              <button
                className="edited-save-modal-cancel"
                disabled={busy}
                onClick={closeReview}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-busy={busy}
                className="edited-save-modal-download"
                disabled={!confirmationsComplete || busy}
                onClick={() => void verifyAndDownload()}
                type="button"
              >
                {busy
                  ? "Verifying…"
                  : `Verify and download ${outputName}`}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
