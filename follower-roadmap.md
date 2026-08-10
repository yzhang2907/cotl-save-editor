# Follower data roadmap

Findings come from the decoder key map in `lamb-mp-decoder` and from a
real save (`slot_0.mp`: 17 living followers, 39 dead).

## State of things

### The follower schema is already mapped

`slot_mp_keys[1109]` names indices 0-191 of every follower record. The
same 192-field layout is used by:

- `Followers` (1109) — living
- `Followers_Recruit` (1110)
- `Followers_Dead` (1111)
- `Followers_Possessed` (1113)
- `Followers_Dissented` (1114)

So dead followers need no new reader: same layout, different array.

The editor currently surfaces 9 of the 192 fields in
`buildFollowers` (`src/save/overview.ts:162`) and renders them
read-only in `src/ui/followers-section.tsx`.

### Appearance can be reconstructed

The save stores appearance directly:

- `SkinName` — a literal string, e.g. `Fish`, `Red Panda3`,
  `Boss Scorpion`.
- `SkinCharacter` / `SkinVariation` — e.g. `45` / `2` for
  `Red Panda3`; the name suffix is the variation plus one.
- `SkinColour` — values 0-24 observed.
- `Hat`, `Outfit`, `Clothing`, `ClothingVariant`,
  `ClothingPreviousVariant`, `Necklace`, `ShowingNecklace`,
  `Customisation`, `Special` — small integers, `0` or `""` for none.
- `CursedState`, `CursedStateVariant`, `IsSnowman`, `Pets`, `DLCPets`
  — overlays on top of the base skin.

`SkinCharacter` maps 1:1 to `SkinName` across all 57 records in the
test save, and `FollowerSkinsUnlocked` in the same save is a 54-entry
list of skin names — a catalog the save hands us for free.

A textual rebuild ("Red Panda, variation 3, colour 22, Bishop robes,
no hat") therefore needs no reverse engineering. A visual portrait
needs sprite extraction: feasible, since
`scripts/extract-resource-icons.py` already does this with UnityPy,
but followers are layered and tinted sprites rather than single
icons, so a faithful portrait is real work. Name, colour swatch, and
labelled parts is the cheap version.

### The real gap is the enum catalogs

Follower `Traits` values (`[79,16]`, `[16,51,42,43]`) are not
catalogued anywhere. `catalogs.ts` only holds the ~30 cult-trait IDs
that doctrines grant.

`Assembly-CSharp.dll` in the Steam install contains the `clothingType`,
`hatType`, `necklaceType`, `outfitType`, and `customisation` enums,
plus I2.Loc localization terms (`Traits_GrassEater`, and so on) for
display names.

## Roadmap

### 1. Extract the catalogs — DONE

`scripts/extract-follower-catalogs.py` (run with `uv run`, pass the
`Cult Of The Lamb_Data` dir) generates `src/save/follower-catalogs.ts`:
traits (126), roles (20), factions, hats, outfits, clothing,
customisations, specials, pets, causes of death, and thoughts (565).
Names come from the I2Languages English column with humanized enum-key
fallbacks; `catalogName()` degrades to `Unknown trait 79`.

Learned along the way:

- Necklaces are inventory item ids (`Gift_Necklace*`), already covered
  by `ITEM_NAMES` — there is no necklace enum.
- Skins are not an enum either; they live in WorshipperData Unity
  assets. The save's literal `SkinName` strings suffice for display.
- Roles localize as `Traits/<Role>` terms; work hats and outfits are
  mostly unlocalized (functional items named by role).
- `SkinCharacter` maps 1:1 to the *base* skin name; the trailing digit
  on `SkinName` is the variation plus one (`Seahorse3` = variation 2).
- Curses do share the Thought id space, so `FOLLOWER_THOUGHTS` covers
  `CursedState`. No sacrificial-type enum exists in the DLL.

`tests/follower-catalogs.test.ts` self-tests the anchors and, when
`COTL_SAVE_COPY` is set, cross-checks every trait, outfit, and skin
pair in the real save.

### 2. Read side: full detail and dead followers — DONE

- `FollowerOverview` now carries appearance, named traits, role,
  faction, faith, adoration, family (spouse and parents resolved to
  names), day joined, life expectancy, and a `death` block (cause
  from the `DiedOf*` flags, burial, funeral, murderer).
- Each follower row expands to a detail panel; dead followers render
  in their own closed-by-default section with the cause as the chip.
  Recruit, possessed, and dissented still pending the same pattern.
- The bogus "Cursed" status is gone: `CursedState` is surfaced as
  "State of mind" via `FOLLOWER_THOUGHTS` (146 = Old Age, 392 = Just
  Hatched), confirming the loose end below.

### 3. Write side: positional raw mapping — DONE

- `current-save.ts` maps a `Followers` position and plans per-entry
  replacements via `plannedFollowersValue`, mirroring
  `plannedItemsValue`: fixed entry count (add/remove/resurrect
  rejected), unapproved subfields rejected, raw layout asserted
  before replacement.
- Allowlist (`FOLLOWER_EDITABLE_SUBFIELDS`): `_name`, `XPLevel`,
  `Age`, `_happiness`, `_satiation`, `_illness`, appearance fields
  (skin variation/colour, hat, outfit, clothing and variants,
  necklace, customisation, special), and `Traits` — each validated
  against the follower catalogs or value ranges.
- Nested keyed subfields (Thoughts, Relationships, Inventory, …)
  decode into records, so the layout assertion skips them
  (`messagePackNestedSubfields`); they are never editable and pass
  through raw untouched.
- Covered by unit tests and a gated real-save roundtrip that edits a
  follower, re-encrypts, and reopens the file.

### 4. Edit staging and UI

Follow the existing `cult-edits.ts` pattern: stage, discard,
`listPending…`, and `apply…` with the unapproved-field sweep.

### 5. Guard cross-record integrity

This is what makes follower editing riskier than resources. A
follower is referenced from about fifteen other places:
`Followers_Dead_IDs`, `Followers_Elderly_IDs`, `SpouseFollowerID`,
`Relationships`, `Thoughts[].FollowerID`, `MurderedBy`, dwelling
assignments, and more.

Editing a field is safe. Changing IDs, resurrecting, or adding
followers is not. Scope the first pass to field edits on existing
followers and defer add, remove, and resurrect entirely.

### 6. Check in the game

Follow the pattern in `todo.md` section 9: one field per category,
then a combined edit, then save, reload, and restart.

## Loose ends noticed along the way

- ~~`overview.ts` marked any nonzero `CursedState` as "Cursed"~~ —
  confirmed to be Thought ids and fixed in item 2.
- ~~`traitCount` discards trait data~~ — replaced with named `traits`
  in item 2.
