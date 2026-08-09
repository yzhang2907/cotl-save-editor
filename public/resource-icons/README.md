# Resource icons

Lossless WebP sprites extracted with UnityPy from a locally installed copy
of Cult of the Lamb. Filenames are save item IDs (`ITEM_TYPE` values), not
atlas indexes.

## Where the data lives

- Bundles: `Cult Of The Lamb_Data/StreamingAssets/aa/StandaloneWindows64/*.bundle`
  (Unity Addressables; names are content hashes, so they change between
  game versions).
- Most item sprites are in the `Resources_Atlas` bundle. To find it, decode
  `aa/catalog.json` (`m_KeyDataString`/`m_BucketDataString`/
  `m_EntryDataString` are base64 Addressables tables) and look up the key
  `Resources_Atlas`; the first dependency bundle contains the atlas.
- Ground truth for item ID → sprite is the `InventoryItemDisplay`
  MonoBehaviour (`ItemImages` list of `{key: ITEM_TYPE, value: PPtr<Sprite>}`),
  serialized in a prefab bundle. `PPtr.m_FileID` indexes the serialized
  file's externals (CAB names); find the bundle holding that CAB to resolve
  the sprite. Items missing from that list (Relic, Cod, the Commandment
  Fragment, and the Woolhaven-only Flockade Piece, Woolhaven Necklace, and
  Purple Flower Seeds) have no inventory icon sprite and stay text-only.
- `ITEM_TYPE` enum names come from `Managed/Assembly-CSharp.dll` metadata.
- `unknown.webp` is the `Emotes_Exclaim` sprite ("!?"), extracted the same
  way; the editor shows it for items without a mapped icon.

## Rebuilding

```
scripts/extract-resource-icons.py <output-dir> <bundle> [bundle…]
```

Pass the `Resources_Atlas` bundle plus any bundles (and their texture
dependency bundles) holding sprites named in `src/save/resource-icons.json`;
the script errors on any unresolved sprite and writes `manifest.json`.
Requires UnityPy.

Cult of the Lamb and its game artwork belong to Massive Monster and Devolver
Digital. This project is an unofficial fan-made utility.
