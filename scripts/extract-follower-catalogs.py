#!/usr/bin/env python3
# /// script
# dependencies = ["dnfile", "UnityPy"]
# ///
"""Generate src/save/follower-catalogs.ts from the game's install.

Enum ids come from Assembly-CSharp.dll; display names come from the
I2Languages localization asset in resources.assets. Run with uv:

    uv run scripts/extract-follower-catalogs.py \
        "~/.local/share/Steam/steamapps/common/Cult of the Lamb/Cult Of The Lamb_Data"
"""

from __future__ import annotations

import argparse
import re
import struct
from pathlib import Path

import dnfile
import UnityPy


DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1] / "src/save/follower-catalogs.ts"
)

# Save-file field -> (exported constant, enum type in Assembly-CSharp.dll,
# I2.Loc term patterns tried in order).
CATALOGS = [
    ("FOLLOWER_TRAITS", "TraitType", ["Traits/{key}"]),
    ("FOLLOWER_ROLES", "FollowerRole", ["Traits/{key}"]),
    ("FOLLOWER_FACTIONS", "FollowerFaction", []),
    ("FOLLOWER_HATS", "FollowerHatType", ["Clothing/{key}/Name"]),
    ("FOLLOWER_OUTFITS", "FollowerOutfitType", ["Clothing/{key}/Name"]),
    ("FOLLOWER_CLOTHING", "FollowerClothingType", ["Clothing/{key}/Name"]),
    (
        "FOLLOWER_CUSTOMISATIONS",
        "FollowerCustomisationType",
        ["Clothing/{key}/Name"],
    ),
    ("FOLLOWER_SPECIALS", "FollowerSpecialType", ["Clothing/{key}/Name"]),
    ("FOLLOWER_PETS", "FollowerPetType", []),
    ("CAUSES_OF_DEATH", "CauseOfDeath", []),
    ("FOLLOWER_THOUGHTS", "Thought", ["FollowerThoughts/{key}"]),
]

# Sanity anchors: extraction fails loudly if these stop holding.
ANCHORS = [
    ("TraitType", "GrassEater", 6),
    ("FollowerRole", "Farmer", 3),
    ("FollowerHatType", "None", 0),
]

CONSTANT_FORMATS = {
    0x04: "<b",
    0x05: "<B",
    0x06: "<h",
    0x07: "<H",
    0x08: "<i",
    0x09: "<I",
    0x0A: "<q",
    0x0B: "<Q",
}


def read_enums(dll: Path, wanted: set[str]) -> dict[str, dict[str, int]]:
    pe = dnfile.dnPE(str(dll))
    tables = pe.net.mdtables

    constants: dict[int, int] = {}
    for constant in tables.Constant.rows:
        row = constant.Parent.row
        fmt = CONSTANT_FORMATS.get(constant.Type)
        if row is None or type(row).__name__ != "FieldRow" or fmt is None:
            continue
        blob = constant.Value
        data = blob.value if hasattr(blob, "value") else bytes(blob)
        constants[id(row)] = struct.unpack(fmt, data[: struct.calcsize(fmt)])[0]

    enums: dict[str, dict[str, int]] = {}
    for typedef in tables.TypeDef.rows:
        name = str(typedef.TypeName)
        if name not in wanted or name in enums:
            continue
        entries: dict[str, int] = {}
        for reference in typedef.FieldList:
            field = reference.row
            field_name = str(field.Name)
            if field_name != "value__" and id(field) in constants:
                entries[field_name] = constants[id(field)]
        if entries:
            enums[name] = entries

    missing = wanted - enums.keys()
    if missing:
        raise SystemExit(f"Enums not found in {dll}: {sorted(missing)}")
    return enums


def read_i2_terms(resources: Path) -> dict[str, list[str]]:
    """Parse the I2Languages LanguageSourceData out of resources.assets.

    UnityPy cannot type-tree this MonoBehaviour, so the raw blob is
    parsed by hand: after the m_Name header comes the mTerms count,
    then per term: Term (string), TermType (int32), a counted array of
    per-language strings, and two counted byte arrays (Flags and
    Languages_Touch). Strings and byte arrays are 4-byte aligned.
    """
    blob: bytes | None = None
    for obj in UnityPy.load(str(resources)).objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            name = obj.peek_name()
        except Exception:
            continue
        if str(name) == "I2Languages":
            blob = bytes(obj.get_raw_data())
            break
    if blob is None:
        raise SystemExit(f"No I2Languages MonoBehaviour in {resources}")

    def read_string(position: int) -> tuple[str, int]:
        (length,) = struct.unpack_from("<i", blob, position)
        if length < 0 or length > 1_000_000:
            raise ValueError(f"Implausible string length {length}")
        text = blob[position + 4 : position + 4 + length].decode("utf-8")
        return text, (position + 4 + length + 3) & ~3

    marker = blob.find(b"I2Languages")
    position = (marker + len(b"I2Languages") + 3) & ~3
    # mSource leads with three int-sized fields before the mTerms count.
    position += 12
    (term_count,) = struct.unpack_from("<i", blob, position)
    position += 4

    terms: dict[str, list[str]] = {}
    for _ in range(term_count):
        term, position = read_string(position)
        position += 4  # TermType
        (language_count,) = struct.unpack_from("<i", blob, position)
        position += 4
        if not 0 < language_count < 40:
            raise ValueError(f"Implausible language count {language_count}")
        languages = []
        for _ in range(language_count):
            text, position = read_string(position)
            languages.append(text)
        for _ in range(2):  # Flags, Languages_Touch
            (byte_count,) = struct.unpack_from("<i", blob, position)
            position = (position + 4 + byte_count + 3) & ~3
        terms[term] = languages
    return terms


def english_column(terms: dict[str, list[str]]) -> int:
    """The language columns are unlabeled here; find English by anchor."""
    anchor = terms.get("Traits/GrassEater")
    if anchor is None:
        raise SystemExit("Anchor term Traits/GrassEater missing")
    for index, text in enumerate(anchor):
        if text == "Grass Eater":
            return index
    raise SystemExit("No column of Traits/GrassEater reads 'Grass Eater'")


def humanize(key: str) -> str:
    spaced = key.replace("_", " ")
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", spaced)
    spaced = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", spaced)
    return re.sub(r"\s+", " ", spaced).strip()


def display_name(
    key: str,
    patterns: list[str],
    terms: dict[str, list[str]],
    english: int,
) -> str:
    for pattern in patterns:
        languages = terms.get(pattern.format(key=key))
        if languages and len(languages) > english and languages[english]:
            return languages[english]
    return humanize(key)


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "game_data",
        type=Path,
        help="Path to the Cult Of The Lamb_Data directory",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    game_data = args.game_data.expanduser()
    enums = read_enums(
        game_data / "Managed/Assembly-CSharp.dll",
        {enum for _, enum, _ in CATALOGS},
    )
    for enum, key, value in ANCHORS:
        if enums[enum].get(key) != value:
            raise SystemExit(
                f"Anchor {enum}.{key} is {enums[enum].get(key)}, "
                f"expected {value}; the game schema changed"
            )

    terms = read_i2_terms(game_data / "resources.assets")
    english = english_column(terms)

    lines = [
        "// Generated by scripts/extract-follower-catalogs.py — do not edit.",
        "//",
        "// Ids come from enums in Assembly-CSharp.dll; names come from the",
        "// I2Languages English column, falling back to the enum key spaced",
        "// out. Necklaces are inventory item ids (see ITEM_NAMES) and skins",
        "// are stored as literal strings in the save, so neither is here.",
        "",
        "export interface FollowerCatalogEntry {",
        "  key: string;",
        "  name: string;",
        "}",
        "",
        "export type FollowerCatalog = Readonly<",
        "  Record<number, FollowerCatalogEntry>",
        ">;",
        "",
    ]
    for constant, enum, patterns in CATALOGS:
        localized = 0
        lines.append(f"export const {constant}: FollowerCatalog = {{")
        for key, value in sorted(enums[enum].items(), key=lambda kv: kv[1]):
            name = display_name(key, patterns, terms, english)
            if name != humanize(key):
                localized += 1
            lines.append(
                f'  {value}: {{ key: "{escape(key)}", '
                f'name: "{escape(name)}" }},'
            )
        lines.append("};")
        lines.append("")
        print(
            f"{constant}: {len(enums[enum])} entries from {enum}, "
            f"{localized} localized"
        )

    lines.append("export function catalogName(")
    lines.append("  catalog: FollowerCatalog,")
    lines.append("  id: number,")
    lines.append("  kind: string,")
    lines.append("): string {")
    lines.append("  return catalog[id]?.name ?? `Unknown ${kind} ${id}`;")
    lines.append("}")
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
