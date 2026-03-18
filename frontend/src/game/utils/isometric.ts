import { TILE_HALF_W, TILE_HALF_H } from './constants';

/** Convert tile coordinates to screen (isometric) position */
export function tileToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * TILE_HALF_W,
    y: (col + row) * TILE_HALF_H,
  };
}

/** Convert screen position to tile coordinates */
export function screenToTile(screenX: number, screenY: number): { col: number; row: number } {
  const col = (screenX / TILE_HALF_W + screenY / TILE_HALF_H) / 2;
  const row = (screenY / TILE_HALF_H - screenX / TILE_HALF_W) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}

/** Distance between two tile positions */
export function tileDistance(c1: number, r1: number, c2: number, r2: number): number {
  return Math.sqrt((c2 - c1) ** 2 + (r2 - r1) ** 2);
}

/** Random float in range */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in range (inclusive) */
export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

/** Pick random element from array */
export function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Ease out cubic */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease in out quad */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Lerp */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
