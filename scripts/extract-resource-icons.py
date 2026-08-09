#!/usr/bin/env python3
"""Extract verified Cult of the Lamb inventory icons from a Unity bundle."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import UnityPy


DEFAULT_MAPPING = (
    Path(__file__).resolve().parents[1] / "src/save/resource-icons.json"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("bundles", nargs="+", type=Path)
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    args = parser.parse_args()

    definitions = json.loads(args.mapping.read_text(encoding="utf-8"))
    environment = UnityPy.load(*[str(bundle) for bundle in args.bundles])
    args.output.mkdir(parents=True, exist_ok=True)
    sprites = {}

    # Earlier bundles win: pass the Resources_Atlas bundle first so
    # duplicate sprite names in later bundles cannot shadow it.
    for obj in environment.objects:
        if obj.type.name != "Sprite":
            continue
        sprite = obj.read()
        sprites.setdefault(sprite.m_Name, sprite)

    manifest: list[dict[str, int | str]] = []
    missing: list[str] = []
    for definition in definitions:
        item_id = int(definition["id"])
        sprite_name = str(definition["sprite"])
        sprite = sprites.get(sprite_name)
        if sprite is None:
            missing.append(f"{item_id}: {sprite_name}")
            continue
        image = sprite.image
        image.save(
            args.output / f"{item_id}.webp",
            "WEBP",
            exact=True,
            lossless=True,
            method=6,
        )
        manifest.append(
            {
                "height": image.height,
                "id": item_id,
                "itemType": definition["itemType"],
                "sprite": sprite_name,
                "width": image.width,
            },
        )

    if missing:
        joined = "\n".join(missing)
        raise SystemExit(f"Mapped sprites are missing from the bundle:\n{joined}")

    manifest.sort(key=lambda entry: int(entry["id"]))
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(manifest)} verified icons to {args.output}.")


if __name__ == "__main__":
    main()
