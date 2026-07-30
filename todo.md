# Road map

## 1. Read and inspect saves — Done

- [x] Open plain JSON, encrypted JSON, and current `.mp` files.
- [x] Decode MessagePack data and LZ4-compressed blocks.
- [x] Show unknown positions before any edit.
- [x] Keep the selected file in the browser.

## 2. Rebuild current saves — Done

- [x] Keep every raw position, including unknown positions.
- [x] Keep the source MessagePack bytes unchanged in a test export.
- [x] Compress and encrypt the rebuilt data.
- [x] Compare the exported data bytes with the source data bytes.
- [x] Load the revised unchanged export in the game.

The current test save has 1,396 positions. Position `1395` has no known name.
The writer keeps its empty array unchanged.

## 3. Show a cult overview — Done

- [x] Show the cult name and current day.
- [x] List living followers and their main status values.
- [x] List resources by name, quantity, and raw ID.
- [x] Show the number of base structures and structure types.
- [x] Show doctrine, ritual, and sermon unlocks.
- [x] Show unknown IDs instead of hiding them.

## 4. Map doctrines and rituals — Done for 1.5.25.1049

- [x] List each doctrine ID and name.
- [x] Record each doctrine category and opposing choice.
- [x] Record the trait and upgrade IDs for each choice.
- [x] List the ritual upgrade IDs.
- [x] Check the map against an upgraded campaign.
- [x] Compare the campaign with its accepted unchanged rebuild.

## 5. Edit doctrines

- [ ] Show the selected choice in each category.
- [ ] Show the valid replacement choices.
- [ ] Update all fields that store the choice.
- [ ] Reject conflicting or incomplete selections.
- [ ] Show the old and new values before export.

## 6. Export safely

- [x] Keep the selected file unchanged.
- [x] Give the export a new file name.
- [x] Verify each unchanged export in the browser before download.
- [ ] Require the user to confirm that a backup exists.
- [ ] Give clear recovery steps when verification fails.

## 7. Test supported saves

- [ ] Test a new current save.
- [x] Test an old save that the current game upgraded.
- [ ] Test supported legacy JSON saves.
- [x] Test a save with an unknown position.
- [x] Confirm the unchanged export in the game.

## 8. Add more editors

- [ ] Edit resources.
- [ ] Edit followers.
- [ ] Edit quests.
- [ ] Edit unlocks.
- [ ] Add separate checks for each editor.
