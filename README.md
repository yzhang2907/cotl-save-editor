# Cult of the Lamb Save Editor

A privacy-first browser editor for Cult of the Lamb saves. Save data is read
inside the browser and is never uploaded.

## Capabilities

- local drag-and-drop for legacy `.json` and current `.mp` saves;
- detection of plaintext JSON, encrypted JSON, and encrypted MessagePack;
- AES-128-CBC decryption through the browser Web Crypto API;
- MessagePack decoding and LZ4 block decompression;
- raw-byte preservation for current MessagePack saves;
- LZ4 and AES rebuilding for unchanged test copies;
- doctrine-field and unknown-schema diagnostics;
- support for both `CultTraits` and the legacy `CultTrait` field;
- deterministic tests covering every recognized save envelope; and
- an encrypted legacy JSON encoder.

The current interface inspects saves and can download an unchanged `.mp` test
copy. Doctrine editing is not enabled. Compatibility checks prevent unsafe
edits.

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

Run the optional round-trip check against a copied save:

```sh
COTL_SAVE_COPY=/path/to/copied/slot_0.mp \
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
MessagePack bytes exactly as the game wrote them. Generic MessagePack
encoding can change number-based map keys into text and make a save invalid.

The positional field map is provided by
[`lamb-mp-decoder`](https://github.com/matthewmmorrow/lamb-mp-decoder).
The package is MIT licensed.

## Safety

Real saves and private fixtures are ignored by Git. Keep a backup of the
entire Cult of the Lamb `saves` directory before using any save editor.
