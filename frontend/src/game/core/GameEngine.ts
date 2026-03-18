import { Application, Container, Graphics } from 'pixi.js';
import { CityGenerator } from '../city/CityGenerator';
import type { CityData, BuildingData, NPCData } from '../city/CityGenerator';
import { GraphicsFactory } from './GraphicsFactory';
import { ParticleSystem } from '../effects/ParticleSystem';
import { DestructionEffects } from '../effects/DestructionEffects';
import {
  MAP_COLS, MAP_ROWS,
  GodPower, GOD_POWER_INFO, BUILDING_SIZES,
} from '../utils/constants';
import { tileToScreen, screenToTile, tileDistance, randRange, clamp } from '../utils/isometric';

export interface GameStats {
  buildingsDestroyed: number;
  totalBuildings: number;
  casualties: number;
  totalPopulation: number;
  cityName: string;
  selectedPower: GodPower;
  score: number;
}

export class GameEngine {
  private app!: Application;
  private worldContainer!: Container;
  private terrainLayer!: Container;
  private buildingLayer!: Container;
  private npcLayer!: Container;
  private effectsLayer!: Container;
  private uiLayer!: Container;

  private city!: CityData;
  private particles!: ParticleSystem;
  private destructionEffects!: DestructionEffects;

  private buildingGraphics = new Map<number, Container>();
  private npcGraphics = new Map<number, Container>();

  private camera = { x: 0, y: 0, zoom: 1 };
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };

  private selectedPower: GodPower = GodPower.ZEUS_LIGHTNING;
  private cooldowns = new Map<GodPower, number>();
  private shakeFrames = 0;
  private shakeIntensity = 0;

  private score = 0;
  private buildingsDestroyed = 0;
  private casualties = 0;
  private totalPopulation = 0;

  private npcUpdateTimer = 0;
  private fireSpreadTimer = 0;
  private plagueSpreadTimer = 0;

  private onStatsUpdate?: (stats: GameStats) => void;

  async init(canvas: HTMLCanvasElement, onStatsUpdate: (stats: GameStats) => void) {
    this.onStatsUpdate = onStatsUpdate;

    this.app = new Application();
    await this.app.init({
      canvas,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      backgroundColor: 0x87CEEB,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Sky gradient background
    this.drawSkyBackground();

    // World container (panned/zoomed)
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.terrainLayer = new Container();
    this.buildingLayer = new Container();
    this.npcLayer = new Container();
    this.effectsLayer = new Container();
    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.buildingLayer);
    this.worldContainer.addChild(this.npcLayer);
    this.worldContainer.addChild(this.effectsLayer);

    // UI layer (fixed)
    this.uiLayer = new Container();
    this.app.stage.addChild(this.uiLayer);

    // Particle system
    this.particles = new ParticleSystem();
    this.effectsLayer.addChild(this.particles.container);

    // Destruction visual effects
    this.destructionEffects = new DestructionEffects();
    this.effectsLayer.addChild(this.destructionEffects.container);

    // Generate city
    const generator = new CityGenerator();
    this.city = generator.generate();
    this.totalPopulation = this.city.npcs.length;

    // Render city
    this.renderTerrain();
    this.renderBuildings();
    this.renderNPCs();

    // Center camera
    const centerScreen = tileToScreen(MAP_COLS / 2, MAP_ROWS / 2);
    this.camera.x = -centerScreen.x + canvas.clientWidth / 2;
    this.camera.y = -centerScreen.y + canvas.clientHeight / 2;
    this.camera.zoom = 1;

    // Input handlers
    this.setupInput(canvas);

    // Game loop
    this.app.ticker.add(() => this.gameLoop());

    this.emitStats();
  }

  private drawSkyBackground() {
    const bg = new Graphics();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    // Simple gradient - top to bottom
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const r = Math.floor(100 + t * 87);
      const g = Math.floor(181 + t * 41);
      const b = Math.floor(246 - t * 10);
      bg.rect(0, i, w, 1);
      bg.fill((r << 16) | (g << 8) | b);
    }
    this.app.stage.addChild(bg);
  }

  private renderTerrain() {
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = GraphicsFactory.createTerrain(this.city.terrain[r][c]);
        const pos = tileToScreen(c, r);
        tile.x = pos.x;
        tile.y = pos.y;
        this.terrainLayer.addChild(tile);
      }
    }
  }

  private renderBuildings() {
    // Sort buildings by row+col for proper isometric depth
    const sorted = [...this.city.buildings].sort((a, b) => (a.row + a.col) - (b.row + b.col));

    for (const building of sorted) {
      this.createBuildingGraphic(building);
    }
  }

  private createBuildingGraphic(building: BuildingData) {
    // Remove old graphic if exists
    const old = this.buildingGraphics.get(building.id);
    if (old) {
      this.buildingLayer.removeChild(old);
      old.destroy({ children: true });
    }

    const damage = 1 - building.hp / building.maxHp;
    const graphic = GraphicsFactory.createBuilding(building.type, damage);
    const size = BUILDING_SIZES[building.type];
    const centerCol = building.col + size.w / 2;
    const centerRow = building.row + size.h / 2;
    const pos = tileToScreen(centerCol, centerRow);
    graphic.x = pos.x;
    graphic.y = pos.y;

    // Tint based on state
    if (building.onFire) {
      graphic.alpha = 0.9;
    }

    this.buildingLayer.addChild(graphic);
    this.buildingGraphics.set(building.id, graphic);
  }

  private renderNPCs() {
    for (const npc of this.city.npcs) {
      if (npc.dead) continue;
      const graphic = GraphicsFactory.createNPC(npc.infected);
      const pos = tileToScreen(npc.col, npc.row);
      graphic.x = pos.x;
      graphic.y = pos.y;
      this.npcLayer.addChild(graphic);
      this.npcGraphics.set(npc.id, graphic);
    }
  }

  private setupInput(canvas: HTMLCanvasElement) {
    // Pan with mouse drag
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.camera.x += dx;
        this.camera.y += dy;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Zoom with scroll
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp(this.camera.zoom * zoomFactor, 0.3, 3);

      // Zoom towards mouse position
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - this.camera.x) / this.camera.zoom;
      const worldY = (mouseY - this.camera.y) / this.camera.zoom;

      this.camera.zoom = newZoom;
      this.camera.x = mouseX - worldX * newZoom;
      this.camera.y = mouseY - worldY * newZoom;
    }, { passive: false });

    // Left click to use god power
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to world coords
      const worldX = (mouseX - this.camera.x) / this.camera.zoom;
      const worldY = (mouseY - this.camera.y) / this.camera.zoom;

      this.useGodPower(worldX, worldY);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const powerKeys: Record<string, GodPower> = {
        '1': GodPower.ZEUS_LIGHTNING,
        '2': GodPower.POSEIDON_EARTHQUAKE,
        '3': GodPower.POSEIDON_FLOOD,
        '4': GodPower.HEPHAESTUS_FIRE,
        '5': GodPower.APOLLO_PLAGUE,
        '6': GodPower.ARES_METEOR,
        '7': GodPower.HADES_CHASM,
      };
      if (powerKeys[e.key]) {
        this.selectedPower = powerKeys[e.key];
        this.emitStats();
      }
    });

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  selectPower(power: GodPower) {
    this.selectedPower = power;
    this.emitStats();
  }

  private useGodPower(worldX: number, worldY: number) {
    const power = this.selectedPower;
    const info = GOD_POWER_INFO[power];

    // Check cooldown
    const cooldown = this.cooldowns.get(power) || 0;
    if (cooldown > Date.now()) return;

    // Set cooldown
    this.cooldowns.set(power, Date.now() + info.cooldown);

    // Find tile at click position
    const tile = screenToTile(worldX, worldY);

    // Apply effects based on power type
    switch (power) {
      case GodPower.ZEUS_LIGHTNING:
        this.applyLightning(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.POSEIDON_EARTHQUAKE:
        this.applyEarthquake(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.POSEIDON_FLOOD:
        this.applyFlood(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.HEPHAESTUS_FIRE:
        this.applyFire(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.APOLLO_PLAGUE:
        this.applyPlague(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.ARES_METEOR:
        this.applyMeteor(worldX, worldY, tile.col, tile.row, info);
        break;
      case GodPower.HADES_CHASM:
        this.applyChasm(worldX, worldY, tile.col, tile.row, info);
        break;
    }

    this.emitStats();
  }

  private applyLightning(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.destructionEffects.createLightningBolt(wx, wy);
    this.particles.emitLightning(wx, wy);
    this.shakeFrames = 10;
    this.shakeIntensity = 5;

    this.damageArea(col, row, info.radius, info.damage);
    this.damageNPCsInArea(col, row, info.radius, info.damage);
  }

  private applyEarthquake(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.particles.emitEarthquake(wx, wy);
    this.shakeFrames = 60;
    this.shakeIntensity = 12;

    // Emit particles in the area
    for (let i = 0; i < 5; i++) {
      const ox = randRange(-50, 50);
      const oy = randRange(-25, 25);
      this.particles.emitDebris(wx + ox, wy + oy, 0.8);
      this.particles.emitEarthquake(wx + ox, wy + oy);
    }

    this.damageArea(col, row, info.radius, info.damage);
    this.damageNPCsInArea(col, row, info.radius, info.damage);
  }

  private applyFlood(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.destructionEffects.createFloodWave(wx, wy, info.radius);

    // Mark buildings as flooded
    for (const b of this.city.buildings) {
      if (b.hp <= 0) continue;
      const dist = tileDistance(col, row, b.col, b.row);
      if (dist <= info.radius) {
        b.flooded = true;
      }
    }

    this.particles.emitFlood(wx, wy);
    this.damageArea(col, row, info.radius, info.damage);
    this.damageNPCsInArea(col, row, info.radius, info.damage * 0.8);
  }

  private applyFire(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    // Set buildings on fire
    for (const b of this.city.buildings) {
      if (b.hp <= 0) continue;
      const dist = tileDistance(col, row, b.col, b.row);
      if (dist <= info.radius) {
        b.onFire = true;
      }
    }

    this.particles.emitFire(wx, wy, 2);
    this.damageArea(col, row, info.radius, info.damage);
    this.damageNPCsInArea(col, row, info.radius, info.damage);
  }

  private applyPlague(_wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.destructionEffects.createPlagueCloud(_wx, wy, info.radius);

    // Infect NPCs in area
    for (const npc of this.city.npcs) {
      if (npc.dead) continue;
      const dist = tileDistance(col, row, npc.col, npc.row);
      if (dist <= info.radius) {
        npc.infected = true;
        this.updateNPCGraphic(npc);
      }
    }

    this.particles.emitPlague(_wx, wy);
  }

  private applyMeteor(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.destructionEffects.createMeteor(wx, wy);

    // Delay the actual damage by the meteor flight time
    setTimeout(() => {
      this.particles.emitMeteor(wx, wy);
      this.shakeFrames = 30;
      this.shakeIntensity = 15;
      this.damageArea(col, row, info.radius, info.damage);
      this.damageNPCsInArea(col, row, info.radius, info.damage);
      this.emitStats();
    }, 500);
  }

  private applyChasm(wx: number, wy: number, col: number, row: number, info: typeof GOD_POWER_INFO[GodPower]) {
    this.destructionEffects.createChasm(wx, wy, info.radius);
    this.particles.emitChasm(wx, wy);
    this.shakeFrames = 40;
    this.shakeIntensity = 8;

    this.damageArea(col, row, info.radius, info.damage);
    this.damageNPCsInArea(col, row, info.radius, info.damage * 1.5);
  }

  private damageArea(col: number, row: number, radius: number, damage: number) {
    for (const b of this.city.buildings) {
      if (b.hp <= 0) continue;
      const dist = tileDistance(col, row, b.col, b.row);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.5;
        const actualDamage = Math.floor(damage * falloff);
        b.hp = Math.max(0, b.hp - actualDamage);

        // Show damage number
        const size = BUILDING_SIZES[b.type];
        const pos = tileToScreen(b.col + size.w / 2, b.row + size.h / 2);
        this.showDamageNumber(pos.x, pos.y, actualDamage);

        // Update graphic
        this.createBuildingGraphic(b);

        // Emit debris
        this.particles.emitDebris(pos.x, pos.y - 20, falloff);

        if (b.hp <= 0) {
          this.buildingsDestroyed++;
          this.score += b.maxHp;
          // Make NPCs flee from destroyed buildings
          this.makeNPCsFlee(b.col, b.row, radius * 2);
        }
      }
    }
  }

  private damageNPCsInArea(col: number, row: number, radius: number, damage: number) {
    for (const npc of this.city.npcs) {
      if (npc.dead) continue;
      const dist = tileDistance(col, row, npc.col, npc.row);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.5;
        const actualDamage = Math.floor(damage * falloff);
        npc.hp = Math.max(0, npc.hp - actualDamage);

        if (npc.hp <= 0) {
          npc.dead = true;
          this.casualties++;
          this.score += 10;
          // Remove NPC graphic
          const g = this.npcGraphics.get(npc.id);
          if (g) {
            this.npcLayer.removeChild(g);
            g.destroy({ children: true });
            this.npcGraphics.delete(npc.id);
          }
        } else {
          // Make NPC flee
          npc.fleeing = true;
          npc.targetCol = npc.col + (npc.col - col) * 3;
          npc.targetRow = npc.row + (npc.row - row) * 3;
          npc.speed = 0.06;
        }
      }
    }
  }

  private makeNPCsFlee(col: number, row: number, radius: number) {
    for (const npc of this.city.npcs) {
      if (npc.dead) continue;
      const dist = tileDistance(col, row, npc.col, npc.row);
      if (dist <= radius) {
        npc.fleeing = true;
        const dx = npc.col - col;
        const dy = npc.row - row;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        npc.targetCol = npc.col + (dx / len) * 8;
        npc.targetRow = npc.row + (dy / len) * 8;
        npc.speed = 0.05;
      }
    }
  }

  private showDamageNumber(x: number, y: number, amount: number) {
    const dmgText = GraphicsFactory.createDamageNumber(amount);
    dmgText.x = x;
    dmgText.y = y - 30;
    this.effectsLayer.addChild(dmgText);

    let frame = 0;
    const tick = () => {
      frame++;
      dmgText.y -= 1;
      dmgText.alpha = 1 - frame / 40;
      if (frame >= 40) {
        this.effectsLayer.removeChild(dmgText);
        dmgText.destroy({ children: true });
        this.app.ticker.remove(tick);
      }
    };
    this.app.ticker.add(tick);
  }

  private updateNPCGraphic(npc: NPCData) {
    const old = this.npcGraphics.get(npc.id);
    if (old) {
      this.npcLayer.removeChild(old);
      old.destroy({ children: true });
    }
    if (!npc.dead) {
      const graphic = GraphicsFactory.createNPC(npc.infected);
      const pos = tileToScreen(npc.col, npc.row);
      graphic.x = pos.x;
      graphic.y = pos.y;
      this.npcLayer.addChild(graphic);
      this.npcGraphics.set(npc.id, graphic);
    }
  }

  private gameLoop() {
    const dt = this.app.ticker.deltaMS;

    // Update particles
    this.particles.update();

    // Update destruction effects
    this.destructionEffects.update();

    // Screen shake
    if (this.shakeFrames > 0) {
      this.shakeFrames--;
      const intensity = this.shakeIntensity * (this.shakeFrames / 30);
      this.worldContainer.x = this.camera.x * this.camera.zoom + randRange(-intensity, intensity);
      this.worldContainer.y = this.camera.y * this.camera.zoom + randRange(-intensity, intensity);
    } else {
      this.worldContainer.x = this.camera.x * this.camera.zoom;
      this.worldContainer.y = this.camera.y * this.camera.zoom;
    }
    this.worldContainer.scale.set(this.camera.zoom);

    // Update NPCs (every few frames for performance)
    this.npcUpdateTimer += dt;
    if (this.npcUpdateTimer > 50) {
      this.npcUpdateTimer = 0;
      this.updateNPCs();
    }

    // Fire spread
    this.fireSpreadTimer += dt;
    if (this.fireSpreadTimer > 1000) {
      this.fireSpreadTimer = 0;
      this.spreadFire();
    }

    // Plague damage over time
    this.plagueSpreadTimer += dt;
    if (this.plagueSpreadTimer > 500) {
      this.plagueSpreadTimer = 0;
      this.tickPlague();
    }

    // Continuous fire particles
    for (const b of this.city.buildings) {
      if (b.onFire && b.hp > 0) {
        const size = BUILDING_SIZES[b.type];
        const pos = tileToScreen(b.col + size.w / 2, b.row + size.h / 2);
        this.particles.emitFire(pos.x, pos.y - 15, 0.3);
      }
    }
  }

  private updateNPCs() {
    for (const npc of this.city.npcs) {
      if (npc.dead) continue;

      // Move towards target
      const dx = npc.targetCol - npc.col;
      const dy = npc.targetRow - npc.row;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.3) {
        npc.col += (dx / dist) * npc.speed;
        npc.row += (dy / dist) * npc.speed;

        // Clamp to map
        npc.col = clamp(npc.col, 1, MAP_COLS - 2);
        npc.row = clamp(npc.row, 1, MAP_ROWS - 2);
      } else if (!npc.fleeing) {
        // Pick new random target (wander around)
        npc.targetCol = npc.col + randRange(-5, 5);
        npc.targetRow = npc.row + randRange(-5, 5);
        npc.targetCol = clamp(npc.targetCol, 1, MAP_COLS - 2);
        npc.targetRow = clamp(npc.targetRow, 1, MAP_ROWS - 2);
        npc.speed = 0.02 + Math.random() * 0.02;
      } else {
        npc.fleeing = false;
        npc.speed = 0.02;
      }

      // Update graphic position
      const g = this.npcGraphics.get(npc.id);
      if (g) {
        const pos = tileToScreen(npc.col, npc.row);
        g.x = pos.x;
        g.y = pos.y;
      }
    }
  }

  private spreadFire() {
    const newFires: BuildingData[] = [];
    for (const b of this.city.buildings) {
      if (!b.onFire || b.hp <= 0) continue;

      // Damage burning building
      b.hp = Math.max(0, b.hp - 5);
      this.createBuildingGraphic(b);

      if (b.hp <= 0) {
        b.onFire = false;
        this.buildingsDestroyed++;
        this.score += b.maxHp;
        this.emitStats();
      }

      // Spread to nearby buildings
      for (const other of this.city.buildings) {
        if (other.onFire || other.hp <= 0) continue;
        const dist = tileDistance(b.col, b.row, other.col, other.row);
        if (dist < 4 && Math.random() < 0.15) {
          newFires.push(other);
        }
      }
    }

    for (const b of newFires) {
      b.onFire = true;
    }
  }

  private tickPlague() {
    for (const npc of this.city.npcs) {
      if (!npc.infected || npc.dead) continue;

      // Damage infected NPCs
      npc.hp -= 3;
      if (npc.hp <= 0) {
        npc.dead = true;
        npc.hp = 0;
        this.casualties++;
        this.score += 10;
        const g = this.npcGraphics.get(npc.id);
        if (g) {
          this.npcLayer.removeChild(g);
          g.destroy({ children: true });
          this.npcGraphics.delete(npc.id);
        }
        // Plague cloud at death location
        const pos = tileToScreen(npc.col, npc.row);
        this.particles.emitPlague(pos.x, pos.y);
        this.emitStats();
      }

      // Spread to nearby NPCs
      for (const other of this.city.npcs) {
        if (other.infected || other.dead) continue;
        const dist = tileDistance(npc.col, npc.row, other.col, other.row);
        if (dist < 3 && Math.random() < 0.2) {
          other.infected = true;
          this.updateNPCGraphic(other);
        }
      }
    }
  }

  private emitStats() {
    this.onStatsUpdate?.({
      buildingsDestroyed: this.buildingsDestroyed,
      totalBuildings: this.city.buildings.length,
      casualties: this.casualties,
      totalPopulation: this.totalPopulation,
      cityName: this.city.name,
      selectedPower: this.selectedPower,
      score: this.score,
    });
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
  }

  destroy() {
    this.particles.destroy();
    this.destructionEffects.destroy();
    this.app.destroy(true);
  }
}
