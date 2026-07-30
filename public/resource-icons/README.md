# Resource icons

These WebP files come from the `Resources_Atlas` sprite atlas in a locally
installed copy of Cult of the Lamb.

Run `scripts/extract-resource-icons.py` with the matching Unity asset bundle
and this directory as its arguments to rebuild the files. The numbered
filenames are save item IDs, not atlas indexes. The explicit map in
`src/save/resource-icons.json` comes from the game's `ITEM_TYPE` enum. Items
without a verified mapping remain text-only in the editor.

The script requires UnityPy.

Cult of the Lamb and its game artwork belong to Massive Monster and Devolver
Digital. This project is an unofficial fan-made utility.
