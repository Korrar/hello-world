import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import { TILE_HALF_W, TILE_HALF_H, BuildingType, TerrainType, COLORS } from '../utils/constants';

/**
 * Factory for creating all isometric graphics procedurally.
 * Ikariam-inspired style: warm colors, clean shapes, Mediterranean feel.
 */
export class GraphicsFactory {
  /** Draw an isometric tile (diamond shape) */
  static drawTile(color: number, alpha = 1): Graphics {
    const g = new Graphics();
    g.poly([
      0, -TILE_HALF_H,
      TILE_HALF_W, 0,
      0, TILE_HALF_H,
      -TILE_HALF_W, 0,
    ]);
    g.fill({ color, alpha });
    g.stroke({ color: darken(color, 0.15), width: 1, alpha: 0.3 });
    return g;
  }

  /** Create terrain tile */
  static createTerrain(type: TerrainType): Graphics {
    const colors: Record<TerrainType, number[]> = {
      [TerrainType.GRASS]: COLORS.grass,
      [TerrainType.DIRT]: COLORS.dirt,
      [TerrainType.STONE_ROAD]: COLORS.stone,
      [TerrainType.WATER]: COLORS.water,
      [TerrainType.SAND]: COLORS.sand,
      [TerrainType.MARBLE_FLOOR]: COLORS.marble,
    };
    const palette = colors[type];
    const color = palette[Math.floor(Math.random() * palette.length)];
    return this.drawTile(color);
  }

  /** Create a building graphic */
  static createBuilding(type: BuildingType, damageLevel = 0): Container {
    const container = new Container();

    switch (type) {
      case BuildingType.TEMPLE_ZEUS:
      case BuildingType.TEMPLE_ATHENA:
        this.drawTemple(container, type, damageLevel);
        break;
      case BuildingType.PARTHENON:
        this.drawParthenon(container, damageLevel);
        break;
      case BuildingType.HOUSE_SMALL:
        this.drawSmallHouse(container, damageLevel);
        break;
      case BuildingType.HOUSE_MEDIUM:
        this.drawMediumHouse(container, damageLevel);
        break;
      case BuildingType.HOUSE_LARGE:
        this.drawLargeHouse(container, damageLevel);
        break;
      case BuildingType.AMPHITHEATER:
        this.drawAmphitheater(container, damageLevel);
        break;
      case BuildingType.COLUMN:
        this.drawColumn(container, damageLevel);
        break;
      case BuildingType.STATUE:
        this.drawStatue(container, damageLevel);
        break;
      case BuildingType.MARKET:
        this.drawMarket(container, damageLevel);
        break;
      case BuildingType.AGORA:
        this.drawAgora(container, damageLevel);
        break;
      case BuildingType.BARRACKS:
        this.drawBarracks(container, damageLevel);
        break;
      case BuildingType.WALL:
        this.drawWall(container, damageLevel);
        break;
      case BuildingType.GATE:
        this.drawGate(container, damageLevel);
        break;
      case BuildingType.FOUNTAIN:
        this.drawFountain(container, damageLevel);
        break;
      case BuildingType.OLIVE_TREE:
        this.drawOliveTree(container, damageLevel);
        break;
      case BuildingType.CYPRESS_TREE:
        this.drawCypressTree(container, damageLevel);
        break;
    }
    return container;
  }

  /** Draw isometric box (foundation for most buildings) */
  private static drawIsoBox(g: Graphics, w: number, h: number, depth: number, topColor: number, leftColor: number, rightColor: number) {
    // Top face
    g.poly([
      0, -depth,
      w / 2, h / 2 - depth,
      0, h - depth,
      -w / 2, h / 2 - depth,
    ]);
    g.fill(topColor);

    // Left face
    g.poly([
      -w / 2, h / 2 - depth,
      0, h - depth,
      0, h,
      -w / 2, h / 2,
    ]);
    g.fill(leftColor);

    // Right face
    g.poly([
      w / 2, h / 2 - depth,
      0, h - depth,
      0, h,
      w / 2, h / 2,
    ]);
    g.fill(rightColor);
  }

  private static drawTemple(container: Container, type: BuildingType, damage: number) {
    const g = new Graphics();
    const isZeus = type === BuildingType.TEMPLE_ZEUS;
    const roofColor = isZeus ? COLORS.roofGold : COLORS.roofBlue;
    const w = isZeus ? 120 : 100;
    const h = isZeus ? 80 : 70;

    // Platform / base
    this.drawIsoBox(g, w + 20, 15, 8, COLORS.marble[0], darken(COLORS.marble[0], 0.1), darken(COLORS.marble[0], 0.2));
    g.y = 0;

    // Steps
    for (let i = 0; i < 3; i++) {
      const stepW = w + 16 - i * 6;
      const stepY = -10 - i * 4;
      g.poly([
        0, stepY,
        stepW / 2, stepY + 8,
        0, stepY + 16,
        -stepW / 2, stepY + 8,
      ]);
      g.fill(COLORS.marble[i % 3]);
    }

    // Main structure walls
    const wallY = -22;
    // Left wall
    g.poly([
      -w / 2 + 5, wallY + (h - 20) / 2,
      0, wallY + h - 20,
      0, wallY + h - 20 - 45,
      -w / 2 + 5, wallY + (h - 20) / 2 - 45,
    ]);
    g.fill(darken(COLORS.wallCream, 0.05));
    // Right wall
    g.poly([
      w / 2 - 5, wallY + (h - 20) / 2,
      0, wallY + h - 20,
      0, wallY + h - 20 - 45,
      w / 2 - 5, wallY + (h - 20) / 2 - 45,
    ]);
    g.fill(darken(COLORS.wallCream, 0.15));

    // Columns (front row)
    const numCols = isZeus ? 6 : 5;
    for (let i = 0; i < numCols; i++) {
      const t = i / (numCols - 1);
      const cx = -w / 2 + 10 + t * (w - 20);
      const cy = wallY + h - 22;
      // Column shaft
      const colScreenX = (cx - 0) * 0.5;
      const colScreenY = cy - 10 + (cx) * 0.25;

      if (damage > 0.5 && Math.random() < damage * 0.5) {
        // Damaged column - broken
        g.rect(colScreenX - 2, colScreenY - 15, 4, 15);
        g.fill(COLORS.columnMarble);
        // Rubble
        g.circle(colScreenX + 3, colScreenY + 2, 3);
        g.fill(darken(COLORS.columnMarble, 0.2));
      } else {
        // Full column
        g.rect(colScreenX - 3, colScreenY - 40, 6, 40);
        g.fill(COLORS.columnMarble);
        // Column cap
        g.rect(colScreenX - 5, colScreenY - 42, 10, 4);
        g.fill(COLORS.columnMarble);
        // Column base
        g.rect(colScreenX - 5, colScreenY - 2, 10, 4);
        g.fill(darken(COLORS.columnMarble, 0.1));
      }
    }

    // Roof (triangular pediment)
    const roofY = wallY - 45;
    g.poly([
      0, roofY - 20,
      w / 2, roofY + 10,
      -w / 2, roofY + 10,
    ]);
    g.fill(roofColor);
    g.stroke({ color: darken(roofColor, 0.2), width: 2 });

    // Damage cracks
    if (damage > 0) {
      this.addDamageCracks(g, w, h, damage);
    }

    container.addChild(g);
    container.y = -50;
  }

  private static drawParthenon(container: Container, damage: number) {
    const g = new Graphics();
    const w = 150;

    // Grand platform
    for (let i = 0; i < 4; i++) {
      const stepW = w + 24 - i * 6;
      const stepY = -i * 4;
      g.poly([
        0, stepY,
        stepW / 2, stepY + 10,
        0, stepY + 20,
        -stepW / 2, stepY + 10,
      ]);
      g.fill(COLORS.marble[i % 3]);
    }

    // Main colonnade
    const colBase = -16;
    const colH = 55;
    for (let i = 0; i < 8; i++) {
      const cx = -55 + i * 16;
      const cy = colBase + 30;
      if (damage > 0.6 && Math.random() < damage * 0.4) {
        g.rect(cx - 2, cy - colH * 0.4, 5, colH * 0.4);
        g.fill(COLORS.columnMarble);
      } else {
        g.rect(cx - 3, cy - colH, 7, colH);
        g.fill(COLORS.columnMarble);
        g.rect(cx - 5, cy - colH - 3, 11, 5);
        g.fill(darken(COLORS.columnMarble, 0.05));
        g.rect(cx - 5, cy - 2, 11, 4);
        g.fill(darken(COLORS.columnMarble, 0.1));
      }
    }

    // Roof structure
    const roofY = colBase - 30;
    // Architrave
    g.rect(-60, roofY + 5, 120, 6);
    g.fill(COLORS.marble[0]);
    // Pediment
    g.poly([
      0, roofY - 20,
      65, roofY + 5,
      -65, roofY + 5,
    ]);
    g.fill(COLORS.roofGold);
    g.stroke({ color: darken(COLORS.roofGold, 0.2), width: 2 });

    if (damage > 0) {
      this.addDamageCracks(g, w, 80, damage);
    }

    container.addChild(g);
    container.y = -70;
  }

  private static drawSmallHouse(container: Container, damage: number) {
    const g = new Graphics();
    const w = 40;
    const h = 25;

    // Walls
    this.drawIsoBox(g, w, h, 20, COLORS.wallCream, darken(COLORS.wallCream, 0.1), darken(COLORS.wallCream, 0.2));

    // Roof
    g.poly([
      0, -28,
      w / 2 + 3, -8,
      0, h / 2 - 8,
      -w / 2 - 3, -8,
    ]);
    g.fill(COLORS.roofTerracotta);
    g.stroke({ color: darken(COLORS.roofTerracotta, 0.2), width: 1 });

    // Door
    g.rect(-3, h / 2 - 12, 6, 10);
    g.fill(COLORS.woodBrown);

    if (damage > 0.3) {
      this.addDamageCracks(g, w, h, damage);
    }

    container.addChild(g);
    container.y = -15;
  }

  private static drawMediumHouse(container: Container, damage: number) {
    const g = new Graphics();
    const w = 60;
    const h = 35;

    this.drawIsoBox(g, w, h, 28, COLORS.wallCream, darken(COLORS.wallCream, 0.1), darken(COLORS.wallCream, 0.2));

    // Roof
    g.poly([
      0, -36,
      w / 2 + 4, h / 2 - 16,
      0, h - 16,
      -w / 2 - 4, h / 2 - 16,
    ]);
    g.fill(COLORS.roofTerracotta);

    // Windows
    g.rect(-8, -10, 5, 5);
    g.fill(0x4FC3F7);
    g.rect(4, -8, 5, 5);
    g.fill(0x4FC3F7);

    // Door
    g.rect(-3, h / 2 - 16, 7, 12);
    g.fill(COLORS.woodBrown);

    if (damage > 0) this.addDamageCracks(g, w, h, damage);

    container.addChild(g);
    container.y = -20;
  }

  private static drawLargeHouse(container: Container, damage: number) {
    const g = new Graphics();
    const w = 70;
    const h = 45;

    // Main structure
    this.drawIsoBox(g, w, h, 35, COLORS.wallCream, darken(COLORS.wallCream, 0.1), darken(COLORS.wallCream, 0.2));

    // Roof
    g.poly([
      0, -44,
      w / 2 + 5, h / 2 - 22,
      0, h - 22,
      -w / 2 - 5, h / 2 - 22,
    ]);
    g.fill(COLORS.roofTerracotta);

    // Balcony columns
    for (let i = 0; i < 3; i++) {
      const cx = -12 + i * 10;
      g.rect(cx, -25, 3, 18);
      g.fill(COLORS.columnMarble);
    }

    // Windows
    g.rect(12, -12, 6, 6);
    g.fill(0x4FC3F7);
    g.rect(-18, -14, 6, 6);
    g.fill(0x4FC3F7);

    if (damage > 0) this.addDamageCracks(g, w, h, damage);

    container.addChild(g);
    container.y = -25;
  }

  private static drawAmphitheater(container: Container, damage: number) {
    const g = new Graphics();

    // Semi-circular seating tiers
    for (let tier = 3; tier >= 0; tier--) {
      const r = 35 + tier * 12;
      const y = -tier * 8;
      g.ellipse(0, y, r, r * 0.5);
      g.fill(COLORS.marble[tier % 3]);
      g.stroke({ color: darken(COLORS.marble[0], 0.15), width: 1 });
    }

    // Stage area
    g.ellipse(0, 5, 25, 13);
    g.fill(COLORS.sand[1]);

    if (damage > 0) this.addDamageCracks(g, 80, 60, damage);

    container.addChild(g);
    container.y = -20;
  }

  private static drawColumn(container: Container, damage: number) {
    const g = new Graphics();

    if (damage > 0.7) {
      // Broken column
      g.rect(-3, -8, 6, 8);
      g.fill(COLORS.columnMarble);
      // Rubble pieces
      g.circle(5, 2, 3);
      g.fill(darken(COLORS.columnMarble, 0.15));
      g.circle(-4, 3, 2);
      g.fill(darken(COLORS.columnMarble, 0.2));
    } else {
      // Base
      g.rect(-6, -2, 12, 4);
      g.fill(darken(COLORS.columnMarble, 0.1));
      // Shaft
      g.rect(-4, -35, 8, 33);
      g.fill(COLORS.columnMarble);
      // Capital
      g.rect(-7, -38, 14, 5);
      g.fill(COLORS.columnMarble);

      if (damage > 0.3) {
        g.moveTo(-2, -20);
        g.lineTo(2, -10);
        g.stroke({ color: 0x9E9E9E, width: 1 });
      }
    }

    container.addChild(g);
    container.y = -10;
  }

  private static drawStatue(container: Container, damage: number) {
    const g = new Graphics();

    // Pedestal
    g.rect(-8, -5, 16, 8);
    g.fill(COLORS.marble[1]);

    if (damage > 0.8) {
      // Toppled statue - rubble
      g.ellipse(6, 0, 5, 3);
      g.fill(darken(COLORS.marble[0], 0.1));
    } else {
      // Figure (simplified)
      g.rect(-3, -30, 6, 25);
      g.fill(COLORS.marble[0]);
      // Head
      g.circle(0, -33, 4);
      g.fill(COLORS.marble[0]);
      // Arms
      g.rect(-8, -25, 5, 3);
      g.fill(COLORS.marble[0]);
      g.rect(3, -22, 6, 3);
      g.fill(COLORS.marble[0]);
    }

    container.addChild(g);
    container.y = -10;
  }

  private static drawMarket(container: Container, damage: number) {
    const g = new Graphics();
    const w = 80;
    const h = 45;

    // Ground area
    g.poly([0, 0, w / 2, h / 2, 0, h, -w / 2, h / 2]);
    g.fill(COLORS.sand[0]);

    // Canopy poles and covers
    for (let i = 0; i < 3; i++) {
      const ox = -20 + i * 20;
      const oy = -5 + i * 3;
      // Poles
      g.rect(ox - 1, oy - 25, 2, 25);
      g.fill(COLORS.woodBrown);
      g.rect(ox + 12, oy - 25, 2, 25);
      g.fill(COLORS.woodBrown);
      // Canopy
      const canopyColor = [0xE53935, 0x1E88E5, 0xFDD835][i];
      g.rect(ox - 3, oy - 28, 18, 5);
      g.fill(canopyColor);
    }

    if (damage > 0) this.addDamageCracks(g, w, h, damage);

    container.addChild(g);
    container.y = -20;
  }

  private static drawAgora(container: Container, damage: number) {
    const g = new Graphics();
    const w = 110;
    const h = 60;

    // Open plaza
    g.poly([0, 0, w / 2, h / 2, 0, h, -w / 2, h / 2]);
    g.fill(COLORS.marble[2]);
    g.stroke({ color: darken(COLORS.marble[2], 0.1), width: 1 });

    // Surrounding colonnades
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cx = Math.cos(angle) * 40;
      const cy = Math.sin(angle) * 20 + 15;
      g.rect(cx - 2, cy - 30, 5, 30);
      g.fill(COLORS.columnMarble);
      g.rect(cx - 4, cy - 32, 9, 4);
      g.fill(COLORS.columnMarble);
    }

    // Central fountain
    g.circle(0, 20, 10);
    g.fill(COLORS.water[0]);
    g.stroke({ color: COLORS.marble[1], width: 3 });

    if (damage > 0) this.addDamageCracks(g, w, h, damage);

    container.addChild(g);
    container.y = -30;
  }

  private static drawBarracks(container: Container, damage: number) {
    const g = new Graphics();
    const w = 80;
    const h = 50;

    this.drawIsoBox(g, w, h, 30, darken(COLORS.wallCream, 0.05), darken(COLORS.wallCream, 0.15), darken(COLORS.wallCream, 0.25));

    // Flat roof
    g.poly([0, -32, w / 2, -32 + h / 2, 0, -32 + h, -w / 2, -32 + h / 2]);
    g.fill(darken(COLORS.roofTerracotta, 0.15));

    // Shield emblem
    g.circle(0, -10, 8);
    g.fill(0xC62828);
    g.stroke({ color: COLORS.roofGold, width: 2 });

    if (damage > 0) this.addDamageCracks(g, w, h, damage);

    container.addChild(g);
    container.y = -20;
  }

  private static drawWall(container: Container, damage: number) {
    const g = new Graphics();

    if (damage > 0.8) {
      // Rubble
      for (let i = 0; i < 5; i++) {
        g.rect(-8 + i * 4, -3 + Math.random() * 3, 5, 4);
        g.fill(darken(COLORS.marble[1], Math.random() * 0.2));
      }
    } else {
      const h = damage > 0.4 ? 18 : 28;
      this.drawIsoBox(g, 30, 15, h, COLORS.marble[1], darken(COLORS.marble[1], 0.1), darken(COLORS.marble[1], 0.2));

      // Stone pattern
      for (let r = 0; r < 3; r++) {
        g.moveTo(-12, -5 - r * 8);
        g.lineTo(12, -5 - r * 8);
        g.stroke({ color: darken(COLORS.marble[1], 0.15), width: 1 });
      }
    }

    container.addChild(g);
    container.y = -10;
  }

  private static drawGate(container: Container, damage: number) {
    const g = new Graphics();

    // Two pillars
    this.drawIsoBox(g, 20, 12, 40, COLORS.marble[0], darken(COLORS.marble[0], 0.1), darken(COLORS.marble[0], 0.2));

    // Arch
    g.arc(0, -25, 12, Math.PI, 0);
    g.fill(COLORS.marble[0]);

    // Gate doors
    g.rect(-8, -25, 7, 20);
    g.fill(COLORS.woodBrown);
    g.rect(1, -25, 7, 20);
    g.fill(darken(COLORS.woodBrown, 0.1));

    if (damage > 0) this.addDamageCracks(g, 40, 30, damage);

    container.addChild(g);
    container.y = -15;
  }

  private static drawFountain(container: Container, _damage: number) {
    const g = new Graphics();

    // Basin
    g.ellipse(0, 0, 14, 8);
    g.fill(COLORS.water[0]);
    g.stroke({ color: COLORS.marble[1], width: 3 });

    // Central pillar
    g.rect(-2, -20, 4, 20);
    g.fill(COLORS.marble[0]);

    // Water spray (top)
    g.circle(0, -22, 5);
    g.fill({ color: COLORS.water[0], alpha: 0.6 });

    container.addChild(g);
    container.y = -5;
  }

  private static drawOliveTree(container: Container, damage: number) {
    const g = new Graphics();

    // Trunk
    g.rect(-2, -15, 5, 18);
    g.fill(0x6D4C41);

    if (damage > 0.7) {
      // Burnt stump
      g.rect(-3, -5, 7, 8);
      g.fill(0x3E2723);
    } else {
      // Canopy (olive green)
      g.circle(0, -22, 14);
      g.fill(0x7CB342);
      g.circle(-8, -18, 10);
      g.fill(0x689F38);
      g.circle(8, -19, 11);
      g.fill(0x558B2F);
    }

    container.addChild(g);
    container.y = -5;
  }

  private static drawCypressTree(container: Container, damage: number) {
    const g = new Graphics();

    // Trunk
    g.rect(-2, -10, 4, 14);
    g.fill(0x5D4037);

    if (damage > 0.7) {
      g.rect(-2, -5, 4, 8);
      g.fill(0x3E2723);
    } else {
      // Tall narrow canopy (cypress shape)
      g.poly([0, -50, 10, -10, -10, -10]);
      g.fill(0x2E7D32);
      g.poly([0, -45, 7, -15, -7, -15]);
      g.fill(0x388E3C);
    }

    container.addChild(g);
    container.y = -5;
  }

  /** Add crack lines and rubble for damage */
  private static addDamageCracks(g: Graphics, w: number, h: number, damage: number) {
    const numCracks = Math.floor(damage * 8);
    for (let i = 0; i < numCracks; i++) {
      const sx = (Math.random() - 0.5) * w * 0.6;
      const sy = (Math.random() - 0.5) * h * 0.6 - 10;
      g.moveTo(sx, sy);
      g.lineTo(sx + (Math.random() - 0.5) * 15, sy + Math.random() * 15);
      g.lineTo(sx + (Math.random() - 0.5) * 10, sy + Math.random() * 20);
      g.stroke({ color: 0x5D4037, width: 1, alpha: damage });
    }

    // Rubble pieces at base
    if (damage > 0.5) {
      const numRubble = Math.floor(damage * 5);
      for (let i = 0; i < numRubble; i++) {
        const rx = (Math.random() - 0.5) * w * 0.8;
        const ry = h * 0.3 + Math.random() * 8;
        const size = 2 + Math.random() * 4;
        g.rect(rx, ry, size, size);
        g.fill(darken(COLORS.marble[1], Math.random() * 0.3));
      }
    }
  }

  /** Create NPC graphic */
  static createNPC(isInfected = false): Container {
    const container = new Container();
    const g = new Graphics();

    const skinColor = 0xFFCC80;
    const bodyColor = isInfected ? 0x76FF03 : randFromArr([0xE53935, 0x1E88E5, 0xFDD835, 0x7B1FA2, 0xF5F5F5]);

    // Shadow
    g.ellipse(0, 2, 5, 3);
    g.fill({ color: 0x000000, alpha: 0.2 });

    // Body
    g.rect(-3, -12, 6, 10);
    g.fill(bodyColor);

    // Head
    g.circle(0, -15, 4);
    g.fill(skinColor);

    // Simple legs
    g.rect(-3, -2, 2, 4);
    g.fill(skinColor);
    g.rect(1, -2, 2, 4);
    g.fill(skinColor);

    container.addChild(g);
    return container;
  }

  /** Create damage number popup */
  static createDamageNumber(amount: number): Container {
    const container = new Container();
    const style = new TextStyle({
      fontFamily: 'serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xFF1744,
      stroke: { color: 0x000000, width: 3 },
    });
    const text = new Text({ text: `-${amount}`, style });
    text.anchor.set(0.5);
    container.addChild(text);
    return container;
  }
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xFF) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xFF) * (1 - amount));
  const b = Math.max(0, (color & 0xFF) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

function randFromArr<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
