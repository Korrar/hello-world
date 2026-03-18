import { Container, Graphics } from 'pixi.js';
import { GodPower, COLORS } from '../utils/constants';
import { randRange } from '../utils/isometric';

/** Visual overlays for destruction effects (lightning bolts, water waves, chasms) */
export class DestructionEffects {
  readonly container = new Container();
  private effects: { update: () => boolean; cleanup: () => void }[] = [];

  /** Create a lightning bolt effect */
  createLightningBolt(x: number, y: number) {
    const bolt = new Graphics();
    this.container.addChild(bolt);

    // Generate zigzag path
    const segments = 8;
    const points: { x: number; y: number }[] = [{ x, y: y - 300 }];
    for (let i = 1; i <= segments; i++) {
      points.push({
        x: x + randRange(-30, 30) * (1 - i / segments),
        y: y - 300 + (300 * i) / segments,
      });
    }

    let frame = 0;
    const maxFrames = 15;

    const effect = {
      update: () => {
        frame++;
        bolt.clear();

        if (frame > maxFrames) return false;

        const alpha = 1 - (frame / maxFrames) * 0.7;

        // Glow
        bolt.circle(x, y, 40 - frame * 2);
        bolt.fill({ color: 0xE1F5FE, alpha: alpha * 0.3 });

        // Main bolt
        for (let i = 0; i < points.length - 1; i++) {
          const width = 4 - (frame / maxFrames) * 3;
          bolt.moveTo(points[i].x, points[i].y);
          bolt.lineTo(points[i + 1].x, points[i + 1].y);
          bolt.stroke({ color: 0xFFFFFF, width: Math.max(1, width), alpha });

          // Glow around bolt
          bolt.moveTo(points[i].x, points[i].y);
          bolt.lineTo(points[i + 1].x, points[i + 1].y);
          bolt.stroke({ color: 0xB3E5FC, width: Math.max(1, width + 4), alpha: alpha * 0.4 });
        }

        // Branch lightning
        if (frame < 5) {
          for (let i = 2; i < points.length - 1; i += 2) {
            const bx = points[i].x + randRange(-40, 40);
            const by = points[i].y + randRange(-20, 20);
            bolt.moveTo(points[i].x, points[i].y);
            bolt.lineTo(bx, by);
            bolt.stroke({ color: 0xB3E5FC, width: 1, alpha: alpha * 0.6 });
          }
        }

        return true;
      },
      cleanup: () => {
        this.container.removeChild(bolt);
        bolt.destroy();
      },
    };

    this.effects.push(effect);
  }

  /** Create expanding water wave */
  createFloodWave(x: number, y: number, radius: number) {
    const wave = new Graphics();
    this.container.addChild(wave);

    let frame = 0;
    const maxFrames = 120;
    const maxRadius = radius * 32;

    const effect = {
      update: () => {
        frame++;
        wave.clear();
        if (frame > maxFrames) return false;

        const progress = frame / maxFrames;
        const currentRadius = maxRadius * progress;
        const alpha = (1 - progress) * 0.5;

        // Water surface
        wave.ellipse(x, y, currentRadius, currentRadius * 0.5);
        wave.fill({ color: COLORS.water_effect[0], alpha: alpha * 0.4 });

        // Wave crests
        for (let i = 0; i < 3; i++) {
          const r = currentRadius * (0.7 + i * 0.15);
          wave.ellipse(x, y, r, r * 0.5);
          wave.stroke({ color: 0x4FC3F7, width: 2, alpha: alpha * (1 - i * 0.3) });
        }

        return true;
      },
      cleanup: () => {
        this.container.removeChild(wave);
        wave.destroy();
      },
    };

    this.effects.push(effect);
  }

  /** Create ground chasm effect */
  createChasm(x: number, y: number, radius: number) {
    const chasm = new Graphics();
    this.container.addChild(chasm);

    let frame = 0;
    const maxFrames = 180;
    const maxR = radius * 32;

    const effect = {
      update: () => {
        frame++;
        chasm.clear();
        if (frame > maxFrames) return false;

        const openPhase = Math.min(1, frame / 30);
        const closePhase = frame > 150 ? (frame - 150) / 30 : 0;
        const size = openPhase * (1 - closePhase);

        // Dark void
        chasm.ellipse(x, y, maxR * size, maxR * 0.4 * size);
        chasm.fill({ color: 0x1A0033, alpha: 0.9 * size });

        // Purple glow rim
        chasm.ellipse(x, y, maxR * size + 5, maxR * 0.4 * size + 3);
        chasm.stroke({ color: 0xCE93D8, width: 3, alpha: 0.6 * size });

        // Inner glow
        chasm.ellipse(x, y, maxR * size * 0.5, maxR * 0.4 * size * 0.5);
        chasm.fill({ color: 0x4A148C, alpha: 0.5 * size });

        return true;
      },
      cleanup: () => {
        this.container.removeChild(chasm);
        chasm.destroy();
      },
    };

    this.effects.push(effect);
  }

  /** Create earthquake screen shake data */
  createEarthquakeShake(): { offsetX: number; offsetY: number; active: boolean; frame: number; maxFrames: number } {
    return {
      offsetX: 0,
      offsetY: 0,
      active: true,
      frame: 0,
      maxFrames: 60,
    };
  }

  /** Create meteor falling from sky */
  createMeteor(targetX: number, targetY: number) {
    const meteor = new Graphics();
    this.container.addChild(meteor);

    const startX = targetX - 200;
    const startY = targetY - 400;
    let frame = 0;
    const impactFrame = 30;
    const maxFrames = 45;

    const effect = {
      update: () => {
        frame++;
        meteor.clear();
        if (frame > maxFrames) return false;

        if (frame <= impactFrame) {
          const t = frame / impactFrame;
          const mx = startX + (targetX - startX) * t;
          const my = startY + (targetY - startY) * t;

          // Meteor body
          meteor.circle(mx, my, 12 - t * 4);
          meteor.fill(0xFF3D00);

          // Glow
          meteor.circle(mx, my, 20 - t * 6);
          meteor.fill({ color: 0xFFB300, alpha: 0.4 });

          // Trail
          for (let i = 1; i <= 8; i++) {
            const tt = Math.max(0, t - i * 0.02);
            const tx = startX + (targetX - startX) * tt;
            const ty = startY + (targetY - startY) * tt;
            meteor.circle(tx, ty, (8 - i) * 0.8);
            meteor.fill({ color: 0xFF6F00, alpha: 0.5 * (1 - i / 8) });
          }

          // Shadow on ground growing
          meteor.ellipse(targetX, targetY + 5, 10 * t, 5 * t);
          meteor.fill({ color: 0x000000, alpha: 0.3 * t });
        } else {
          // Impact shockwave
          const postT = (frame - impactFrame) / (maxFrames - impactFrame);
          const shockR = postT * 80;
          meteor.circle(targetX, targetY, shockR);
          meteor.stroke({ color: 0xFFB300, width: 3, alpha: 1 - postT });
          meteor.circle(targetX, targetY, shockR * 0.6);
          meteor.fill({ color: 0xFF6F00, alpha: (1 - postT) * 0.3 });
        }

        return true;
      },
      cleanup: () => {
        this.container.removeChild(meteor);
        meteor.destroy();
      },
    };

    this.effects.push(effect);
  }

  /** Create plague cloud spreading */
  createPlagueCloud(x: number, y: number, radius: number) {
    const cloud = new Graphics();
    this.container.addChild(cloud);

    let frame = 0;
    const maxFrames = 200;
    const maxR = radius * 32;

    const effect = {
      update: () => {
        frame++;
        cloud.clear();
        if (frame > maxFrames) return false;

        const spread = Math.min(1, frame / 60);
        const fade = frame > 160 ? (frame - 160) / 40 : 0;
        const alpha = (1 - fade) * 0.35;

        // Multiple overlapping green clouds
        for (let i = 0; i < 5; i++) {
          const ox = Math.sin(frame * 0.05 + i * 1.2) * 15;
          const oy = Math.cos(frame * 0.07 + i * 0.8) * 8;
          const r = maxR * spread * (0.6 + i * 0.1);
          cloud.ellipse(x + ox, y + oy, r, r * 0.5);
          cloud.fill({ color: COLORS.plague[i % 3], alpha: alpha * (1 - i * 0.15) });
        }

        return true;
      },
      cleanup: () => {
        this.container.removeChild(cloud);
        cloud.destroy();
      },
    };

    this.effects.push(effect);
  }

  /** Trigger appropriate effect for a god power */
  triggerEffect(power: GodPower, x: number, y: number, radius: number) {
    switch (power) {
      case GodPower.ZEUS_LIGHTNING:
        this.createLightningBolt(x, y);
        break;
      case GodPower.POSEIDON_FLOOD:
        this.createFloodWave(x, y, radius);
        break;
      case GodPower.HADES_CHASM:
        this.createChasm(x, y, radius);
        break;
      case GodPower.ARES_METEOR:
        this.createMeteor(x, y);
        break;
      case GodPower.APOLLO_PLAGUE:
        this.createPlagueCloud(x, y, radius);
        break;
    }
  }

  /** Update all active effects, returns true if screen should shake */
  update(): boolean {
    let shouldShake = false;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const alive = this.effects[i].update();
      if (!alive) {
        this.effects[i].cleanup();
        this.effects.splice(i, 1);
      }
    }
    return shouldShake;
  }

  destroy() {
    for (const e of this.effects) e.cleanup();
    this.effects.length = 0;
    this.container.destroy({ children: true });
  }
}
