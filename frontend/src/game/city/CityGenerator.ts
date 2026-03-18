import { BuildingType, TerrainType, MAP_COLS, MAP_ROWS, BUILDING_SIZES } from '../utils/constants';
import { randInt, randPick } from '../utils/isometric';

export interface BuildingData {
  id: number;
  type: BuildingType;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  onFire: boolean;
  flooded: boolean;
}

export interface NPCData {
  id: number;
  col: number;
  row: number;
  targetCol: number;
  targetRow: number;
  hp: number;
  maxHp: number;
  speed: number;
  infected: boolean;
  dead: boolean;
  fleeing: boolean;
  homeBuilding: number;
}

export interface CityData {
  terrain: TerrainType[][];
  buildings: BuildingData[];
  npcs: NPCData[];
  name: string;
}

const CITY_NAMES = [
  'Ateny', 'Sparta', 'Korynt', 'Teby', 'Delphi',
  'Olimpia', 'Argos', 'Mykeny', 'Milet', 'Efez',
];

export class CityGenerator {
  private nextBuildingId = 1;
  private nextNpcId = 1;

  generate(): CityData {
    const terrain = this.generateTerrain();
    const buildings = this.placeBuildings(terrain);
    const npcs = this.spawnNPCs(buildings);
    const name = randPick(CITY_NAMES);

    return { terrain, buildings, npcs, name };
  }

  private generateTerrain(): TerrainType[][] {
    const grid: TerrainType[][] = [];

    for (let r = 0; r < MAP_ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < MAP_COLS; c++) {
        grid[r][c] = TerrainType.GRASS;
      }
    }

    // Main roads (cross pattern through center)
    const centerC = Math.floor(MAP_COLS / 2);
    const centerR = Math.floor(MAP_ROWS / 2);

    // Horizontal main road
    for (let c = 3; c < MAP_COLS - 3; c++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (centerR + dr >= 0 && centerR + dr < MAP_ROWS) {
          grid[centerR + dr][c] = TerrainType.STONE_ROAD;
        }
      }
    }

    // Vertical main road
    for (let r = 3; r < MAP_ROWS - 3; r++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (centerC + dc >= 0 && centerC + dc < MAP_COLS) {
          grid[r][centerC + dc] = TerrainType.STONE_ROAD;
        }
      }
    }

    // Secondary roads
    for (let i = 0; i < 6; i++) {
      const isHorizontal = Math.random() > 0.5;
      const pos = randInt(6, isHorizontal ? MAP_ROWS - 6 : MAP_COLS - 6);
      if (isHorizontal) {
        for (let c = randInt(2, 8); c < MAP_COLS - randInt(2, 8); c++) {
          if (pos >= 0 && pos < MAP_ROWS) grid[pos][c] = TerrainType.STONE_ROAD;
        }
      } else {
        for (let r = randInt(2, 8); r < MAP_ROWS - randInt(2, 8); r++) {
          if (pos >= 0 && pos < MAP_COLS) grid[r][pos] = TerrainType.STONE_ROAD;
        }
      }
    }

    // Agora area (marble floor around center)
    for (let r = centerR - 3; r <= centerR + 3; r++) {
      for (let c = centerC - 3; c <= centerC + 3; c++) {
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          grid[r][c] = TerrainType.MARBLE_FLOOR;
        }
      }
    }

    // Coastal edge (water + sand)
    for (let r = 0; r < MAP_ROWS; r++) {
      grid[r][0] = TerrainType.WATER;
      grid[r][1] = TerrainType.WATER;
      grid[r][2] = TerrainType.SAND;
      if (Math.random() > 0.5) grid[r][3] = TerrainType.SAND;
    }

    // Dirt patches
    for (let i = 0; i < 15; i++) {
      const cr = randInt(3, MAP_ROWS - 3);
      const cc = randInt(5, MAP_COLS - 3);
      const size = randInt(1, 3);
      for (let dr = -size; dr <= size; dr++) {
        for (let dc = -size; dc <= size; dc++) {
          const rr = cr + dr;
          const rc = cc + dc;
          if (rr >= 0 && rr < MAP_ROWS && rc >= 0 && rc < MAP_COLS && grid[rr][rc] === TerrainType.GRASS) {
            grid[rr][rc] = TerrainType.DIRT;
          }
        }
      }
    }

    return grid;
  }

  private placeBuildings(terrain: TerrainType[][]): BuildingData[] {
    const buildings: BuildingData[] = [];
    const occupied = new Set<string>();

    const markOccupied = (col: number, row: number, w: number, h: number) => {
      for (let r = row; r < row + h; r++) {
        for (let c = col; c < col + w; c++) {
          occupied.add(`${c},${r}`);
        }
      }
    };

    const canPlace = (col: number, row: number, w: number, h: number): boolean => {
      for (let r = row; r < row + h; r++) {
        for (let c = col; c < col + w; c++) {
          if (c < 4 || c >= MAP_COLS - 1 || r < 1 || r >= MAP_ROWS - 1) return false;
          if (occupied.has(`${c},${r}`)) return false;
          if (terrain[r][c] === TerrainType.WATER) return false;
        }
      }
      return true;
    };

    // Place major buildings first
    const centerC = Math.floor(MAP_COLS / 2);
    const centerR = Math.floor(MAP_ROWS / 2);

    // Parthenon near center
    this.tryPlace(buildings, occupied, BuildingType.PARTHENON, centerC - 2, centerR - 8, canPlace, markOccupied);

    // Temple of Zeus
    this.tryPlace(buildings, occupied, BuildingType.TEMPLE_ZEUS, centerC + 5, centerR - 5, canPlace, markOccupied);

    // Temple of Athena
    this.tryPlace(buildings, occupied, BuildingType.TEMPLE_ATHENA, centerC - 8, centerR - 4, canPlace, markOccupied);

    // Agora
    this.tryPlace(buildings, occupied, BuildingType.AGORA, centerC - 2, centerR + 4, canPlace, markOccupied);

    // Amphitheater
    this.tryPlace(buildings, occupied, BuildingType.AMPHITHEATER, centerC + 6, centerR + 5, canPlace, markOccupied);

    // Markets
    for (let i = 0; i < 3; i++) {
      const c = randInt(6, MAP_COLS - 8);
      const r = randInt(4, MAP_ROWS - 6);
      this.tryPlace(buildings, occupied, BuildingType.MARKET, c, r, canPlace, markOccupied);
    }

    // Barracks
    this.tryPlace(buildings, occupied, BuildingType.BARRACKS, centerC + 10, centerR + 2, canPlace, markOccupied);
    this.tryPlace(buildings, occupied, BuildingType.BARRACKS, centerC - 12, centerR + 8, canPlace, markOccupied);

    // Houses - many!
    for (let i = 0; i < 45; i++) {
      const houseType = randPick([BuildingType.HOUSE_SMALL, BuildingType.HOUSE_SMALL, BuildingType.HOUSE_MEDIUM, BuildingType.HOUSE_LARGE]);
      const c = randInt(5, MAP_COLS - 5);
      const r = randInt(3, MAP_ROWS - 5);
      this.tryPlace(buildings, occupied, houseType, c, r, canPlace, markOccupied);
    }

    // Decorations: columns, statues, fountains, trees
    for (let i = 0; i < 20; i++) {
      const type = randPick([BuildingType.COLUMN, BuildingType.STATUE, BuildingType.FOUNTAIN]);
      const c = randInt(5, MAP_COLS - 3);
      const r = randInt(3, MAP_ROWS - 3);
      this.tryPlace(buildings, occupied, type, c, r, canPlace, markOccupied);
    }

    // Trees along edges and scattered
    for (let i = 0; i < 30; i++) {
      const type = randPick([BuildingType.OLIVE_TREE, BuildingType.CYPRESS_TREE]);
      const c = randInt(4, MAP_COLS - 2);
      const r = randInt(2, MAP_ROWS - 2);
      this.tryPlace(buildings, occupied, type, c, r, canPlace, markOccupied);
    }

    // City walls along perimeter
    for (let c = 5; c < MAP_COLS - 2; c += 2) {
      this.tryPlace(buildings, occupied, BuildingType.WALL, c, 2, canPlace, markOccupied);
      this.tryPlace(buildings, occupied, BuildingType.WALL, c, MAP_ROWS - 3, canPlace, markOccupied);
    }
    for (let r = 3; r < MAP_ROWS - 3; r += 2) {
      this.tryPlace(buildings, occupied, BuildingType.WALL, MAP_COLS - 3, r, canPlace, markOccupied);
    }

    // Gates
    this.tryPlace(buildings, occupied, BuildingType.GATE, centerC, 2, canPlace, markOccupied);
    this.tryPlace(buildings, occupied, BuildingType.GATE, centerC, MAP_ROWS - 3, canPlace, markOccupied);

    return buildings;
  }

  private tryPlace(
    buildings: BuildingData[],
    _occupied: Set<string>,
    type: BuildingType,
    col: number,
    row: number,
    canPlace: (c: number, r: number, w: number, h: number) => boolean,
    markOccupied: (c: number, r: number, w: number, h: number) => void,
  ) {
    const size = BUILDING_SIZES[type];
    if (canPlace(col, row, size.w, size.h)) {
      buildings.push({
        id: this.nextBuildingId++,
        type,
        col,
        row,
        hp: size.maxHp,
        maxHp: size.maxHp,
        onFire: false,
        flooded: false,
      });
      markOccupied(col, row, size.w, size.h);
    }
  }

  private spawnNPCs(buildings: BuildingData[]): NPCData[] {
    const npcs: NPCData[] = [];
    const houses = buildings.filter(b =>
      b.type === BuildingType.HOUSE_SMALL ||
      b.type === BuildingType.HOUSE_MEDIUM ||
      b.type === BuildingType.HOUSE_LARGE
    );

    for (const house of houses) {
      const count = house.type === BuildingType.HOUSE_SMALL ? 1
        : house.type === BuildingType.HOUSE_MEDIUM ? 2 : 3;

      for (let i = 0; i < count; i++) {
        npcs.push({
          id: this.nextNpcId++,
          col: house.col + Math.random(),
          row: house.row + Math.random(),
          targetCol: house.col,
          targetRow: house.row,
          hp: 100,
          maxHp: 100,
          speed: 0.02 + Math.random() * 0.02,
          infected: false,
          dead: false,
          fleeing: false,
          homeBuilding: house.id,
        });
      }
    }

    return npcs;
  }
}
