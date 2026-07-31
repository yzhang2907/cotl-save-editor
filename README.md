# Cult of the Lamb Save Editor

A privacy-first browser editor for Cult of the Lamb saves. Save data is read
inside the browser and is never uploaded.

## Capabilities

- private, local loading of legacy `.json` and current `.mp` saves;
- an overview of followers, resources, base data, and progression unlocks;
- doctrine replacements and missing-tier unlocks staged entirely in the browser;
- support for legacy saves, dual doctrines, and DLC-gated content;
- warnings for unknown or inconsistent save data; and
- verified edited downloads with clear backup and game-safety checks.

The current interface inspects saves, applies doctrine replacements or
missing-tier unlocks to a browser-only working copy, builds and reopens an
edited `.mp` save in memory, and downloads it with an `.edited.mp` suffix only
after verification and explicit safety confirmations. An unlock adds its
doctrine ID and every catalog-mapped trait or ritual grant as one checked
operation. The editor rejects unknown or inconsistent doctrine data.
DLC ownership cannot be detected in the browser. DLC-specific changes are
available only after that save has activated the required DLC in the game.

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

## Safety

Real saves and private fixtures are ignored by Git. Keep a backup of the
entire Cult of the Lamb `saves` directory before using any save editor.
Close the game before installing an edited file. The browser never writes to
the active save directory: it downloads a separately named file that must be
installed manually. Steam Cloud can overwrite either the edited file or a
restored backup.
