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
- [x] Preview the exact values that each replacement removes and adds.
- [x] Reject unknown, conflicting, duplicate, or incomplete doctrine data.

## 5. Replace the browser UI with React — Ready for review

- [x] Add React, ReactDOM, and the Vite React plug-in.
- [x] Keep save decoding, validation, and encoding in plain TypeScript.
- [x] Move the upload area, status banner, and save report into components.
- [x] Move the cult overview and each detail section into components.
- [x] Move the doctrine picker and change preview into components.
- [x] Store the opened file, decoded save, and preview in React state.
- [x] Keep all detail sections closed when a save opens.
- [x] Keep the caret controls and current keyboard behavior.
- [x] Keep the current appearance before making new design changes.
- [x] Add component tests for file selection and doctrine previews.
- [x] Compare the React screen with the current screen by using a copied save.
- [x] Remove the old manual DOM builders after the comparison passes.
- [ ] Commit the React conversion without save-writing changes.

## 6. Apply doctrine changes in memory

- [ ] Keep the original decoded save unchanged.
- [ ] Create a separate working copy for edits.
- [ ] Apply one approved preview to the working copy.
- [ ] Update the doctrine choice, cult trait, and linked unlock together.
- [ ] Refuse a preview if its source values changed after it was made.
- [ ] Rebuild the next preview from the current working copy.
- [ ] Let the user undo one change or reset all changes.
- [ ] List every pending change before export.
- [ ] Compare the original and working copies after each change.
- [ ] Reject changes outside the approved fields.
- [ ] Test modern `CultTraits` and legacy `CultTrait` saves.
- [ ] Test one change, several changes, reset, and blocked changes.

## 7. Write a modified current save

- [ ] Map each editable field to its raw MessagePack position.
- [ ] Copy the raw MessagePack data before any replacement.
- [ ] Replace only the positions for approved doctrine changes.
- [ ] Keep every other raw value, value type, and unknown position unchanged.
- [ ] Encode the modified MessagePack data.
- [ ] Compress and encrypt the new payload.
- [ ] Open the new file in the browser before download.
- [ ] Confirm that each approved field contains its planned value.
- [ ] Confirm that every other raw position matches the source.
- [ ] Stop the export if any comparison fails.
- [ ] Keep the current `.mp` writer separate from the legacy JSON writer.

## 8. Download an edited save safely

- [ ] Show the final change list before download.
- [ ] Require confirmation that a backup exists.
- [ ] Tell the user to close the game before replacing a save.
- [ ] Warn that Steam Cloud can restore or overwrite a local save.
- [ ] Add `.edited` to the download name.
- [ ] Never use the source file name for an edited download.
- [ ] Download only after the browser verification passes.
- [ ] Show recovery steps when verification or game loading fails.
- [ ] Never write to the game's active save directory.

## 9. Check edited files in the game

- [ ] Test one doctrine replacement in each category.
- [ ] Test several doctrine replacements in one file.
- [ ] Load the edited file and confirm the selected doctrines.
- [ ] Save in the game, return to the title screen, and load it again.
- [ ] Restart the game and load the edited file again.
- [ ] Test a new campaign created by the current game.
- [x] Test an old campaign upgraded by the current game.
- [ ] Test supported legacy JSON saves.
- [x] Test a current save with an unknown position.
- [x] Confirm an unchanged rebuild in the game.
- [ ] Use only user-made copies for all automated and manual checks.
- [ ] Record the game version used for each accepted test.

## 10. Prepare for public use

- [ ] State the supported game version in the interface.
- [ ] Reject unsupported save layouts with a clear message.
- [ ] Handle empty, truncated, corrupt, and oversized files.
- [ ] Keep save data inside the browser.
- [ ] Confirm permission to distribute extracted game icons.
- [ ] Replace game icons if distribution permission is not available.
- [ ] Document backup, replacement, Steam Cloud, and recovery steps.
- [ ] Test the production build on a static host.

## 11. Add more editors

- [ ] Edit the cult name.
- [ ] Edit resource quantities and reserved quantities.
- [ ] Edit follower data after all linked follower records are mapped.
- [ ] Edit unlocks after their dependencies are mapped.
- [ ] Edit quests after their state transitions are mapped.
- [ ] Add an approved-field comparison for each editor.
- [ ] Add browser and in-game checks for each editor.
