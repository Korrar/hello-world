import { Container, Graphics } from 'pixi.js';
import { randRange } from '../utils/isometric';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  gravity: number;
  shrink: boolean;
  graphic: Graphics;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  readonly container = new Container();

  /** Emit fire particles at a position */
  emitFire(x: number, y: number, intensity = 1) {
    const count = Math.floor(5 * intensity);
    const fireColors = [0xFF6F00, 0xFF8F00, 0xFFB300, 0xFF3D00, 0xFFD54F];
    for (let i = 0; i < count; i++) {
      this.addParticle({
        x: x + randRange(-10, 10),
        y: y + randRange(-5, 5),
        vx: randRange(-1, 1),
        vy: randRange(-3, -1),
        life: randRange(30, 60),
        size: randRange(3, 8) * intensity,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        alpha: 0.8,
        gravity: -0.05,
        shrink: true,
      });
    }
    // Smoke
    for (let i = 0; i < count / 2; i++) {
      this.addParticle({
        x: x + randRange(-8, 8),
        y: y - 10,
        vx: randRange(-0.5, 0.5),
        vy: randRange(-2, -0.5),
        life: randRange(40, 80),
        size: randRange(5, 12),
        color: [0x616161, 0x757575, 0x424242][Math.floor(Math.random() * 3)],
        alpha: 0.4,
        gravity: -0.02,
        shrink: false,
      });
    }
  }

  /** Emit debris / rubble particles */
  emitDebris(x: number, y: number, intensity = 1) {
    const count = Math.floor(12 * intensity);
    const debrisColors = [0xBCAAA4, 0xA1887F, 0x8D6E63, 0xF5F5F5, 0xE0E0E0];
    for (let i = 0; i < count; i++) {
      this.addParticle({
        x: x + randRange(-5, 5),
        y: y + randRange(-5, 5),
        vx: randRange(-4, 4),
        vy: randRange(-8, -2),
        life: randRange(30, 60),
        size: randRange(2, 6),
        color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
        alpha: 1,
        gravity: 0.2,
        shrink: false,
      });
    }
  }

  /** Emit lightning flash particles */
  emitLightning(x: number, y: number) {
    // Bright flash
    this.addParticle({
      x, y: y - 20,
      vx: 0, vy: 0,
      life: 8,
      size: 60,
      color: 0xFFFFFF,
      alpha: 0.8,
      gravity: 0,
      shrink: true,
    });

    // Sparks
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(2, 6);
      this.addParticle({
        x: x + randRange(-3, 3),
        y: y + randRange(-3, 3),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randRange(10, 25),
        size: randRange(1, 3),
        color: [0xE1F5FE, 0xFFFFFF, 0xB3E5FC][Math.floor(Math.random() * 3)],
        alpha: 1,
        gravity: 0.1,
        shrink: true,
      });
    }

    // Ground scorch
    for (let i = 0; i < 8; i++) {
      this.addParticle({
        x: x + randRange(-15, 15),
        y: y + randRange(-5, 10),
        vx: randRange(-1, 1),
        vy: randRange(-0.5, 0.5),
        life: randRange(40, 70),
        size: randRange(3, 7),
        color: 0x424242,
        alpha: 0.5,
        gravity: 0,
        shrink: false,
      });
    }
  }

  /** Emit earthquake dust and ground cracks */
  emitEarthquake(x: number, y: number) {
    // Dust clouds
    for (let i = 0; i < 15; i++) {
      this.addParticle({
        x: x + randRange(-30, 30),
        y: y + randRange(-15, 15),
        vx: randRange(-2, 2),
        vy: randRange(-2, 0),
        life: randRange(40, 80),
        size: randRange(8, 20),
        color: [0xBCAAA4, 0xD7CCC8, 0x8D6E63][Math.floor(Math.random() * 3)],
        alpha: 0.5,
        gravity: -0.01,
        shrink: false,
      });
    }
    // Flying stones
    this.emitDebris(x, y, 1.5);
  }

  /** Emit flood/water particles */
  emitFlood(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      this.addParticle({
        x: x + randRange(-20, 20),
        y: y + randRange(-10, 10),
        vx: randRange(-1, 3),
        vy: randRange(-0.5, 0.5),
        life: randRange(60, 120),
        size: randRange(6, 15),
        color: [0x29B6F6, 0x039BE5, 0x0288D1][Math.floor(Math.random() * 3)],
        alpha: 0.6,
        gravity: 0,
        shrink: false,
      });
    }
    // Splash droplets
    for (let i = 0; i < 8; i++) {
      this.addParticle({
        x: x + randRange(-10, 10),
        y: y + randRange(-5, 5),
        vx: randRange(-3, 3),
        vy: randRange(-5, -2),
        life: randRange(15, 30),
        size: randRange(2, 4),
        color: 0x4FC3F7,
        alpha: 0.7,
        gravity: 0.25,
        shrink: true,
      });
    }
  }

  /** Emit plague/disease cloud */
  emitPlague(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      this.addParticle({
        x: x + randRange(-15, 15),
        y: y + randRange(-10, 10),
        vx: randRange(-0.5, 0.5),
        vy: randRange(-1, -0.2),
        life: randRange(60, 120),
        size: randRange(8, 18),
        color: [0x76FF03, 0xAEEA00, 0x64DD17, 0xB2FF59][Math.floor(Math.random() * 4)],
        alpha: 0.4,
        gravity: -0.02,
        shrink: false,
      });
    }
    // Toxic bubbles
    for (let i = 0; i < 4; i++) {
      this.addParticle({
        x: x + randRange(-10, 10),
        y: y,
        vx: randRange(-0.3, 0.3),
        vy: randRange(-1.5, -0.5),
        life: randRange(30, 50),
        size: randRange(3, 6),
        color: 0xCCFF90,
        alpha: 0.6,
        gravity: -0.03,
        shrink: false,
      });
    }
  }

  /** Emit meteor trail and impact */
  emitMeteor(x: number, y: number) {
    // Impact explosion
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(3, 8);
      this.addParticle({
        x: x + randRange(-5, 5),
        y: y + randRange(-5, 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        life: randRange(20, 50),
        size: randRange(3, 10),
        color: [0xFF6F00, 0xFF3D00, 0xFFB300, 0xDD2C00][Math.floor(Math.random() * 4)],
        alpha: 1,
        gravity: 0.15,
        shrink: true,
      });
    }
    // Shockwave ring (simulated with particles)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 2.5,
        life: 20,
        size: 4,
        color: 0xFFCC80,
        alpha: 0.8,
        gravity: 0,
        shrink: true,
      });
    }
    this.emitDebris(x, y, 2);
    this.emitFire(x, y, 2);
  }

  /** Emit chasm/void particles */
  emitChasm(x: number, y: number) {
    // Dark void energy
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randRange(5, 30);
      this.addParticle({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist * 0.5,
        vx: -Math.cos(angle) * 1.5,
        vy: -Math.sin(angle) * 0.75 + 0.5,
        life: randRange(40, 80),
        size: randRange(4, 10),
        color: [0x4A148C, 0x6A1B9A, 0x311B92, 0x1A237E][Math.floor(Math.random() * 4)],
        alpha: 0.7,
        gravity: 0.05,
        shrink: true,
      });
    }
    // Purple flashes
    for (let i = 0; i < 5; i++) {
      this.addParticle({
        x: x + randRange(-15, 15),
        y: y + randRange(-8, 8),
        vx: 0,
        vy: 1,
        life: randRange(10, 20),
        size: randRange(15, 25),
        color: 0xCE93D8,
        alpha: 0.4,
        gravity: 0,
        shrink: true,
      });
    }
  }

  private addParticle(opts: {
    x: number; y: number; vx: number; vy: number;
    life: number; size: number; color: number; alpha: number;
    gravity: number; shrink: boolean;
  }) {
    const g = new Graphics();
    g.circle(0, 0, opts.size);
    g.fill({ color: opts.color, alpha: opts.alpha });
    g.x = opts.x;
    g.y = opts.y;
    this.container.addChild(g);

    this.particles.push({
      ...opts,
      maxLife: opts.life,
      graphic: g,
    });
  }

  /** Update all particles - call each frame */
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;

      const lifeRatio = p.life / p.maxLife;
      p.graphic.x = p.x;
      p.graphic.y = p.y;
      p.graphic.alpha = p.alpha * lifeRatio;
      if (p.shrink) {
        p.graphic.scale.set(lifeRatio);
      }

      if (p.life <= 0) {
        this.container.removeChild(p.graphic);
        p.graphic.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  get particleCount() {
    return this.particles.length;
  }

  destroy() {
    for (const p of this.particles) {
      p.graphic.destroy();
    }
    this.particles.length = 0;
    this.container.destroy({ children: true });
  }
}
