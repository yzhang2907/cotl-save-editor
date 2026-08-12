<p align="center">
  <a href="https://cotlsave.com">
    <img src="public/banner.png" alt="Cult of the Lamb Save Editor" width="100%">
  </a>
</p>

# Cult of the Lamb Save Editor

An unofficial browser editor for Cult of the Lamb saves. Saves are read
in the browser and never uploaded. Available at
[cotlsave.com](https://cotlsave.com).

## What it does

- opens current `.mp` saves; legacy `.json` saves are read-only;
- shows followers, resources, base data, and progression unlocks;
- stages doctrine replacements and missing-tier unlocks;
- renames the cult, edits resource quantities, and adds catalog items;
- handles dual doctrines and DLC-gated content;
- warns about unknown or inconsistent save data; and
- verifies each rebuilt save before downloading it.

Edits go to a working copy. The editor rebuilds the `.mp` save in
memory, reopens it to check that only the approved fields changed, and
downloads it with an `.edited.mp` suffix once you confirm the safety
steps. An unlock adds its doctrine ID and every catalog-mapped trait or
ritual grant as one checked operation. Unknown or inconsistent doctrine
data is rejected.

The browser cannot detect DLC ownership. DLC-specific changes appear
only after that save has activated the required DLC in the game.

Current game versions use `slot_#.mp`. An older campaign directory may still
contain a legacy `slot_#.json` that is no longer current, so the app warns
before treating a legacy file as the active save.

## Development

Requirements:

- Node.js 22 or newer
- pnpm 11

```sh
pnpm install
pnpm dev
```

Run all checks:

```sh
pnpm check
```

Run the tests with a per-file coverage report:

```sh
pnpm coverage
```

The interface uses React and Vite. Save decoding, validation, and encoding
remain in framework-independent TypeScript modules under `src/save`.

Run the optional check against a copied save:

```sh
COTL_SAVE_COPY=/path/to/copied/slot_0.mp \
  pnpm exec vitest run tests/real-save-roundtrip.test.ts
```

Compare that save with an accepted unchanged rebuild:

```sh
COTL_SAVE_COPY=/path/to/copied/slot_0.mp \
COTL_REBUILT_SAVE_COPY=/path/to/copied/slot_1.mp \
  pnpm exec vitest run tests/real-save-roundtrip.test.ts
```

Check a copy of a campaign that has no cult name and no doctrines yet:

```sh
COTL_NEW_SAVE_COPY=/path/to/copied/slot_0.mp \
  pnpm exec vitest run tests/real-save-roundtrip.test.ts
```

Never point this check at the game's active save directory.

## Format notes

Legacy encrypted saves use this envelope:

```text
"E" | 16-byte key | 16-byte IV | AES-128-CBC ciphertext
```

Current `.mp` saves encrypt a MessagePack payload. That payload may contain
MessagePack-CSharp LZ4-compressed blocks and positional keys that must be
mapped back to save field names. Unchanged test exports keep the decoded
MessagePack bytes exactly as the game wrote them. Edited saves copy those
bytes and replace only approved top-level positions. Generic MessagePack
encoding can change number-based map keys into text and make a save invalid.

The positional field map is provided by
[`lamb-mp-decoder`](https://github.com/matthewmmorrow/lamb-mp-decoder).
The package is MIT licensed.

Doctrine, ritual, and item names use a versioned local catalog. Unknown IDs
stay visible so that a game update cannot silently assign the wrong name.

## Privacy

Saves are decoded, edited, and rebuilt inside the browser. The app
makes no network requests after the page loads, needs no account, and
sets no tracking. Downloads go wherever the browser puts them; the app
never touches the game's save directory.

## Backing up, installing, and recovering saves

The interface states the game version it was tested with. A newer game
version may still work, but check that the overview looks right before
editing.

Back up before anything else:

1. Close Cult of the Lamb completely.
2. Copy the game's entire `saves` directory somewhere outside it, for
   example `Documents/cotl-backup-2026-08-09`. On Steam for Windows the
   directory is
   `%LOCALAPPDATA%Low\Massive Monster\Cult Of The Lamb\saves`; on Linux
   (Proton) it is inside
   `steamapps/compatdata/1313140/pfx/drive_c/users/steamuser/AppData/LocalLow/Massive Monster/Cult Of The Lamb/saves`.
3. Only ever open a copy in the editor, never the live file.

Install an edited save:

1. Keep the game closed.
2. Move the downloaded file, named like `slot_0.edited.mp`, into the
   `saves` directory.
3. Rename your original, for example `slot_0.mp` → `slot_0.mp.bak`, then
   rename the edited file to the original name, `slot_0.mp`.
4. Start the game and load the slot.

Steam Cloud: cloud sync can silently restore the old save over your
edited file, or upload the edited file over your cloud copy. To be
safe, disable cloud sync for Cult of the Lamb (game Properties →
General → Steam Cloud) before installing the edit, and re-enable it
once the game has loaded and saved with the edited file.

Recovery: if the game refuses to load, crashes, or shows wrong data,
close it, delete the edited `slot_#.mp`, and rename your `.bak` file (or
restore the copied `saves` directory) back to the original name. If
Steam Cloud already synced, choose the local backup when Steam offers a
sync conflict, or temporarily disable cloud sync while restoring.

## Development safety

Real save files and private test saves are set up to be skipped by
Git, so they cannot accidentally end up in the repository. Whether you
are running the automated tests or trying things by hand, always work
on a copy of a save file instead of on the files in the game's actual save
folder.

## License

This project is free software, released under the GNU Affero General
Public License, version 3 or later. See [LICENSE](LICENSE) for the full
text. If you run a modified copy as a network service, the AGPL requires
you to offer its source to the people who use it.
