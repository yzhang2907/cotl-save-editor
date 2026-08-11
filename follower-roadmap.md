# Follower data roadmap

Based on the decoder key map in `lamb-mp-decoder` and a real save
(`slot_0.mp`: 17 living followers, 39 dead).

## What we know

**The follower record layout is fully mapped.** Every follower is a
192-field record (`slot_mp_keys[1109]` in `lamb-mp-decoder` names every
index). The living, dead, recruit, possessed, and dissented lists all
share this layout. Thus no list needs its own reader.

**Appearance is stored directly in the save.** Each record has the
skin name as a literal string (`Fish`, `Red Panda3`), plus numeric
fields for skin variation and colour, hat, outfit, clothing, necklace,
and overlays like curses and snowman state. Describing a follower in
text ("Red Panda, variation 3, colour 22, Bishop robes, no hat") needs
no reverse engineering. To draw an actual portrait, we must extract
layered, tinted sprites from the game files. This is possible (we
already extract icons with UnityPy) but is real work. Name plus colour
swatch plus labelled parts is the cheap version.

**The missing piece was the lookup tables** for trait, role, hat,
outfit, and similar ids. Item 1 below solved this. It reads the tables
out of the game's code and localization files.

## Roadmap

### 1. Extract the lookup tables — DONE

`scripts/extract-follower-catalogs.py` (run with `uv run`, pass the
`Cult Of The Lamb_Data` dir) generates `src/save/follower-catalogs.ts`:
traits (126), roles (20), factions, hats, outfits, clothing,
customisations, specials, pets, causes of death, and thoughts (565).
Display names come from the game's English localization, with
humanized fallbacks; unknown ids degrade to `Unknown trait 79`.

Learned along the way:

- Necklaces are ordinary inventory items, already covered by
  `ITEM_NAMES`.
- Skins have no id table; the save's literal skin-name strings are
  enough for display. The trailing digit is the variation plus one
  (`Seahorse3` = variation 2).
- Work hats and outfits are mostly unnamed in the localization files
  (they're functional items named by role).
- Curses reuse the Thought id space, so the thoughts table covers
  `CursedState` too.

`tests/follower-catalogs.test.ts` self-checks known ids and, when
`COTL_SAVE_COPY` is set, cross-checks every trait, outfit, and skin
in the real save.

### 2. Read side: full detail and dead followers — DONE

- Each follower now shows appearance, named traits, role, faction,
  faith, adoration, family (spouse and parents by name), day joined,
  life expectancy, and death details (cause, burial, funeral,
  murderer).
- Rows expand to a detail panel; dead followers get their own
  closed-by-default section with the cause of death as the chip.
  Recruit, possessed, and dissented lists still pending the same
  treatment.
- Fixed a bug where any nonzero `CursedState` showed as "Cursed".
  Those values are Thought ids. They now show as "State of mind"
  (146 = Old Age, 392 = Just Hatched).

### 3. Write side — DONE

`current-save.ts` can rewrite follower records the same way it rewrites
items (`plannedFollowersValue`): the follower count is fixed (no adding
or removing), only an approved list of fields may change
(`FOLLOWER_EDITABLE_SUBFIELDS`), and the record's raw layout is verified
before anything is replaced. Editable fields: name, level, age,
happiness, satiation, illness, the appearance fields, and traits. The
editor validates each field against the lookup tables or a value range.
Nested structures (thoughts, relationships, inventory) are never
editable and pass through untouched. Covered by unit tests plus a gated
real-save roundtrip that edits a follower, re-encrypts, and reopens the
file.

### 4. Edit staging and UI — DONE

`src/save/follower-edits.ts` mirrors the cult-edits pattern: stage,
discard, list (with human-readable from/to values), and apply. Edits
are keyed by follower id and work on both living and dead followers.
The UI exposes name, level, age, happiness, satiation, illness, and
traits through an edit modal (with a searchable trait picker); dead
followers additionally get a cause-of-death dropdown. Cause of death
is staged as one virtual field and expanded at apply time so the
underlying flags can never contradict each other. A second virtual
field, Status (Active / Elder / Dead), covers kill, revive, and elder
toggling. See item 5. Follower edits share the same pending-changes
list, change dock, download flow, and session cache as cult edits
(old cached sessions still restore). Appearance fields validate and
apply but have no form controls yet.

### 5. Guard cross-record integrity — PARTLY DONE

This is the risky part. About fifteen other places in the save refer
to a follower: the dead-id list, the elder-id list, spouses,
relationships, thoughts, murderers, dwelling assignments, and more.

Kill, revive, and elder toggling shipped via the Status field. What a
real save taught us:

- Living and dead records share the same layout (dead-cause flags
  exist on living records too, all false), so moving a follower
  between lists is just a copy plus flag flips.
- The save keeps a separate list of dead follower ids that mirrors
  the dead list's order; the editor recomputes it and refuses to move
  anyone if the mirror is already broken.
- Elder state lives in two places. The game leaves both stale on
  death, so killing preserves them and reviving sets both explicitly.
- The writer enforces conservation: followers may move between lists
  but never appear or vanish, and every moved record must match its
  original bytes outside the editable fields.

Still deferred: creating new followers, changing ids, and cleaning up
the other cross-references on kill/revive. The game cleans up
dangling references for deaths it causes itself. An in-game check
(item 6) should confirm that it tolerates ours. The most important
case is to revive a follower whose dwelling was reassigned.

On bodies and graves: a dead record only stores whether the follower
was buried and had a funeral, plus a last position. Corpses and graves
are structures that point at the follower (`FollowerID`, `BodyWrapped`),
never the reverse. An editor kill spawns no corpse structure, but that
matches natural states for every cause: ritual deaths (the no-cause
default) consume the body, and any other corpse can be butchered for
meat, leaving dead-of-old-age followers with no body and no grave. The
game also routinely produces unburied dead and buried dead with no
surviving grave. Reviving a buried follower leaves a grave that points at a
living follower. The game never creates this state itself. If the
item-6 check shows problems, revive must clear the grave's follower
id, which means adding a structures writer.

### 6. Check in the game

Follow the pattern in `todo.md` section 9: one field per category,
then a combined edit, then save, reload, and restart.

## Loose ends

- The trait table doesn't say which traits are DLC. Late additions
  (Aestivation, Heavyweight, Flautist, …) are almost certainly
  Woolhaven traits, but the editor can currently stage them onto a
  non-DLC save. Needs an in-game check (item 6) or a curated id list.
- Some localized trait names embed markup or `{0}` templates; the
  picker cleans these up, but names shown elsewhere are still raw.
- The game no longer caps loyalty levels (the old level-10 cap was
  removed), so the editor's limit is just a 9999 sanity bound. The
  XP table was never extracted; it lives in compiled code the catalog
  script doesn't read.
