import type { FollowerOverview } from "../save/overview";
import { displayPercent } from "./overview-format";
import { OverviewSection } from "./overview-section";
import "./followers-section.css";

function FollowerRow({ follower }: { follower: FollowerOverview }) {
  return (
    <div className="follower-row">
      <div className="follower-name">
        <strong>{follower.name}</strong>
        {follower.id === null ? null : <small>ID {follower.id}</small>}
      </div>
      <span>{follower.level === null ? "—" : `Lv ${follower.level}`}</span>
      <span>{follower.age === null ? "—" : `${follower.age} days`}</span>
      <span>{displayPercent(follower.happiness)}</span>
      <span>{displayPercent(follower.satiation)}</span>
      <div className="follower-statuses">
        {follower.statuses.map((status) => (
          <span key={status}>{status}</span>
        ))}
      </div>
    </div>
  );
}

interface FollowersSectionProps {
  count: number;
  followers: FollowerOverview[];
}

export function FollowersSection({
  count,
  followers,
}: FollowersSectionProps) {
  return (
    <OverviewSection
      count={`${count} living`}
      readOnly
      title="Followers"
    >
      {followers.length === 0 ? (
        <p className="empty-overview">No living follower records were found.</p>
      ) : (
        <div className="follower-list">
          <div className="follower-row follower-labels">
            {["Follower", "Level", "Age", "Happy", "Fed", "State"].map(
              (label) => (
                <span key={label}>{label}</span>
              ),
            )}
          </div>
          {followers.map((follower, index) => (
            <FollowerRow
              follower={follower}
              key={follower.id ?? `${follower.name}-${index}`}
            />
          ))}
        </div>
      )}
    </OverviewSection>
  );
}
