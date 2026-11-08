# FRUIT PUNCH!

A Smash-style platform fighter where fruits brawl, drawn in a Marvel vs. Capcom comic style. 2–4 players on one machine (keyboards + gamepads) or across machines on the same Wi-Fi.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — also reachable from other machines on your network
```

**LAN party:** one machine runs the host, everyone else opens the URL it prints (or scans the QR code, shown in the terminal and on the LAN PARTY screen).

```bash
npm run host       # builds, then serves the game + LAN relay on port 8080
```

`npm run dev` also includes the relay, so a dev server works for LAN play too.

## Controls

| | Keys 1 | Keys 2 | Gamepad |
|---|---|---|---|
| Move / aim | W A S D | Arrows | Stick / D-pad |
| Jump | Space | Right Shift / Num 0 | A |
| Punch | J (or F) | , (or Num 1) | X |
| Kick | K (or G) | . (or Num 2) | Y |
| Special | L (or H) | / (or Num 3) | B |
| Shield | I (or Left Shift) | Enter | Bumpers / triggers |
| Pause | Esc / P | | Start |

Keys 1 has two sets of attack keys (J/K/L/I and F/G/H/Left Shift), so one player can use either hand while Keys 2 is in use. Keyboard bindings can be changed in **CONTROLS**.

**Moves**
- **Punch / Kick** alone, or combined with **forward / up / down**, on the ground and in the air (plus **back** in the air). Holding forward+Punch charges a back-hand haymaker, forward+Kick a roundhouse, and holding down+Kick turns the low kick into a two-sided sweep.
- **Jab combo:** keep tapping Punch with no direction: jab → cross → rapid flurry → finisher.
- **Special** + neutral / side / up / down: four fruit-specific specials. **Up-special is your recovery.** After using it you're helpless until you land.
- **Guard (Shield)** raises both gloves and blocks; blocking wears the guard down until it breaks.
  - **Parry:** raise the guard just before a hit lands (6-frame window). It costs no guard and freezes the attacker so you get the first move.
  - **Guard moves:** Shield + Kick is a quick **shove** out of guard; Shield + Punch **grabs** (then Punch pummels, a direction throws); Shield + left/right **rolls**; Shield + down **spot-dodges**; Shield + Jump jumps out of guard.
  - Shield in the air **air-dodges** (with a direction).
- **Juice meter** fills as you deal and take damage. When it's full, **Shield + Special** fires your **SUPER**.
- **Ledges:** fall near the edge of a solid stage to grab it (brief invincibility). Then press toward the stage to climb, Jump/up to jump, Punch/Kick for a getup attack, Shield to roll in, or down/away to let go.
- **Double-tap down** (or down + jump) drops through soft platforms.
- Items (when on): **Smoothie** heals 30%, **Salt Shaker** gets thrown with your next punch, **Peeler** powers up your next 6 punches.

**Training mode:** H toggles hitboxes, R resets, Esc opens the menu.

## The roster

| Fruit | Style | Neutral / Side / Up / Down special | Super |
|---|---|---|---|
| Banana | All-rounder | Peelerang · Banana Rush · Split Spin · Peel Trap | BANANA SPLIT!! |
| Watermelon | Heavy | Seed Gun · Rind Roll (armor) · Melon Bounce · Ground Pound | SEED STORM!! |
| Pineapple | Counter | Spike Shot · Crown Spin · Helicopter · Spike Counter | PIÑA COLADA!! |
| Lemon | Zoner | Acid Squirt · Sour Cloud · Zest Jet · Lemon Drop | LEMON RAIN!! |
| Coconut | Tank (shell cracks at 100%: faster, lighter) | Shell Toss · Shell Roll (armor) · Palm Rocket · Coconut Bonk | COCONUT BONK!! |
| Strawberry | Tiny & fast, triple jump | Seed Shuriken · Berry Dash · Leaf-copter · Jam Trap | BERRY BLITZ!! |

Stages: Cutting Board, Fruit Bowl, Kitchen Counter (knife), The Blender (blades), Farmers Market (moving awnings, cart), The Fridge (icy floor).

## Code map

```
src/sim/        pure deterministic simulation (no rendering, no Math.random/trig)
  engine.ts     match state + step(): movement, attacks, shield/dodge/grab, projectiles, items, hazards, stocks
  moves.ts      shared normals, grab/throws    roster.ts  per-fruit stats, specials, supers
  stages.ts     platforms, moving platforms, hazards    ai.ts  CPU players (also a pure function of state)
  math.ts       deterministic sin/cos/rng
src/render/     cutout rigs, comic shader, fx, HUD, stage + fruit art (bodies/, stages/)
src/scenes/     title/menus/char select/stage select/results/controls (menus.ts), match.ts, lan.ts
src/net/lan.ts  LAN client + lockstep driver (3-frame input delay, desync checksums)
src/input/      keyboards + gamepads, menu input, remapping
src/audio*      synthesized SFX, announcer, procedural music
server/         LAN relay (WebSocket) and the `npm run host` static server
```

The simulation runs the same everywhere from the same inputs, so LAN play only sends inputs, and replays are just the recorded inputs (WATCH REPLAY on the results screen, or LAST REPLAY in the main menu).

Dev pages: `/gallery.html` shows every fruit in several poses; `/stages.html?stage=kitchen` shows each stage with its geometry (H toggles it).
