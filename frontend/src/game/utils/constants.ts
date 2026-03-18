// Isometric tile dimensions (Ikariam-style 2:1 ratio)
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_HALF_W = TILE_WIDTH / 2;
export const TILE_HALF_H = TILE_HEIGHT / 2;

// Map dimensions
export const MAP_COLS = 40;
export const MAP_ROWS = 40;

// Building types
export const BuildingType = {
  TEMPLE_ZEUS: 'temple_zeus',
  TEMPLE_ATHENA: 'temple_athena',
  PARTHENON: 'parthenon',
  AGORA: 'agora',
  HOUSE_SMALL: 'house_small',
  HOUSE_MEDIUM: 'house_medium',
  HOUSE_LARGE: 'house_large',
  AMPHITHEATER: 'amphitheater',
  COLUMN: 'column',
  STATUE: 'statue',
  MARKET: 'market',
  BARRACKS: 'barracks',
  WALL: 'wall',
  GATE: 'gate',
  FOUNTAIN: 'fountain',
  OLIVE_TREE: 'olive_tree',
  CYPRESS_TREE: 'cypress_tree',
} as const;
export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

// Terrain types
export const TerrainType = {
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE_ROAD: 'stone_road',
  WATER: 'water',
  SAND: 'sand',
  MARBLE_FLOOR: 'marble_floor',
} as const;
export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

// God powers (destruction methods)
export const GodPower = {
  ZEUS_LIGHTNING: 'zeus_lightning',
  POSEIDON_EARTHQUAKE: 'poseidon_earthquake',
  POSEIDON_FLOOD: 'poseidon_flood',
  HEPHAESTUS_FIRE: 'hephaestus_fire',
  APOLLO_PLAGUE: 'apollo_plague',
  ARES_METEOR: 'ares_meteor',
  HADES_CHASM: 'hades_chasm',
} as const;
export type GodPower = (typeof GodPower)[keyof typeof GodPower];

// Colors palette (Ikariam-inspired warm Mediterranean)
export const COLORS = {
  // Terrain
  grass: [0x7CB342, 0x8BC34A, 0x689F38],
  dirt: [0xBCAAA4, 0xD7CCC8, 0xA1887F],
  stone: [0xCFD8DC, 0xB0BEC5, 0xECEFF1],
  water: [0x29B6F6, 0x039BE5, 0x0288D1],
  sand: [0xFFE0B2, 0xFFCC80, 0xFFB74D],
  marble: [0xF5F5F5, 0xEEEEEE, 0xE0E0E0],

  // Buildings
  wallWhite: 0xFAFAFA,
  wallCream: 0xFFF8E1,
  roofTerracotta: 0xE64A19,
  roofBlue: 0x1565C0,
  roofGold: 0xFFD54F,
  woodBrown: 0x795548,
  columnMarble: 0xF5F5F5,

  // Effects
  fire: [0xFF6F00, 0xFF8F00, 0xFFB300, 0xFF3D00],
  lightning: [0xE1F5FE, 0xFFFFFF, 0xB3E5FC],
  plague: [0x76FF03, 0xAEEA00, 0x64DD17],
  water_effect: [0x0288D1, 0x0277BD, 0x01579B],
  smoke: [0x616161, 0x757575, 0x9E9E9E],
  debris: [0xBCAAA4, 0xA1887F, 0x8D6E63],

  // UI
  uiGold: 0xFFD54F,
  uiBrown: 0x5D4037,
  uiParchment: 0xFFF8E1,

  // Sky
  skyTop: 0x64B5F6,
  skyBottom: 0xBBDEFB,
};

// Building sizes (in tiles)
export const BUILDING_SIZES: Record<BuildingType, { w: number; h: number; maxHp: number }> = {
  [BuildingType.TEMPLE_ZEUS]: { w: 4, h: 3, maxHp: 200 },
  [BuildingType.TEMPLE_ATHENA]: { w: 3, h: 3, maxHp: 180 },
  [BuildingType.PARTHENON]: { w: 5, h: 4, maxHp: 300 },
  [BuildingType.AGORA]: { w: 4, h: 4, maxHp: 150 },
  [BuildingType.HOUSE_SMALL]: { w: 1, h: 1, maxHp: 50 },
  [BuildingType.HOUSE_MEDIUM]: { w: 2, h: 2, maxHp: 80 },
  [BuildingType.HOUSE_LARGE]: { w: 2, h: 3, maxHp: 120 },
  [BuildingType.AMPHITHEATER]: { w: 4, h: 3, maxHp: 160 },
  [BuildingType.COLUMN]: { w: 1, h: 1, maxHp: 40 },
  [BuildingType.STATUE]: { w: 1, h: 1, maxHp: 30 },
  [BuildingType.MARKET]: { w: 3, h: 2, maxHp: 100 },
  [BuildingType.BARRACKS]: { w: 3, h: 2, maxHp: 140 },
  [BuildingType.WALL]: { w: 1, h: 1, maxHp: 100 },
  [BuildingType.GATE]: { w: 2, h: 1, maxHp: 120 },
  [BuildingType.FOUNTAIN]: { w: 1, h: 1, maxHp: 40 },
  [BuildingType.OLIVE_TREE]: { w: 1, h: 1, maxHp: 20 },
  [BuildingType.CYPRESS_TREE]: { w: 1, h: 1, maxHp: 15 },
};

// God power properties
export const GOD_POWER_INFO: Record<GodPower, {
  name: string;
  nameEn: string;
  god: string;
  description: string;
  radius: number;
  damage: number;
  cooldown: number;
  color: number;
}> = {
  [GodPower.ZEUS_LIGHTNING]: {
    name: 'Piorun Zeusa',
    nameEn: 'Zeus Lightning',
    god: 'Zeus',
    description: 'Potężny piorun uderza w wybrany punkt, niszcząc budynki i rażąc ludzi',
    radius: 3,
    damage: 80,
    cooldown: 2000,
    color: 0xFFFFFF,
  },
  [GodPower.POSEIDON_EARTHQUAKE]: {
    name: 'Trzęsienie Posejdona',
    nameEn: 'Poseidon Earthquake',
    god: 'Posejdon',
    description: 'Ziemia drży, budynki pękają i walą się na mieszkańców',
    radius: 6,
    damage: 50,
    cooldown: 5000,
    color: 0x795548,
  },
  [GodPower.POSEIDON_FLOOD]: {
    name: 'Potop Posejdona',
    nameEn: 'Poseidon Flood',
    god: 'Posejdon',
    description: 'Fala tsunami zalewa miasto, porywając ludzi i niszcząc budowle',
    radius: 8,
    damage: 40,
    cooldown: 8000,
    color: 0x0288D1,
  },
  [GodPower.HEPHAESTUS_FIRE]: {
    name: 'Ogień Hefajstosa',
    nameEn: 'Hephaestus Fire',
    god: 'Hefajstos',
    description: 'Rozżarzona lawa i ogień rozprzestrzeniają się po mieście',
    radius: 4,
    damage: 30,
    cooldown: 3000,
    color: 0xFF6F00,
  },
  [GodPower.APOLLO_PLAGUE]: {
    name: 'Plaga Apollona',
    nameEn: 'Apollo Plague',
    god: 'Apollo',
    description: 'Śmiertelna zaraza rozprzestrzenia się wśród mieszkańców',
    radius: 7,
    damage: 15,
    cooldown: 6000,
    color: 0x76FF03,
  },
  [GodPower.ARES_METEOR]: {
    name: 'Meteor Aresa',
    nameEn: 'Ares Meteor',
    god: 'Ares',
    description: 'Ognisty meteor spada z nieba, tworząc krater zniszczenia',
    radius: 5,
    damage: 100,
    cooldown: 10000,
    color: 0xFF3D00,
  },
  [GodPower.HADES_CHASM]: {
    name: 'Otchłań Hadesa',
    nameEn: 'Hades Chasm',
    god: 'Hades',
    description: 'Ziemia otwiera się, pochłaniając budynki i ludzi do podziemi',
    radius: 4,
    damage: 150,
    cooldown: 12000,
    color: 0x4A148C,
  },
};
