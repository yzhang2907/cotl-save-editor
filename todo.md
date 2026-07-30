# Road map

## 1. Read and inspect saves — Done

- [x] Open plain JSON, encrypted JSON, and current `.mp` files.
- [x] Decode MessagePack data and LZ4-compressed blocks.
- [x] Show unknown positions before any edit.
- [x] Keep the selected file in the browser.

## 2. Rebuild current saves — In progress

- [x] Keep every raw position, including unknown positions.
- [x] Keep the source MessagePack bytes unchanged in a test export.
- [x] Compress and encrypt the rebuilt data.
- [x] Compare the exported data bytes with the source data bytes.
- [ ] Load the revised unchanged export in the game.

The current test save has 1,396 positions. Position `1395` has no known name.
The writer keeps its empty array unchanged. The first game test failed because
the export changed one number-based map key into text. The revised writer keeps
the source data bytes unchanged.

## 3. Map doctrines

- [ ] List each doctrine ID and name.
- [ ] Record its category and opposing choice.
- [ ] Record the trait IDs that each choice grants.
- [ ] Check the map against a new save and an upgraded save.

## 4. Edit doctrines

- [ ] Show the selected choice in each category.
- [ ] Show the valid replacement choices.
- [ ] Update all fields that store the choice.
- [ ] Reject conflicting or incomplete selections.
- [ ] Show the old and new values before export.

## 5. Export safely

- [x] Keep the selected file unchanged.
- [x] Give the export a new file name.
- [x] Verify each unchanged export in the browser before download.
- [ ] Require the user to confirm that a backup exists.
- [ ] Give clear recovery steps when verification fails.

## 6. Test supported saves

- [ ] Test a new current save.
- [ ] Test an old save that the current game upgraded.
- [ ] Test supported legacy JSON saves.
- [ ] Test saves with unknown positions.
- [ ] Confirm each exported file in the game.

## 7. Add more editors

- [ ] Edit resources.
- [ ] Edit followers.
- [ ] Edit quests.
- [ ] Edit unlocks.
- [ ] Add separate checks for each editor.
