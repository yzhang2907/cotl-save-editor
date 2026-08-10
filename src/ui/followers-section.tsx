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
  if (appearance.outfit !== null) {
    items.push(appearance.outfit);
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
            value={follower.death.cause ?? "Unknown"}
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
          {follower.id === null ? null : <small>ID {follower.id}</small>}
        </div>
        <span>{follower.level === null ? "—" : `Lv ${follower.level}`}</span>
        <span>{follower.age === null ? "—" : `${follower.age} days`}</span>
        <span>{displayPercent(follower.happiness)}</span>
        <span>{displayPercent(follower.satiation)}</span>
        <div className="follower-statuses">
          {(follower.death === null
            ? follower.statuses
            : [follower.death.cause ?? "Dead"]
          ).map((status) => (
            <span key={status}>{status}</span>
          ))}
        </div>
      </summary>
      <FollowerDetail follower={follower} />
    </details>
  );
}

function FollowerList({
  dead,
  followers,
}: {
  dead: boolean;
  followers: FollowerOverview[];
}) {
  return (
    <div className="follower-list">
      <div className="follower-row follower-labels">
        {[
          "Follower",
          "Level",
          "Age",
          "Happy",
          "Fed",
          dead ? "Death" : "State",
        ].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {followers.map((follower, index) => (
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
      <p className="follower-hint">
        Click a follower to see their full record.
      </p>
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
          </summary>
          <FollowerList dead followers={deadFollowers} />
        </details>
      )}
    </OverviewSection>
  );
}
