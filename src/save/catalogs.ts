import type { DlcKey } from "./dlc";

export type DoctrineSide = "left" | "right";

export interface DoctrineChoiceDefinition {
  cultTraitIds: number[];
  doctrineId: number;
  name: string;
  side: DoctrineSide;
  upgradeIds: number[];
}

export interface DoctrinePairDefinition {
  choices: [DoctrineChoiceDefinition, DoctrineChoiceDefinition];
  rank: number;
}

export interface DoctrineCategoryDefinition {
  key:
    | "work"
    | "possessions"
    | "sustenance"
    | "afterlife"
    | "law"
    | "sins"
    | "winter";
  name: string;
  pairs: DoctrinePairDefinition[];
  requiredDlc?: DlcKey;
}

function choice(
  doctrineId: number,
  name: string,
  side: DoctrineSide,
  options: {
    cultTraitIds?: number[];
    upgradeIds?: number[];
  } = {},
): DoctrineChoiceDefinition {
  return {
    cultTraitIds: options.cultTraitIds ?? [],
    doctrineId,
    name,
    side,
    upgradeIds: options.upgradeIds ?? [],
  };
}

function pair(
  rank: number,
  left: DoctrineChoiceDefinition,
  right: DoctrineChoiceDefinition,
): DoctrinePairDefinition {
  return { choices: [left, right], rank };
}

export const DOCTRINE_CATEGORIES: DoctrineCategoryDefinition[] = [
  {
    key: "work",
    name: "Work & Worship",
    pairs: [
      pair(
        1,
        choice(10, "Faithful", "left", { cultTraitIds: [11] }),
        choice(11, "Industrious", "right", { cultTraitIds: [24] }),
      ),
      pair(
        2,
        choice(6, "Inspire", "left"),
        choice(7, "Intimidate", "right"),
      ),
      pair(
        3,
        choice(8, "Glory of Construction", "left", {
          upgradeIds: [100],
        }),
        choice(9, "Ritual of Enlightenment", "right", {
          upgradeIds: [101],
        }),
      ),
      pair(
        4,
        choice(12, "Glory Through Toil", "left", {
          upgradeIds: [102],
        }),
        choice(13, "Holy Day Ritual", "right", {
          upgradeIds: [103],
        }),
      ),
    ],
  },
  {
    key: "possessions",
    name: "Possessions",
    pairs: [
      pair(
        1,
        choice(14, "Extort Tithes", "left"),
        choice(15, "Bribe Follower", "right"),
      ),
      pair(
        2,
        choice(18, "Belief in Materialism", "left", {
          cultTraitIds: [18],
        }),
        choice(19, "Belief in False Idols", "right", {
          cultTraitIds: [19],
        }),
      ),
      pair(
        3,
        choice(20, "Alms for the Poor", "left", {
          upgradeIds: [104],
        }),
        choice(21, "Ritual of Enrichment", "right", {
          upgradeIds: [105],
        }),
      ),
      pair(
        4,
        choice(16, "Sacral Architecture", "left", {
          cultTraitIds: [27],
        }),
        choice(17, "Devotee", "right", { cultTraitIds: [26] }),
      ),
    ],
  },
  {
    key: "sustenance",
    name: "Sustenance",
    pairs: [
      pair(
        1,
        choice(22, "Ritual Fast", "left", { upgradeIds: [106] }),
        choice(23, "Feasting Ritual", "right", {
          upgradeIds: [107],
        }),
      ),
      pair(
        2,
        choice(26, "Cannibal", "left", { cultTraitIds: [5] }),
        choice(27, "Grass Eater", "right", { cultTraitIds: [6] }),
      ),
      pair(
        3,
        choice(28, "Ritual of the Harvest", "left", {
          upgradeIds: [108],
        }),
        choice(29, "Ritual of the Ocean's Bounty", "right", {
          upgradeIds: [109],
        }),
      ),
      pair(
        4,
        choice(24, "Substances Encouraged", "left", {
          cultTraitIds: [28],
        }),
        choice(25, "Belief in Prohibitionism", "right", {
          cultTraitIds: [29],
        }),
      ),
    ],
  },
  {
    key: "afterlife",
    name: "Afterlife",
    pairs: [
      pair(
        1,
        choice(30, "Belief in Sacrifice", "left", {
          cultTraitIds: [9],
        }),
        choice(31, "Belief in Afterlife", "right", {
          cultTraitIds: [3],
        }),
      ),
      pair(
        2,
        choice(32, "Ritual of Resurrection", "left", {
          upgradeIds: [110],
        }),
        choice(33, "Funeral", "right", { upgradeIds: [111] }),
      ),
      pair(
        3,
        choice(34, "Respect Your Elders", "left", {
          cultTraitIds: [30],
        }),
        choice(35, "Good Die Young", "right", {
          cultTraitIds: [31],
        }),
      ),
      pair(
        4,
        choice(36, "Return to the Earth", "left", {
          upgradeIds: [53],
        }),
        choice(37, "Grieve the Fallen", "right", {
          upgradeIds: [57],
        }),
      ),
    ],
  },
  {
    key: "law",
    name: "Law & Order",
    pairs: [
      pair(
        1,
        choice(38, "Murder Follower", "left"),
        choice(39, "Ascend Follower", "right", {
          upgradeIds: [154],
        }),
      ),
      pair(
        2,
        choice(40, "Ritualistic Fight Pit", "left", {
          upgradeIds: [112],
        }),
        choice(41, "Wedding", "right", { upgradeIds: [113] }),
      ),
      pair(
        3,
        choice(44, "Belief in Original Sin", "left", {
          cultTraitIds: [7],
        }),
        choice(45, "Belief in Absolution", "right", {
          cultTraitIds: [8],
        }),
      ),
      pair(
        4,
        choice(42, "Loyalty Enforcer", "left", {
          upgradeIds: [114],
        }),
        choice(43, "Tax Enforcer", "right", {
          upgradeIds: [115],
        }),
      ),
    ],
  },
  {
    key: "sins",
    name: "Sins of the Flesh",
    pairs: [
      pair(
        1,
        choice(53, "Rite of Lust", "left", { upgradeIds: [268] }),
        choice(54, "Rite of Wrath", "right", {
          upgradeIds: [267],
        }),
      ),
      pair(
        2,
        choice(60, "Sinner's Pride", "left", {
          upgradeIds: [277],
        }),
        choice(59, "Gluttony of Cannibals", "right", {
          upgradeIds: [276],
        }),
      ),
      pair(
        3,
        choice(55, "Doctrinal Extremist", "left", {
          cultTraitIds: [44],
        }),
        choice(56, "Violent Extremist", "right", {
          cultTraitIds: [45],
        }),
      ),
      pair(
        4,
        choice(57, "Born of Sin", "left", { cultTraitIds: [46] }),
        choice(58, "Blind Allegiance", "right", {
          cultTraitIds: [47],
        }),
      ),
    ],
  },
  {
    key: "winter",
    name: "Woolhaven",
    requiredDlc: "woolhaven",
    pairs: [
      pair(
        1,
        choice(72, "Furnace Followers", "left", {
          cultTraitIds: [112],
        }),
        choice(73, "Furnace Animals", "right", {
          cultTraitIds: [113],
        }),
      ),
      pair(
        2,
        choice(74, "Convert to Rot", "left", {
          upgradeIds: [336],
        }),
        choice(78, "Remove Rot", "right", {
          upgradeIds: [337],
        }),
      ),
      pair(
        3,
        choice(65, "Cold Enthusiast", "left", {
          cultTraitIds: [88],
        }),
        choice(64, "Work Through Blizzards", "right", {
          cultTraitIds: [87],
        }),
      ),
      pair(
        4,
        choice(71, "Ranch for Meat", "left", {
          upgradeIds: [334],
        }),
        choice(70, "Ranch for Harvests", "right", {
          upgradeIds: [335],
        }),
      ),
    ],
  },
];

export const SPECIAL_DOCTRINE_NAMES: Readonly<Record<number, string>> = {
  46: "Brainwashing Ritual",
  47: "Sacrifice of the Flesh",
  48: "Consume Follower",
  49: "Read Minds",
  50: "Bonfire Ritual",
  51: "Blood Moon Ritual",
  52: "Disciple Ritual",
  61: "Ritual of Warmth",
  62: "Midwinter Ritual",
  63: "Full Furnace",
  66: "Spread Rotstone",
  67: "Divorce Ritual",
  68: "Follower Wedding",
  69: "Snowman Ritual",
  75: "Bonfire Ritual II",
  76: "Embrace the Rot",
  77: "Reject the Rot",
  79: "Healing Touch",
};

export const RITUAL_NAMES: Readonly<Record<number, string>> = {
  60: "Sacrifice of the Flesh",
  61: "Re-indoctrination",
  62: "Consume Follower",
  100: "Glory of Construction",
  101: "Ritual of Enlightenment",
  102: "Glory Through Toil",
  103: "Holy Day Ritual",
  104: "Alms for the Poor",
  105: "Ritual of Enrichment",
  106: "Ritual Fast",
  107: "Feasting Ritual",
  108: "Ritual of the Harvest",
  109: "Ritual of the Ocean's Bounty",
  110: "Ritual of Resurrection",
  111: "Funeral",
  112: "Ritualistic Fight Pit",
  113: "Wedding",
  114: "Loyalty Enforcer",
  115: "Tax Enforcer",
  146: "Brainwashing Ritual",
  154: "Ascend Follower",
  229: "Bonfire Ritual",
  232: "Blood Moon Ritual",
  252: "Forgotten Commandment",
  261: "Disciple Ritual",
  267: "Rite of Wrath",
  268: "Rite of Lust",
  276: "Gluttony of Cannibals",
  277: "Sinner's Pride",
  298: "Snowman Ritual",
  299: "Midwinter Ritual",
  300: "Ritual of Warmth",
  310: "Follower Wedding",
  314: "Divorce Ritual",
  334: "Ranch for Meat",
  335: "Ranch for Harvests",
  336: "Convert to Rot",
  337: "Remove Rot",
  338: "Bonfire Ritual II",
  339: "Embrace the Rot",
  340: "Reject the Rot",
};

export const SERMON_AND_RITE_NAMES: Readonly<Record<number, string>> = {
  1: "Ritual of Rebirth",
  2: "Cult Ascension I",
  3: "Cult Ascension II",
  4: "Sermon: Purge Sickness",
  5: "Sermon: Threaten Dissenters",
  6: "Sermon: Denounce Non-Believers",
  7: "Sermon: Love Thy Neighbour",
  8: "Sermon: Renounce Food",
  9: "Sermon of Enlightenment",
  10: "Sermon: Utopianists",
  11: "Sermon: Fundamentalists",
  12: "Sermon: Misfits",
  13: "Sermon: Denounce the Goat",
  14: "Sermon: Denounce the Owl",
  15: "Sermon: Denounce the Snake",
  16: "Sermon: Denounce a Follower",
  17: "Sermon of Diligence",
  18: "Promote Follower",
  19: "Sacrifice Follower",
  20: "Wedding",
  21: "Heal the Sick",
  22: "Nature's Bounty",
};

export const ITEM_NAMES: Readonly<Record<number, string>> = {
  1: "Lumber",
  2: "Stone",
  6: "Meat",
  8: "Berry Bush Seeds",
  9: "Bones",
  20: "Gold Coins",
  21: "Berries",
  22: "Heart of a Heretic",
  26: "Tarot Card",
  28: "Fish",
  29: "Menticide Mushrooms",
  33: "Minnow",
  34: "Tuna",
  35: "Grass",
  39: "Fertilizer",
  43: "Small Gift",
  44: "Big Gift",
  45: "Flower Necklace",
  46: "Feather Necklace",
  47: "Skull Necklace",
  48: "Nature's Necklace",
  49: "Moon Necklace",
  50: "Pumpkin",
  51: "Pumpkin Seeds",
  55: "Camellia",
  62: "Follower Meat",
  70: "Menticide Mushroom Spores",
  72: "Camellia Seeds",
  81: "Wooden Planks",
  82: "Stone Blocks",
  83: "Gold Nugget",
  86: "Gold Bars",
  89: "Crystal Shards",
  90: "Spider Silk",
  91: "Crab",
  92: "Lobster",
  93: "Octopus",
  94: "Squid",
  95: "Swordfish",
  96: "Blowfish",
  97: "Beetroot",
  98: "Beetroot Seeds",
  101: "Eye of the Witness",
  102: "Cauliflower",
  103: "Cauliflower Seeds",
  105: "Morsel",
  114: "Holy Talisman",
  117: "Shell",
  118: "Relic",
  119: "God Tear",
  120: "Forgotten Commandment Fragment",
  121: "Forgotten Commandment Stone",
  122: "Loyalty Necklace",
  123: "Demonic Necklace",
  124: "Dark Necklace",
  125: "Light Necklace",
  126: "Missionary Necklace",
  127: "Golden Skull Necklace",
  129: "Webber's Skull",
  130: "Snow Chunk",
  131: "Charcoal",
  132: "Silk Thread",
  133: "Cotton",
  135: "Cod",
  136: "Pike",
  137: "Catfish",
  139: "Lightning Shard",
  140: "Cotton Seeds",
  141: "Lore Stone",
  142: "Golden Fertilizer",
  143: "Rainbow Fertilizer",
  144: "Glowing Fertilizer",
  150: "Hops",
  151: "Grapes",
  152: "Hops Seeds",
  153: "Grape Seeds",
  154: "Sin",
  155: "Follower Egg",
  159: "Yolk",
  160: "Sozo Seed",
  163: "Bell Necklace",
  165: "Wool",
  166: "Snow Fruit Seeds",
  167: "Snow Fruit",
  168: "Chilli",
  169: "Chilli Seeds",
  170: "Goat",
  172: "Magma Stone",
  173: "Electrified Magma",
  176: "Turtle",
  177: "Crab Animal",
  178: "Spider",
  179: "Snail",
  180: "Death's Door Necklace",
  181: "Winter Necklace",
  182: "Frozen Necklace",
  183: "Weird Necklace",
  184: "Targeted Necklace",
  185: "Woolhaven Necklace",
  186: "Soot",
  187: "Rotstone Fertilizer",
  188: "Cow",
  189: "Llama",
  194: "Forge Flame",
  197: "Milk",
  208: "Fishing Rod",
  227: "Ratau's Staff",
  229: "Flockade Piece",
  234: "Purple Flower Seeds",
};

export const CATALOG_GAME_VERSION = "1.5.25.1049";
