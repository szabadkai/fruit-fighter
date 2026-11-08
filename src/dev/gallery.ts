import '@fontsource/bangers';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { crouchPose, standPose, type Pose } from '../render/art';
import { FRUIT_ART } from '../render/bodies';
import { ComicFilter } from '../render/comicFilter';
import { drawFighter } from '../render/fighterRig';
import { INK, v } from '../render/rig';
import type { FighterId } from '../sim/types';
import { createMatch, type Fighter } from '../sim/engine';
import type { MoveId } from '../sim/moves';
import { fighterPose } from '../render/pose';

// Dev page: every fruit in a handful of poses, through the real comic filter.
// http://localhost:5174/gallery.html          (?moves shows key frames of real moves)

const SIZES: Record<FighterId, number> = { banana: 1, watermelon: 1.2, pineapple: 1.08, lemon: 0.95, coconut: 1.05, strawberry: 0.85, apple: 1 };
const FRUITS = Object.keys(SIZES) as FighterId[];

// A real sim fighter frozen in a move, run through the game's pose code.
function moveFrame(action: Fighter['action'], move: MoveId | null, frame: number, charge = 0): (t: number, kind: FighterId) => Pose {
  return (t, kind) => {
    const f = createMatch({ stage: 'cutting-board', stocks: 3, timeLimit: 0, items: false, seed: 1, players: [{ fighter: kind }, { fighter: 'apple' }] }).fighters[0];
    Object.assign(f, { action, move, frame, charge });
    return fighterPose(f, t);
  };
}

const MOVE_POSES: [string, (t: number, kind: FighterId) => Pose, number][] = [
  ['guard', moveFrame('shield', null, 10), 0],
  ['jab', moveFrame('attack', 'jab', 2), 0],
  ['cross', moveFrame('attack', 'jab2', 3), 0],
  ['flurry', moveFrame('attack', 'flurry', 4), 0],
  ['charge', moveFrame('attack', 'haymaker', 8, 30), 0],
  ['haymaker', moveFrame('attack', 'haymaker', 12), 0],
  ['guard shove', moveFrame('attack', 'guardcounter', 4), 0],
];

const BASIC_POSES: [string, (t: number) => Pose, number][] = [
  ['stand', () => standPose(), 0],
  ['crouch', (t) => crouchPose(t), 0],
  ['punch', () => ({ ...standPose(), handF: v(98, -104), gloveF: 1.5, lean: 0.14, bend: 6, mouth: 'shout', anger: 1 }), 0],
  ['kick', () => ({ ...standPose(), footF: v(96, -70), lean: -0.16, mouth: 'shout', handF: v(-30, -132), handB: v(-48, -108) }), 0],
  ['lean back', () => ({ ...standPose(), lean: -0.3, bend: -14, handF: v(-60, -110), mouth: 'grit', anger: 1 }), 0],
  ['hurt 150%', () => ({ ...standPose(), eyes: 'squint', mouth: 'ouch', lean: -0.3, flash: 0.35 }), 150],
];

const POSES: [string, (t: number, kind: FighterId) => Pose, number][] = new URLSearchParams(location.search).has('moves') ? MOVE_POSES : BASIC_POSES;

async function main() {
  await document.fonts.load('40px Bangers');
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  const app = new Application();
  await app.init({ resizeTo: window, resolution, autoDensity: true, antialias: true, background: '#3a7bd5', preference: 'webgl' });
  document.body.appendChild(app.canvas);
  app.stage.filters = [new ComicFilter(resolution)];
  app.stage.filterArea = app.screen;

  const root = new Container();
  app.stage.addChild(root);
  const bg = new Graphics().rect(-2000, -2000, 6000, 6000).fill(0x4b8fe0);
  root.addChild(bg);

  const cellW = 230, cellH = 250;
  const cells: { g: Graphics; fruit: FighterId; pose: (t: number, kind: FighterId) => Pose; percent: number }[] = [];
  POSES.forEach(([name], c) => {
    const label = new Text({ text: name.toUpperCase(), style: { fontFamily: 'Bangers', fontSize: 26, fill: 0xffffff, stroke: { color: INK, width: 5 } } });
    label.anchor.set(0.5, 0);
    label.position.set(170 + c * cellW, 8);
    root.addChild(label);
  });
  FRUITS.forEach((fruit, r) => {
    const label = new Text({ text: fruit.toUpperCase(), style: { fontFamily: 'Bangers', fontSize: 26, fill: 0xffe600, stroke: { color: INK, width: 5 } } });
    label.anchor.set(0, 0.5);
    label.position.set(8, 60 + r * cellH + cellH * 0.55);
    root.addChild(label);
    POSES.forEach(([, pose, percent], c) => {
      const holder = new Container();
      const g = new Graphics();
      holder.addChild(g);
      holder.position.set(170 + c * cellW, 60 + (r + 1) * cellH - 20);
      holder.scale.set(SIZES[fruit]);
      root.addChild(new Graphics().ellipse(holder.x, holder.y + 2, 48 * SIZES[fruit], 9).fill({ color: 0, alpha: 0.3 }));
      root.addChild(holder);
      cells.push({ g, fruit, pose, percent });
    });
  });

  let t = 0;
  let scroll = 0;
  window.addEventListener('wheel', (e) => { scroll = Math.max(0, scroll + e.deltaY); });
  app.ticker.add(() => {
    t++;
    const s = Math.min(app.screen.width / (170 + POSES.length * cellW), 1);
    root.scale.set(s);
    root.y = -scroll;
    for (const c of cells) {
      const p = c.pose(t, c.fruit);
      drawFighter(c.g, FRUIT_ART[c.fruit], p, { percent: c.percent, t });
      c.g.pivot.set(0, -110);
      c.g.scale.set(1 / Math.sqrt(p.squash), p.squash);
      c.g.rotation = p.spin;
      c.g.y = -110 * p.squash;
    }
  });
}

void main();
