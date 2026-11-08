import type { Container, Graphics } from 'pixi.js';
import type { StageDef } from '../sim/stages';
import { v, type EyeMode, type Mouth, type V } from './rig';

// Shared contracts between the generic fighter rig / stage renderer and the per-fruit
// and per-stage art modules.

// --- fighters -------------------------------------------------------------------
//
// Rig space: feet at (0, 0), up is -y, facing right. A standing body spans roughly
// y = -38 (bottom) to y = -194 (top), centered near y = -112. The view scales the whole
// rig by the fighter's size, so every fruit is drawn in this same frame.

export interface Pose {
  bend: number; // belly curvature (bananas bend; round fruits can bulge/tilt)
  lean: number; // radians, + = forward; bends the body and arms at the hips, feet stay put
  spin: number; // whole-rig rotation around the body center (flips)
  squash: number; // 1 = neutral, <1 squashed, >1 stretched (applied by the view)
  bodyY: number; // + lowers the body toward the feet (knees bend to make up the difference)
  handF: V; handB: V;
  gloveF: number; gloveB: number;
  footF: V; footB: V;
  look: V;
  eyes: EyeMode;
  mouth: Mouth;
  anger: number; // 0..1 brow angle
  flash: number; // 0..1 white overlay
  shake: number;
}

// Relaxed low guard: fists out front at belly height, clear of every fruit's face
// (faces span roughly x -5..50, y -160..-90 standing).
export const GUARD_F = v(70, -76);
export const GUARD_B = v(52, -62);

export function standPose(): Pose {
  return {
    bend: 0, lean: 0, spin: 0, squash: 1, bodyY: 0,
    handF: GUARD_F, handB: GUARD_B, gloveF: 1, gloveB: 1,
    footF: v(18, 0), footB: v(-14, 0),
    look: v(1, 0), eyes: 'open', mouth: 'grin', anger: 0.6, flash: 0, shake: 0,
  };
}

// Deep boxer squat: the body drops and curls forward, knees push out, guard stays up.
export function crouchPose(t: number): Pose {
  const b = Math.sin(t * 0.09);
  return {
    ...standPose(),
    bodyY: 26 + b * 1.5, bend: 12, lean: 0.24, squash: 0.96,
    footF: v(42, 0), footB: v(-30, 0),
    handF: v(80, -62 + b * 2), handB: v(60, -52 + b * 2),
    look: v(1, 0.3), mouth: 'grit', anger: 1,
  };
}

export const rot = (q: V, o: V, a: number): V => {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = q.x - o.x, dy = q.y - o.y;
  return v(o.x + dx * c - dy * s, o.y + dx * s + dy * c);
};

// The body bends around this point when leaning.
export const hipPivot = (p: Pose): V => v(0, -40 + p.bodyY);

// Body-local frame for round fruits: (0, 0) is the standard body center (0, cy) moved
// down by bodyY, and the whole frame is rotated by the lean around the hip pivot.
// Draw the body in local coordinates and pass every point through `tf`.
export function leanFrame(p: Pose, cy = -112) {
  const h = hipPivot(p);
  const tf = (x: number, y: number): V => rot(v(x, cy + p.bodyY + y), h, p.lean);
  return { tf, angle: p.lean, center: tf(0, 0) };
}

// Where the generic rig attaches limbs and draws the face, in rig space.
export interface BodyAnchors {
  hipF: V; hipB: V; // leg roots
  shF: V; shB: V; // arm roots
  eyeA: V; eyeB: V; // eyeA = near eye (bigger), eyeB = far eye toward the front
  eyeScale: number; // 1 = banana-sized eyes
  mouth: V;
}

export interface BodyInfo {
  percent: number; // damage, for ripeness/bruises
  t: number; // frame counter, for idle wobble (leaves, juice)
}

export interface FruitArt {
  arms: boolean;
  shoe: number;
  shoeBack: number;
  glove: number;
  gloveBack: number;
  layout(p: Pose): BodyAnchors;
  // Body fill, cel shading, details, then ink outline. Must honor p.flash (white
  // overlay over the body). The rig draws limbs and the face around it.
  drawBody(g: Graphics, p: Pose, a: BodyAnchors, info: BodyInfo): void;
  // Optional extra layer drawn over the face (crowns, hats, leaf caps).
  drawTop?(g: Graphics, p: Pose, a: BodyAnchors, info: BodyInfo): void;
}

// --- stages ---------------------------------------------------------------------
//
// World space: main platform top at y = 0, x centered at 0, y grows downward.
// Design space for backdrops: 1280 x 720, but letterboxing can reveal more, so
// backdrops should cover roughly x -400..1680, y -300..1020.

export interface CameraInfo { x: number; y: number; zoom: number }

export interface StageView {
  backdrop: Container; // design space, behind everything; parallax in update()
  world: Container; // world space: platforms + hazards, drawn under fighters
  front?: Container; // world space, drawn over fighters (steam, glass, foreground props)
  update(frame: number, cam: CameraInfo): void; // move platforms/hazards via platformAt/hazardAt
}

export type StageArtFactory = (def: StageDef) => StageView;
