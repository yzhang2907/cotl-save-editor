import { decode, encode } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import {
  replaceMessagePackPositions,
  verifyMessagePackPositions,
} from "../src/save/messagepack";
import type { MessagePackSource } from "../src/save/types";
import { concatenateBytes } from "./save-fixtures";

const REPLACEMENT = "swapped";
const REPLACEMENT_BYTES = encode(REPLACEMENT);

/*
 * The positional writer splices raw byte spans that the skip-scanner
 * measures, so a wrong hardcoded length for any marker would corrupt
 * every span after it. Each case plants one value of that marker class
 * between two neighbors and replaces a neighbor, which only round-trips
 * if the scanner measured the planted value exactly.
 */
const MARKER_CASES: Array<{ bytes: number[]; name: string }> = [
  { bytes: [0x7f], name: "positive fixint" },
  { bytes: [0xe0], name: "negative fixint" },
  { bytes: [0xc0], name: "nil" },
  { bytes: [0xc2], name: "false" },
  { bytes: [0xc3], name: "true" },
  { bytes: [0xa3, 0x61, 0x62, 0x63], name: "fixstr" },
  { bytes: [0x92, 0x01, 0xa1, 0x78], name: "fixarray" },
  { bytes: [0x81, 0xa1, 0x6b, 0x01], name: "fixmap" },
  { bytes: [0xc4, 0x03, 0xaa, 0xbb, 0xcc], name: "bin8" },
  { bytes: [0xc5, 0x00, 0x03, 0xaa, 0xbb, 0xcc], name: "bin16" },
  {
    bytes: [0xc6, 0x00, 0x00, 0x00, 0x03, 0xaa, 0xbb, 0xcc],
    name: "bin32",
  },
  { bytes: [0xc7, 0x03, 0x01, 0xaa, 0xbb, 0xcc], name: "ext8" },
  { bytes: [0xc8, 0x00, 0x03, 0x01, 0xaa, 0xbb, 0xcc], name: "ext16" },
  {
    bytes: [0xc9, 0x00, 0x00, 0x00, 0x03, 0x01, 0xaa, 0xbb, 0xcc],
    name: "ext32",
  },
  { bytes: [0xca, 0x3f, 0x80, 0x00, 0x00], name: "float32" },
  {
    bytes: [0xcb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    name: "float64",
  },
  { bytes: [0xcc, 0xff], name: "uint8" },
  { bytes: [0xcd, 0x01, 0x00], name: "uint16" },
  { bytes: [0xce, 0x00, 0x01, 0x00, 0x00], name: "uint32" },
  {
    bytes: [0xcf, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
    name: "uint64",
  },
  { bytes: [0xd0, 0x80], name: "int8" },
  { bytes: [0xd1, 0xff, 0x00], name: "int16" },
  { bytes: [0xd2, 0x80, 0x00, 0x00, 0x00], name: "int32" },
  {
    bytes: [0xd3, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00],
    name: "int64",
  },
  { bytes: [0xd4, 0x01, 0xaa], name: "fixext1" },
  { bytes: [0xd5, 0x01, 0xaa, 0xbb], name: "fixext2" },
  { bytes: [0xd6, 0x01, 0xaa, 0xbb, 0xcc, 0xdd], name: "fixext4" },
  {
    bytes: [0xd6, 0xff, 0x00, 0x00, 0x00, 0x01],
    name: "timestamp fixext4",
  },
  {
    bytes: [0xd7, 0x01, 1, 2, 3, 4, 5, 6, 7, 8],
    name: "fixext8",
  },
  {
    bytes: [
      0xd8, 0x01, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ],
    name: "fixext16",
  },
  { bytes: [0xd9, 0x03, 0x61, 0x62, 0x63], name: "str8" },
  { bytes: [0xda, 0x00, 0x03, 0x61, 0x62, 0x63], name: "str16" },
  {
    bytes: [0xdb, 0x00, 0x00, 0x00, 0x03, 0x61, 0x62, 0x63],
    name: "str32",
  },
  { bytes: [0xdc, 0x00, 0x02, 0x01, 0x02], name: "array16" },
  {
    bytes: [0xdd, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02],
    name: "array32",
  },
  { bytes: [0xde, 0x00, 0x01, 0xa1, 0x6b, 0x01], name: "map16" },
  {
    bytes: [0xdf, 0x00, 0x00, 0x00, 0x01, 0xa1, 0x6b, 0x01],
    name: "map32",
  },
];

function sourceFor(payload: Uint8Array): MessagePackSource {
  const rawData = decode(payload, { useBigInt64: true });
  if (!Array.isArray(rawData)) {
    throw new Error("The marker fixture must decode to an array.");
  }
  return {
    compression: null,
    rawData,
    rawPayload: payload,
    schema: "slot",
  };
}

describe("MessagePack skip-scanner marker coverage", () => {
  it.each(MARKER_CASES)(
    "preserves a $name value beside a positional replace",
    ({ bytes }) => {
      const target = Uint8Array.from(bytes);
      const payload = concatenateBytes([
        Uint8Array.of(0x93, 0x01),
        target,
        Uint8Array.of(0x02),
      ]);
      const source = sourceFor(payload);
      const replacements = new Map<number, unknown>([[0, REPLACEMENT]]);

      const replaced = replaceMessagePackPositions(source, replacements);

      expect(replaced.rawPayload).toEqual(
        concatenateBytes([
          Uint8Array.of(0x93),
          REPLACEMENT_BYTES,
          target,
          Uint8Array.of(0x02),
        ]),
      );
      expect(() =>
        verifyMessagePackPositions(source, replaced, replacements),
      ).not.toThrow();
      expect(decode(replaced.rawPayload, { useBigInt64: true })).toEqual([
        REPLACEMENT,
        source.rawData[1],
        2,
      ]);
    },
  );

  it("rejects the never-assigned 0xc1 marker", () => {
    const source: MessagePackSource = {
      compression: null,
      rawData: [1, null],
      rawPayload: Uint8Array.of(0x92, 0x01, 0xc1),
      schema: "slot",
    };

    expect(() =>
      replaceMessagePackPositions(source, new Map([[0, 2]])),
    ).toThrow("unsupported marker 0xc1");
  });

  it("rejects a payload that ends inside a value", () => {
    const source: MessagePackSource = {
      compression: null,
      rawData: [1, "abcde"],
      rawPayload: Uint8Array.of(0x92, 0x01, 0xa5, 0x61, 0x62),
      schema: "slot",
    };

    expect(() =>
      replaceMessagePackPositions(source, new Map([[0, 2]])),
    ).toThrow("ended unexpectedly");
  });

  it("rejects trailing bytes after the positional array", () => {
    const source: MessagePackSource = {
      compression: null,
      rawData: [1],
      rawPayload: Uint8Array.of(0x91, 0x01, 0x00),
      schema: "slot",
    };

    expect(() =>
      replaceMessagePackPositions(source, new Map([[0, 2]])),
    ).toThrow("trailing data");
  });

  it("rejects an empty payload and a non-array root", () => {
    const empty: MessagePackSource = {
      compression: null,
      rawData: [],
      rawPayload: new Uint8Array(),
      schema: "slot",
    };
    const record: MessagePackSource = {
      compression: null,
      rawData: [],
      rawPayload: Uint8Array.of(0x80),
      schema: "slot",
    };

    expect(() =>
      replaceMessagePackPositions(empty, new Map([[0, 2]])),
    ).toThrow("payload is empty");
    expect(() =>
      replaceMessagePackPositions(record, new Map([[0, 2]])),
    ).toThrow("not a positional array");
  });

  it("rejects nesting past the recursion guard", () => {
    const depth = 520;
    const nested = new Uint8Array(depth + 1).fill(0x91);
    nested[depth] = 0x01;
    const source: MessagePackSource = {
      compression: null,
      rawData: [null],
      rawPayload: nested,
      schema: "slot",
    };

    expect(() =>
      replaceMessagePackPositions(source, new Map([[0, 2]])),
    ).toThrow("nested too deeply");
  });
});
