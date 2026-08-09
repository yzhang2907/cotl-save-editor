import { Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import type { ResourceOverview } from "../save/overview";
import resourceIconDefinitions from "../save/resource-icons.json";
import { displayNumber } from "./overview-format";
import { OverviewSection } from "./overview-section";

const iconIds = new Set(
  resourceIconDefinitions.map((definition) => definition.id),
);

export interface ResourceEditRequest {
  quantity: number;
  reserved: number;
  type: number;
}

interface ResourceRowProps {
  edited: boolean;
  onDiscardEdit: ((type: number) => void) | null;
  onEdit: ((edit: ResourceEditRequest) => boolean) | null;
  resource: ResourceOverview;
}

function ResourceIcon({ id }: { id: number }) {
  const known = iconIds.has(id);
  return (
    <img
      className={`resource-icon${known ? "" : " resource-icon-fallback"}`}
      src={`${import.meta.env.BASE_URL}resource-icons/${known ? id : "unknown"}.webp`}
      alt=""
      loading="lazy"
      width="52"
      height="52"
    />
  );
}

function ResourceRow({
  edited,
  onDiscardEdit,
  onEdit,
  resource,
}: ResourceRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (onEdit === null) {
      return;
    }
    const quantity = Number(draft);
    const staged = onEdit({
      quantity,
      // Reserved amounts are staged untouched, only clamped down so a
      // smaller quantity never strands a larger reservation.
      reserved: Math.min(resource.reserved, quantity),
      type: resource.id,
    });
    if (staged) {
      setEditing(false);
    }
  }

  return (
    <div
      className={`resource-row${resource.known ? "" : " unknown"}${edited ? " edited" : ""}`}
    >
      <div className="resource-identity">
        <ResourceIcon id={resource.id} />
        <div>
          <strong>{resource.name}</strong>
          <small>
            Item {resource.id}
            {edited ? " · edited" : ""}
          </small>
        </div>
      </div>
      {editing && onEdit !== null ? (
        <form className="resource-quantity-form" onSubmit={submit}>
          <input
            aria-label={`${resource.name} quantity`}
            autoFocus
            inputMode="numeric"
            min={0}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false);
              }
            }}
            type="number"
            value={draft}
          />
          <button
            aria-label={`Stage the ${resource.name} edit`}
            className="resource-edit-confirm"
            title="Stage this edit"
            type="submit"
          >
            <Check aria-hidden="true" size={16} strokeWidth={4} />
          </button>
          <button
            aria-label={`Stop editing ${resource.name}`}
            className="resource-edit-cancel"
            onClick={() => setEditing(false)}
            title="Cancel"
            type="button"
          >
            <X aria-hidden="true" size={16} strokeWidth={4} />
          </button>
        </form>
      ) : (
        <>
          <div className="resource-quantity">
            <strong>{displayNumber(resource.quantity)}</strong>
            {resource.reserved > 0 ? (
              <small>{displayNumber(resource.reserved)} reserved</small>
            ) : null}
          </div>
          {onEdit !== null ? (
            <div className="resource-edit">
              {edited && onDiscardEdit !== null ? (
                <button
                  aria-label={`Discard the ${resource.name} edit`}
                  className="resource-edit-discard"
                  onClick={() => onDiscardEdit(resource.id)}
                  title="Discard this edit"
                  type="button"
                >
                  <X aria-hidden="true" size={16} strokeWidth={4} />
                </button>
              ) : null}
              <button
                aria-label={`Edit ${resource.name}`}
                className="resource-edit-toggle"
                onClick={() => {
                  setDraft(String(resource.quantity));
                  setEditing(true);
                }}
                title={`Edit ${resource.name}`}
                type="button"
              >
                <Pencil aria-hidden="true" size={16} strokeWidth={3} />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface AddableItem {
  id: number;
  lockedReason?: string | null;
  name: string;
  unobtainable?: boolean;
}

function AddItemOption({
  item,
  onSelect,
  selected,
}: {
  item: AddableItem;
  onSelect: (id: number) => void;
  selected: boolean;
}) {
  const locked =
    item.lockedReason !== undefined && item.lockedReason !== null;
  return (
    <button
      aria-label={`${item.name} (Item ${item.id})`}
      aria-pressed={selected}
      className="resource-add-option"
      disabled={locked}
      onClick={() => onSelect(item.id)}
      type="button"
    >
      <ResourceIcon id={item.id} />
      <span>
        <strong>{item.name}</strong>
        <small>
          Item {item.id}
          {locked ? ` · ${item.lockedReason}` : ""}
        </small>
      </span>
    </button>
  );
}

function AddItemModal({
  addableItems,
  onAdd,
  onClose,
}: {
  addableItems: AddableItem[];
  onAdd: (edit: ResourceEditRequest) => boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const needle = query.trim().toLowerCase();
  const matches = addableItems.filter(
    (item) =>
      needle === "" ||
      item.name.toLowerCase().includes(needle) ||
      String(item.id) === needle,
  );
  const selected =
    addableItems.find((item) => item.id === selectedId) ?? null;

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (selected === null) {
      return;
    }
    const staged = onAdd({
      quantity: Number(quantity),
      reserved: 0,
      type: selected.id,
    });
    if (staged) {
      onClose();
    }
  }

  return createPortal(
    <div
      className="edited-save-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="add-item-title"
        aria-modal="true"
        className="edited-save-modal resource-add-modal"
        role="dialog"
      >
        <header>
          <div>
            <p className="section-label">Resources</p>
            <h3 id="add-item-title">Add an item</h3>
          </div>
          <button
            aria-label="Close the item picker"
            className="edited-save-modal-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={22} strokeWidth={4} />
          </button>
        </header>

        <form onSubmit={submit}>
          <input
            aria-label="Search the item catalog"
            autoFocus
            className="resource-add-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search by name or item number…"
            type="search"
            value={query}
          />
          {matches.length === 0 ? (
            <p className="empty-overview">
              No addable catalog items match “{query}”.
            </p>
          ) : (
            <div className="resource-add-results">
              {matches.some((item) => item.unobtainable !== true) ? (
                <div className="resource-add-list">
                  {matches
                    .filter((item) => item.unobtainable !== true)
                    .map((item) => (
                      <AddItemOption
                        item={item}
                        key={item.id}
                        onSelect={setSelectedId}
                        selected={item.id === selectedId}
                      />
                    ))}
                </div>
              ) : null}
              {matches.some((item) => item.unobtainable === true) ? (
                <section
                  aria-labelledby="unobtainable-items-title"
                  className="resource-add-unobtainable"
                >
                  <h4 id="unobtainable-items-title">
                    Unobtainable items
                  </h4>
                  <p>
                    The game defines these but never places them in the
                    inventory: cut content, or things it tracks
                    elsewhere. Adding one likely does nothing in-game.
                  </p>
                  <div className="resource-add-list">
                    {matches
                      .filter((item) => item.unobtainable === true)
                      .map((item) => (
                        <AddItemOption
                          item={item}
                          key={item.id}
                          onSelect={setSelectedId}
                          selected={item.id === selectedId}
                        />
                      ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
          <label className="resource-add-quantity">
            <span>Quantity</span>
            <input
              inputMode="numeric"
              min={0}
              onChange={(event) => setQuantity(event.currentTarget.value)}
              type="number"
              value={quantity}
            />
          </label>
          <footer className="edited-save-modal-actions">
            <button
              className="resource-add-cancel"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="resource-add-stage"
              disabled={selected === null}
              type="submit"
            >
              {selected === null
                ? "Select an item to add"
                : `Add ${selected.name}`}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

interface ResourcesSectionProps {
  addableItems?: AddableItem[];
  count: number;
  editedTypes?: ReadonlySet<number>;
  onAdd?: (edit: ResourceEditRequest) => boolean;
  onDiscardEdit?: (type: number) => void;
  onEdit?: (edit: ResourceEditRequest) => boolean;
  resources: ResourceOverview[];
}

export function ResourcesSection({
  addableItems,
  count,
  editedTypes,
  onAdd,
  onDiscardEdit,
  onEdit,
  resources,
}: ResourcesSectionProps) {
  const [adding, setAdding] = useState(false);
  const canAdd =
    onAdd !== undefined &&
    addableItems !== undefined &&
    addableItems.length > 0;

  return (
    <OverviewSection
      count={`${count} item types`}
      readOnly={onEdit === undefined}
      title="Resources"
    >
      {resources.length === 0 ? (
        <p className="empty-overview">No inventory records were found.</p>
      ) : (
        <div className="resource-grid">
          {resources.map((resource) => (
            <ResourceRow
              edited={editedTypes?.has(resource.id) === true}
              key={resource.id}
              onDiscardEdit={onDiscardEdit ?? null}
              onEdit={onEdit ?? null}
              resource={resource}
            />
          ))}
        </div>
      )}
      {canAdd ? (
        <div className="resource-add-row">
          <button
            className="resource-add-button"
            onClick={() => setAdding(true)}
            type="button"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={4} />
            Add an item
          </button>
        </div>
      ) : null}
      {adding && canAdd ? (
        <AddItemModal
          addableItems={addableItems}
          onAdd={onAdd}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </OverviewSection>
  );
}
