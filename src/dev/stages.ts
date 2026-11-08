import '@fontsource/bangers';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { standPose } from '../render/art';
import { bananaArt } from '../render/bodies/banana';
import { ComicFilter } from '../render/comicFilter';
import { drawFighter } from '../render/fighterRig';
import { INK } from '../render/rig';
import { STAGE_ART } from '../render/stages';
import { STAGES, STAGE_ORDER, hazardAt, platformAt, type StageId } from '../sim/stages';

// Dev page: one stage at a time with its moving platforms and hazard animating.
// http://localhost:5174/stages.html?stage=kitchen&zoom=0.5&cy=-300   (keys 1-6 switch, H toggles geometry)

async function main() {
  await document.fonts.load('40px Bangers');
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  const app = new Application();
  await app.init({ resizeTo: window, resolution, autoDensity: true, antialias: true, background: '#000', preference: 'webgl' });
  document.body.appendChild(app.canvas);
  app.stage.filters = [new ComicFilter(resolution)];
  app.stage.filterArea = app.screen;

  const params = new URLSearchParams(location.search);
  let id = (params.get('stage') as StageId) || 'cutting-board';
  let showGeo = params.has('geo');
  const root = new Container();
  app.stage.addChild(root);

  let view = STAGE_ART[id](STAGES[id]);
  const world = new Container();
  const fighters = new Container();
  const geo = new Graphics();
  const label = new Text({ text: '', style: { fontFamily: 'Bangers', fontSize: 30, fill: 0xffffff, stroke: { color: INK, width: 6 } } });
  label.position.set(20, 14);

  // a few bananas at the spawn points for scale
  const dummies = STAGES[id].spawns.map(() => new Graphics());
  function build() {
    root.removeChildren();
    world.removeChildren();
    fighters.removeChildren();
    view = STAGE_ART[id](STAGES[id]);
    const def = STAGES[id];
    def.spawns.forEach((s, i) => {
      const g = dummies[i] ?? new Graphics();
      dummies[i] = g;
      drawFighter(g, bananaArt, standPose(), { percent: 0, t: 0 });
      g.position.set(s.x, s.y);
      g.scale.set(i % 2 ? -1 : 1, 1);
      fighters.addChild(g);
    });
    world.addChild(view.world, fighters);
    if (view.front) world.addChild(view.front);
    world.addChild(geo);
    root.addChild(view.backdrop, world, label);
    label.text = `${def.name.toUpperCase()}  (1-6 switch · H geometry)`;
  }
  build();

  window.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= STAGE_ORDER.length) {
      id = STAGE_ORDER[n - 1];
      history.replaceState(null, '', `?stage=${id}`);
      build();
    }
    if (e.code === 'KeyH') showGeo = !showGeo;
  });

  let frame = 0;
  const cam = { x: 0, y: Number(params.get('cy') ?? -300), zoom: Number(params.get('zoom') ?? 0.5) };
  app.ticker.add(() => {
    frame++;
    const sw = app.screen.width, sh = app.screen.height;
    const scale = Math.min(sw / 1280, sh / 720);
    root.scale.set(scale);
    root.position.set((sw - 1280 * scale) / 2, (sh - 720 * scale) / 2);
    world.pivot.set(cam.x, cam.y);
    world.scale.set(cam.zoom);
    world.position.set(640, 360);
    view.update(frame, cam);

    const def = STAGES[id];
    geo.clear();
    if (showGeo) {
      def.platforms.forEach((_, i) => {
        const p = platformAt(def, i, frame);
        geo.moveTo(p.x - p.w / 2, p.y).lineTo(p.x + p.w / 2, p.y).stroke({ width: 4, color: p.solid ? 0xff2020 : 0x20ff60 });
      });
      const h = hazardAt(def, frame);
      for (const b of h?.hitboxes ?? []) geo.circle(b.x, b.y, b.r).stroke({ width: 3, color: 0xff00ff });
      const bz = def.blast;
      geo.rect(bz.left, bz.top, bz.right - bz.left, bz.bottom - bz.top).stroke({ width: 4, color: 0xffffff });
    }
  });
}

void main();
