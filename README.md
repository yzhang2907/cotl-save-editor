# Cult of the Lamb Save Editor

A privacy-first browser editor for Cult of the Lamb saves. Save data is read
inside the browser and is never uploaded.

## Capabilities

- local drag-and-drop for legacy `.json` and current `.mp` saves;
- detection of plaintext JSON, encrypted JSON, and encrypted MessagePack;
- AES-128-CBC decryption through the browser Web Crypto API;
- MessagePack decoding and LZ4 block decompression;
- doctrine-field and unknown-schema diagnostics;
- support for both `CultTraits` and the legacy `CultTrait` field;
- deterministic tests covering every recognized save envelope; and
- an encrypted legacy JSON encoder.

The current interface inspects saves without modifying or downloading them.
Compatibility checks prevent unsafe doctrine editing.

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

## Format notes

Legacy encrypted saves use this envelope:

```text
"E" | 16-byte key | 16-byte IV | AES-128-CBC ciphertext
```

Current `.mp` saves encrypt a MessagePack payload. That payload may contain
MessagePack-CSharp LZ4-compressed blocks and positional keys that must be
mapped back to save field names.

The decoder is provided by
[`lamb-mp-decoder`](https://github.com/matthewmmorrow/lamb-mp-decoder).
The package is MIT licensed.

## Safety

Real saves and private fixtures are ignored by Git. Keep a backup of the
entire Cult of the Lamb `saves` directory before using any save editor.
