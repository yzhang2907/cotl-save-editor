import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  FollowerAppearance,
  FollowerOverview,
} from "../save/overview";
import { displayPercent } from "./overview-format";
import { OverviewSection } from "./overview-section";
import "./followers-section.css";

function appearanceSummary(appearance: FollowerAppearance): string {
  if (appearance.skinName === null) {
    return "Unknown skin";
  }
  const variation =
    appearance.skinVariation === null || appearance.skinVariation === 0
      ? ""
      : `, variation ${appearance.skinVariation + 1}`;
  const colour =
    appearance.colour === null || appearance.colour === 0
      ? ""
      : `, colour ${appearance.colour}`;
  return `${appearance.skinName}${variation}${colour}`;
}

function wornItems(appearance: FollowerAppearance): string[] {
  const items: string[] = [];
  // Outfit names like "Old" or "Follower" read as nonsense without
  // their category.
  if (appearance.outfit !== null) {
    items.push(`${appearance.outfit} (Outfit)`);
  }
  if (appearance.clothing !== null) {
    items.push(appearance.clothing);
  }
  if (appearance.hat !== null) {
    items.push(appearance.hat);
  }
  if (appearance.necklace !== null) {
    items.push(
      appearance.necklaceHidden
        ? `${appearance.necklace} (hidden)`
        : appearance.necklace,
    );
  }
  return items;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (value === null) {
    return null;
  }
  return (
    <div className="follower-detail-row">
      <span className="follower-detail-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function FollowerDetail({ follower }: { follower: FollowerOverview }) {
  const worn = wornItems(follower.appearance);
  return (
    <div className="follower-detail">
      <DetailRow
        label="Appearance"
        value={appearanceSummary(follower.appearance)}
      />
      <DetailRow
        label="Wearing"
        value={worn.length > 0 ? worn.join(", ") : "Nothing"}
      />
      <DetailRow
        label="Traits"
        value={follower.traits.length > 0 ? follower.traits.join(", ") : null}
      />
      <DetailRow label="Role" value={follower.role} />
      <DetailRow label="Former faction" value={follower.faction} />
      <DetailRow
        label="Faith"
        value={
          follower.faith === null ? null : displayPercent(follower.faith)
        }
      />
      <DetailRow
        label="Adoration"
        value={
          follower.adoration === null ? null : `${follower.adoration}`
        }
      />
      <DetailRow
        label="Joined"
        value={
          follower.dayJoined === null
            ? null
            : `Day ${follower.dayJoined}${follower.bornInCult ? ", born in the cult" : ""}`
        }
      />
      <DetailRow
        label="Life expectancy"
        value={
          follower.lifeExpectancy === null
            ? null
            : `${follower.lifeExpectancy} days`
        }
      />
      <DetailRow label="Spouse" value={follower.spouse} />
      <DetailRow
        label="Parents"
        value={
          follower.parents.length > 0 ? follower.parents.join(" and ") : null
        }
      />
      <DetailRow label="State of mind" value={follower.stateThought} />
      {follower.death === null ? null : (
        <>
          <DetailRow
            label="Cause of death"
            value={follower.death.cause ?? "Ritual"}
          />
          <DetailRow
            label="Died"
            value={
              follower.death.day === null
                ? null
                : `Day ${follower.death.day}`
            }
          />
          <DetailRow label="Murdered by" value={follower.death.murderedBy} />
          <DetailRow
            label="Remains"
            value={
              follower.death.buried
                ? follower.death.funeral
                  ? "Buried with a funeral"
                  : "Buried without a funeral"
                : "Not buried"
            }
          />
        </>
      )}
    </div>
  );
}

function FollowerRow({ follower }: { follower: FollowerOverview }) {
  return (
    <details className="follower-entry">
      <summary className="follower-row">
        <div className="follower-name">
          <strong>{follower.name}</strong>
        </div>
        <span>{follower.id === null ? "—" : follower.id}</span>
        <span>{follower.level === null ? "—" : `Lv ${follower.level}`}</span>
        <span>{follower.age === null ? "—" : `${follower.age} days`}</span>
        <span>{displayPercent(follower.happiness)}</span>
        <span>{displayPercent(follower.satiation)}</span>
        <span>
          {follower.death === null
            ? follower.statuses.join(", ")
            : (follower.death.cause ?? "Ritual")}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="follower-chevron"
          size={15}
          strokeWidth={3}
        />
      </summary>
      <FollowerDetail follower={follower} />
    </details>
  );
}

type SortValue = number | string | null;

const SORT_COLUMNS: ReadonlyArray<{
  label: string;
  value: (follower: FollowerOverview) => SortValue;
}> = [
  { label: "Name", value: (follower) => follower.name.toLowerCase() },
  { label: "ID", value: (follower) => follower.id },
  { label: "Level", value: (follower) => follower.level },
  { label: "Age", value: (follower) => follower.age },
  { label: "Happy", value: (follower) => follower.happiness },
  { label: "Fed", value: (follower) => follower.satiation },
];

function stateValue(follower: FollowerOverview): SortValue {
  return follower.death === null
    ? follower.statuses.join(", ")
    : (follower.death.cause ?? "Ritual");
}

function compareValues(left: SortValue, right: SortValue): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  if (typeof left === "string" || typeof right === "string") {
    return String(left).localeCompare(String(right));
  }
  return left - right;
}

interface SortOrder {
  column: number;
  descending: boolean;
}

function FollowerList({
  dead,
  followers,
}: {
  dead: boolean;
  followers: FollowerOverview[];
}) {
  const [order, setOrder] = useState<SortOrder | null>(null);
  const columns = useMemo(
    () => [
      ...SORT_COLUMNS,
      { label: dead ? "Death" : "State", value: stateValue },
    ],
    [dead],
  );
  const sorted = useMemo(() => {
    if (order === null) {
      return followers;
    }
    const value = columns[order.column]?.value;
    if (value === undefined) {
      return followers;
    }
    const sign = order.descending ? -1 : 1;
    return followers
      .slice()
      .sort(
        (left, right) => sign * compareValues(value(left), value(right)),
      );
  }, [columns, followers, order]);

  function toggleOrder(column: number) {
    setOrder((previous) =>
      previous?.column === column
        ? previous.descending
          ? null
          : { column, descending: true }
        : { column, descending: false },
    );
  }

  return (
    <div className="follower-list">
      <div className="follower-row follower-labels">
        {columns.map((column, index) => (
          <button
            key={column.label}
            onClick={() => toggleOrder(index)}
            type="button"
          >
            {column.label}
            {order?.column === index ? (
              order.descending ? (
                <ArrowDownWideNarrow
                  aria-hidden="true"
                  size={12}
                  strokeWidth={3}
                />
              ) : (
                <ArrowUpNarrowWide
                  aria-hidden="true"
                  size={12}
                  strokeWidth={3}
                />
              )
            ) : null}
          </button>
        ))}
      </div>
      {sorted.map((follower, index) => (
        <FollowerRow
          follower={follower}
          key={follower.id ?? `${follower.name}-${index}`}
        />
      ))}
    </div>
  );
}

interface FollowersSectionProps {
  count: number;
  deadFollowers: FollowerOverview[];
  followers: FollowerOverview[];
}

export function FollowersSection({
  count,
  deadFollowers,
  followers,
}: FollowersSectionProps) {
  return (
    <OverviewSection count={`${count} living`} readOnly title="Followers">
      {followers.length === 0 ? (
        <p className="empty-overview">No living follower records were found.</p>
      ) : (
        <FollowerList dead={false} followers={followers} />
      )}
      {deadFollowers.length === 0 ? null : (
        <details className="follower-subsection">
          <summary>
            <strong>Dead followers</strong>
            <span>{deadFollowers.length} dead</span>
            <ChevronRight
              aria-hidden="true"
              className="follower-chevron"
              size={17}
              strokeWidth={3}
            />
          </summary>
          <FollowerList dead followers={deadFollowers} />
        </details>
      )}
    </OverviewSection>
  );
}
