import type { NamedId } from "../save/overview";
import { OverviewSection } from "./overview-section";

interface NamedIdListProps {
  entries: NamedId[];
  titlePrefix: string;
}

function NamedIdList({ entries, titlePrefix }: NamedIdListProps) {
  return (
    <div className="named-id-list">
      {entries.map((entry) => (
        <span title={`${titlePrefix} ${entry.id}`} key={entry.id}>
          {entry.name}
        </span>
      ))}
    </div>
  );
}

interface RitualsSectionProps {
  rituals: NamedId[];
  sermonsAndRites: NamedId[];
}

export function RitualsSection({
  rituals,
  sermonsAndRites,
}: RitualsSectionProps) {
  const count = rituals.length + sermonsAndRites.length;
  return (
    <OverviewSection title="Rituals and sermons" count={`${count} found`}>
      {count === 0 ? (
        <p className="empty-overview">
          No ritual or sermon unlocks were found.
        </p>
      ) : (
        <>
          {rituals.length > 0 ? (
            <>
              <h4 className="overview-subheading first">Cult rituals</h4>
              <NamedIdList entries={rituals} titlePrefix="Upgrade ID" />
            </>
          ) : null}
          {sermonsAndRites.length > 0 ? (
            <>
              <h4 className="overview-subheading">Sermons and rites</h4>
              <NamedIdList
                entries={sermonsAndRites}
                titlePrefix="Sermon or rite ID"
              />
            </>
          ) : null}
        </>
      )}
    </OverviewSection>
  );
}
