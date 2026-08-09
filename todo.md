# Work list

## 1. Read and inspect saves — Done

- [x] Open plain JSON, encrypted JSON, and current `.mp` files.
- [x] Decode MessagePack data and LZ4-compressed blocks.
- [x] Show unknown positions before any edit.
- [x] Keep the selected file in the browser.
- [x] Show the complete decoded record on request.

## 2. Rebuild unchanged current saves — Done

- [x] Keep every raw position, including unknown positions.
- [x] Keep the source MessagePack data unchanged.
- [x] Compress and encrypt the rebuilt data.
- [x] Open the rebuilt file and compare it with the source.
- [x] Load the rebuilt file in the game.

The current test save has 1,396 positions. Position `1395` has no known name.
An unchanged rebuild keeps its empty array.

## 3. Show the cult — Done

- [x] Show the cult name, current day, followers, and structures.
- [x] List resources by name, quantity, raw ID, and game icon.
- [x] Show doctrine, ritual, and sermon unlocks.
- [x] Show unknown IDs instead of hiding them.
- [x] Keep each detail section closed when the save opens.
- [x] Use carets to show that each section can open.

## 4. Map doctrine data — Done for 1.5.25.1049

- [x] Record each doctrine category and opposing choice.
- [x] Record the trait and upgrade IDs for each choice.
- [x] Record the ritual upgrade IDs.
- [x] Check the map against an upgraded campaign.
- [x] Calculate the exact values that each replacement removes and adds.
- [x] Reject unknown, duplicate, or incomplete doctrine data.
- [x] Accept opposing doctrines unlocked with Forgotten Commandment Stones.
- [x] Gate DLC-specific doctrines through an extensible DLC registry.

## 5. Replace the browser UI with React — Done

- [x] Add React, ReactDOM, and the Vite React plug-in.
- [x] Keep save decoding, validation, and encoding in plain TypeScript.
- [x] Move the upload area, status banner, and save report into components.
- [x] Move the cult overview and each detail section into components.
- [x] Move the doctrine picker and working-copy controls into components.
- [x] Store the opened file, decoded save, and edits in React state.
- [x] Keep all detail sections closed when a save opens.
- [x] Keep the caret controls and current keyboard behavior.
- [x] Keep the current appearance before making new design changes.
- [x] Add component tests for file selection and doctrine changes.
- [x] Compare the React screen with the current screen by using a copied save.
- [x] Remove the old manual DOM builders after the comparison passes.
- [x] Commit the React conversion without save-writing changes.

## 6. Apply doctrine changes in memory — Ready for review

- [x] Keep the original decoded save unchanged.
- [x] Create a separate working copy for edits.
- [x] Update the doctrine choice, cult trait, and linked unlock together.
- [x] Unlock a missing doctrine tier and its linked grants together.
- [x] Require earlier ranks before unlocking a later rank.
- [x] Refuse a selection if its source values changed before it was applied.
- [x] Calculate each new selection from the current working copy.
- [x] Let the user stage changes to several ranks and mark each change.
- [x] List only the net changes, even after a choice is restored.
- [x] Let the user discard one change or discard all changes.
- [x] Compare the original and working copies after each change.
- [x] Reject changes outside the approved fields.
- [x] Test modern `CultTraits` and legacy `CultTrait` saves.
- [x] Test one change, several changes, reset, and blocked changes.

## 7. Write a modified current save — Ready for review

- [x] Map each editable field to its raw MessagePack position.
- [x] Copy the raw MessagePack data before any replacement.
- [x] Replace only the positions for approved doctrine changes.
- [x] Keep every other raw value, value type, and unknown position unchanged.
- [x] Encode the modified MessagePack data.
- [x] Compress and encrypt the new payload.
- [x] Open the new file in the browser before download.
- [x] Confirm that each approved field contains its planned value.
- [x] Confirm that every other raw position matches the source.
- [x] Stop the export if any comparison fails.
- [x] Write current `.mp` saves only. Legacy JSON is read-only.

## 8. Download an edited save safely — Ready for review

- [x] Show the final change list before download.
- [x] Require confirmation that a backup exists.
- [x] Tell the user to close the game before replacing a save.
- [x] Require confirmation for every DLC needed by the staged changes.
- [x] Warn that Steam Cloud can restore or overwrite a local save.
- [x] Add `.edited` to the download name.
- [x] Never use the source file name for an edited download.
- [x] Download only after the browser verification passes.
- [x] Show recovery steps when verification or game loading fails.
- [x] Never write to the game's active save directory.

## 9. Check edited files in the game

All accepted tests used game version 1.5.25.1049.

- [x] Test one doctrine replacement in each category, except Woolhaven.
- [x] Test several doctrine replacements in one file.
- [x] Load the edited file and confirm the selected doctrines.
- [x] Save in the game, return to the title screen, and load it again.
- [x] Restart the game and load the edited file again.
- [x] Test a new campaign created by the current game.
- [x] Test an old campaign upgraded by the current game.
- [x] Drop legacy JSON editing. Reading and its stale-file warning stay.
- [x] Test a current save with an unknown position.
- [x] Confirm an unchanged rebuild in the game.
- [ ] Use only user-made copies for all automated and manual checks.
- [ ] Record the game version used for each accepted test.

Edited files survived an in-game save, a title-screen reload, and a game
restart. Granted rituals worked, so linked upgrades apply.

Woolhaven is deferred: the DLC is not owned, and its choices stay disabled
without `MAJOR_DLC`.

A new campaign decodes to the same 1,396 positions as an upgraded one. It
can have no cult name and no doctrines, so overview checks that assume
progress belong to the mature-save test only.

## 10. Prepare for public use

- [x] State the supported game version in the interface.
- [x] Reject unsupported save layouts with a clear message.
- [x] Handle empty, truncated, corrupt, and oversized files.
- [x] Keep save data inside the browser.
- [ ] Confirm permission to distribute extracted game icons.
- [ ] Replace game icons if distribution permission is not available.

Icons stay for now by decision. Massive Monster publishes no policy on
extracted assets, so confirmation means asking them directly.
- [x] Document backup, replacement, Steam Cloud, and recovery steps.
- [ ] Test the production build on a static host. Verified locally under a
      `/cotl-save-editor/` subpath; a real GitHub Pages deploy is pending.

## 11. Add more editors

- [x] Edit the cult name.
- [x] Edit resource quantities and reserved quantities.
- [x] Add catalog-known items that the save does not hold yet.
- [ ] Edit follower data after all linked follower records are mapped.
- [ ] Edit unlocks after their dependencies are mapped.
- [ ] Edit quests after their state transitions are mapped.
- [x] Add an approved-field comparison for each editor.
- [ ] Add browser and in-game checks for each editor.

Cult name and resource edits stage into the same working copy as
doctrine changes and go through the same rebuild, reopen, and
byte-for-byte verification. Within `items`, only `quantity` and
`QuantityReserved` may change on existing entries; item types and
unknown sub-positions are preserved and enforced, and entries are
never removed. New entries append at the end, must use catalog-known
item types not already held, and always carry the
`[type, quantity, QuantityReserved]` layout. Items without a stored
`QuantityReserved` keep it absent. Browser checks are automated in
`tests/cult-edits.test.ts`, `tests/current-save.test.ts`, and
`tests/react-ui.test.tsx`; the in-game check of an edited name and
quantity is still pending. Follower, unlock, and quest editors stay
blocked on their mapping work.
