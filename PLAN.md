# FRUIT PUNCH — game plan

A Smash-style platform fighter where fruits brawl, drawn in a loud Marvel vs. Capcom comic-book style. 2–4 players, couch and local network (LAN).

---

## Status (2026-11-04)

| # | Milestone | State |
|---|---|---|
| 0 | Art-style spike | Done |
| 1 | Feel prototype | Done (19 normals, knockback, hitstop, hitbox view) |
| 2 | First playable (couch) | Done: 6 fruits, 2–4 players, keyboards + gamepads, CPUs |
| 3 | LAN | Done: relay in `npm run dev` / `npm run host`, lobby + QR, 3-frame lockstep, desync checksums |
| 4 | Juice | Done: juice meter, supers with cut-ins, menus, character/stage select, results, SFX, music, announcer |
| 5 | Content | Done: 6 fruits, 6 stages (3 hazards, moving platforms, ice), items |
| 6 | Polish & extras | Mostly done: CPU levels 1–9, training mode, replays, keyboard remapping, ledge grabs. Not done: rollback netcode (internet play), gamepad remapping |

See README.md for how to run and play.

---

## 1. Pillars

1. **Smash rules.** Damage is a percentage, knockback grows with it, and you score a KO by knocking the other fruit off the stage. No health bars to drain.
2. **Comic-book loud.** Every hit should feel like an event: hitstop, onomatopoeia, halftone, speed lines, a splash panel when a super lands.
3. **Couch first, LAN second, same code.** Local and network play use one simulation. The network layer only decides where the inputs come from.

---

## 2. Core gameplay

### Rules
- **Ripeness %**: the damage meter. As it climbs, the fruit looks bruised: spots, juice drips, droopy eyes. It reads at a glance, so players don't need to check the HUD.
- **Stocks** (default 3) or **Timed** mode.
- **Blast zones** on all four sides. Crossing one costs a stock and plays a "SPLAT!" splash on the screen edge.

### Knockback (simplified Smash formula)
```
kb = ((p/10 + p*d/20) * (200 / (w + 100)) * 1.4 + 18) * scaling + base
  p = victim % after hit, d = move damage, w = victim weight
```
Hitstun is proportional to kb. Launch angle comes from each move's data, with directional influence (DI) from the victim's stick.

### Controls (Smash-lite, works on a gamepad and on half a keyboard)
| Input | Action |
|---|---|
| Stick | Move / walk / run, aim moves |
| Jump | Jump, double jump (fast-fall by pressing down mid-air) |
| Attack + direction | Neutral / side / up / down attack, on the ground and in the air (aerials) |
| Special + direction | 4 specials. **Up-special is always the recovery move** |
| Shield | Block; shield + direction = dodge / roll |
| Shield + Attack | Grab, then throw with a direction |
| Special + Shield | **Juice Super** (when the meter is full) |

### The MvC twist: Juice Meter
Taking and dealing damage fills a 1-bar **Juice Meter**. Spending it fires a **Super**: the screen freezes, a comic panel cut-in slides across with the fighter's portrait and the super's name, then a cinematic attack plays. A KO with a super gets a **"FRESH SQUEEZED!"** finish card. This is the main thing that gives a Smash game the Marvel vs. Capcom feel.

### Movement (MVP to v2)
- MVP: walk, run, jump, double jump, fast-fall, drop through platforms, shield, dodge.
- v2: ledge grab, wall jump (light fighters only), tech on landing.

---

## 3. Roster

Each fighter's moves come from what that fruit actually is. **MVP ships 2** (one light, one heavy, which covers the widest spread of physics), then grows to 6.

| Fruit | Archetype | Signature moves | Super |
|---|---|---|---|
| **Banana** ("Peel") | Fast rushdown | Side-B: drops a slip peel trap. Up-B: boomerang spin recovery | **Banana Split**: splits in two and attacks from both sides |
| **Watermelon** ("Big Mel") | Heavy grappler | Neutral-B: seed machine-gun. Down-B: ground pound shockwave | **Seed Storm**: screen-filling seed barrage |
| **Pineapple** | Counter / armor | Down-B: spike counter. Crown-spin up-B | **Piña Colada**: tidal wave |
| **Lemon** | Zoner | Acid squirt projectile, sour cloud that slows enemies | **When Life Gives You…**: lemon rain |
| **Coconut** | Tank to glass cannon | Shell roll. Above 100% the shell cracks: faster, takes more knockback | **Coconut Bonk**: falls from the sky |
| **Strawberry** | Tiny combo fighter | Seed shuriken, wall jump | **Jam Session**: sticky jam trap combo |

Joke unlockables for later: **Tomato** ("botanically a fruit") and **Durian** (stink aura).

---

## 4. Stages

| Stage | Layout | Hazard |
|---|---|---|
| **Cutting Board** (MVP) | One flat platform, no extras (Final Destination style) | None, for competitive play |
| **Fruit Bowl** (MVP) | Curved bowl edges with 3 floating platforms | None |
| **Kitchen Counter** | Wide, toaster platform | A **knife** sweeps across now and then |
| **The Blender** | Small, walls tilt | The blades spin up and KO anyone at the bottom |
| **Farmers Market** | Awning platforms that move | A market cart rolls through |
| **Fridge** | Shelves stacked vertically | Freezer section: ice makes the floor slippery |

---

## 5. Art direction: is the MvC look realistic without an artist?

**Yes, mostly.** Two things make it work:

1. **Fruits are simple shapes.** A banana is a curve, a watermelon an ellipse, a lemon a squashed circle. Code can draw them as vector shapes. Nobody has to hand-draw sprite sheets.
2. **The MvC look comes mostly from rendering, VFX and UI.** Thick ink outlines, cel shading, halftone dots, big jagged hit sparks, screaming lettering, angled HUD bars, splash cut-ins. All of that is code and shaders.

### Character tech: cutout rigs
Each fighter is a set of vector parts: body, eyes, brows, mouth, and rubber-hose arms and legs with big cartoon gloves and shoes. A small skeletal system poses the parts, and animations are keyframed poses plus procedural squash & stretch. The eyes and face carry most of the personality, and they're the cheapest part to animate.
- Around 25–30 animations per fighter (idle, walk, run, jump, 12 attacks, 4 specials, hurt, tumble, shield, etc.).
- Animations are pose data in code or JSON. If hand-tuning gets slow, build a small in-game pose editor (it's a debug tool, not a product).

### The comic render stack (applied as shaders and filters)
- **Ink outline**: thick black outline that varies in width, applied to every character layer.
- **Cel shading**: base color, one hard shadow tone, one rim highlight.
- **Halftone**: Ben-Day dots in shadows and backgrounds, with dots that grow toward the dark side.
- **Print imperfections**: slight CMY misregistration offset and a paper grain overlay.
- **Hit FX**: jagged starburst sparks, onomatopoeia text that scales with damage (`POW` → `SQUISH!` → `SPLAT!!` → `PULP'D!!!`), juice splatter particles in the fruit's own color.
- **Impact frames**: 1–2 frames of inverted, high-contrast silhouette on heavy hits. This trick does a lot of the Marvel feel.
- **Hitstop + screen shake + speed lines** on launches, with zoom-punch on KOs.
- **Super cut-in**: screen dims, then a diagonal comic panel with portrait and super name.
- **UI**: angled, chunky HUD bars; a comic font (Bangers or Luckiest Guy, both free/OFL); a character select grid made of comic panels.

### Where real illustration matters: portraits and splash art
Character select portraits and super cut-ins are the only close-up art. Options, cheapest first:
1. Render the in-game rig large in a dramatic pose and run the comic filter over it. Consistent style, costs nothing.
2. AI-generated portraits, cleaned up. Hard to keep a consistent style across 6 characters.
3. **Commission just the ~6 portraits** from an artist. A small, bounded cost, much cheaper than full sprite work, and it's the biggest visual upgrade for the money.

Plan: start with option 1, and decide on option 3 once the game is fun.

### Possible later path: 3D toon
Low-poly fruits in Blender + toon shader + inverted-hull outlines + halftone post-processing (the Guilty Gear Xrd approach). The visual ceiling is higher, but rigging and animation cost much more. Not for the MVP.

---

## 6. Tech stack

### Recommended: TypeScript + PixiJS + Vite, plus a small Node LAN host
- **PixiJS (WebGL)** handles vector shapes, custom filters (halftone, outline, misregistration) and particles well.
- **Joining a LAN game is a URL.** The host runs `npm run host`, the console prints `http://192.168.1.23:3000` plus a QR code, and guests open it in a browser with nothing to install.
- **Gamepad API** in Chrome/Edge handles Xbox/PS/Switch Pro controllers fine.
- **Fast iteration.** Claude can run it in the built-in browser, screenshot it and tune the feel directly.
- Can be wrapped with Tauri/Electron later for a desktop app.
- Drawback: browsers can't use raw UDP, so LAN traffic goes over WebSocket (TCP). On a LAN (1–3 ms ping) this is a non-issue.

### Alternative: Godot 4 (GDScript)
- Native UDP (ENet), LAN discovery via broadcast, native exports, great controller support.
- Drawbacks: every player installs a build, and the iterate-and-verify loop with Claude is slower than in a browser.

**Pick Godot if** you want a native "real game" binary. **Pick web if** you want the fastest path to playing it with friends on the same Wi-Fi.

---

## 7. Architecture: one deterministic simulation

```
inputs[] ──► step(state, inputs) ──► state' ──► renderer (interpolates, adds FX)
   ▲
   ├─ local controllers / keyboard
   ├─ LAN peers (via host relay)
   ├─ CPU players
   └─ replay file
```

- `sim/` is **pure and deterministic**: fixed 60 Hz tick, no rendering imports, no `Math.random`/`Date` (a seeded PRNG lives inside the state), stable iteration order, and fixed-point or integer positions. Same inputs in, same state out, every time.
- The **state is serializable**, so replays, training-mode resets and future rollback netcode come almost free.
- **Frame data is data.** Every move is defined as startup/active/recovery frames, hitboxes per frame, damage, angle, base KB and KB growth. A debug overlay shows hitboxes and hurtboxes.
- The **renderer is cosmetic only.** Screen shake, particles and onomatopoeia never affect the sim.

### Netcode plan
- **LAN v1: delay-based lockstep.** Each client sends its input bitfield every frame, and the host relays it to everyone. All machines run the same sim with 2 frames of input delay (~33 ms, imperceptible on a LAN).
- **Mixed play**: each machine can have several local players (e.g. 2 on the TV + 2 on a laptop).
- **Desync detection** from day one: hash the state every 60 frames and compare across machines.
- **v2: rollback (GGPO-style)** if internet play is ever wanted. The pure, serializable sim already makes it possible.

### Folder layout
```
fruit/
  src/
    sim/        state, step, physics, collision, hitboxes, knockback, fighters/*.ts (frame data)
    render/     rigs, poses/animations, comic filters, fx, camera
    input/      keyboard + gamepad → InputFrame bitfield, remapping
    net/        lockstep session, relay client, desync hashing
    ui/         menus, character select, HUD, results
    audio/
  server/       LAN host: static files + WebSocket relay + QR code
  tools/        pose editor, hitbox viewer (debug only)
```

---

## 8. Milestones

| # | Milestone | Done when | Notes |
|---|---|---|---|
| **0** | **Art-style spike** | One Banana rig idles, walks and punches a dummy on a stage, with outline + halftone + hit spark + onomatopoeia + impact frame | Settles "does the comic look work?" before investing more. **This is the go/pivot decision point** |
| **1** | **Feel prototype** | Two colored boxes fight locally: movement, platforms, one attack, %, knockback, KO, stocks, hitstop, hitbox debug view | Feel is everything in platform fighters, so tune it with boxes first |
| **2** | **First playable (couch)** | Banana vs. Watermelon with full Smash-lite movesets, 2 stages, HUD, gamepads | You can play this with friends |
| **3** | **LAN** | Host/join via URL + QR, lobby, lockstep, desync check, mixed local+remote players | |
| **4** | **Juice** | Juice Meter + supers + cut-ins, title/menu, character select, results screen, SFX + music | Starts to look and sound like a real game |
| **5** | **Content** | +4 fighters, +4 stages, items (Salt Shaker, Peeler, Smoothie heal) | |
| **6** | **Polish & extras** | CPU opponents, training mode, replays, controller remapping, optional rollback | |

### Audio
- SFX: squishes, splats, crunches. Use CC0 libraries (freesound/Kenney) and jsfxr for synthetic hit sounds.
- Music: upbeat funk/big-band loops (MvC energy), royalty-free.
- Announcer: "FRESH SQUEEZED!", "JUICED!", "GAME!". Could be TTS processed through a radio filter.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Game doesn't *feel* good | Milestone 1 tunes feel on boxes before art investment; keep all tuning values in one data file |
| Animation volume (~30 anims × 6 fighters) | Procedural rigs + pose keyframes, squash/stretch automated, pose editor if needed |
| Comic look underwhelms | Milestone 0 spike is the go/pivot point; fallback is commissioning portraits only |
| LAN desyncs | Pure sim rules enforced from day one, state hash checks, replay files to reproduce bugs |
| Scope creep | MVP = 2 fighters, 2 stages, couch + LAN. Everything else is post-MVP |

---

## 10. Open decisions

1. **Stack**: web (recommended) or Godot?
2. **Player count**: 4 max (recommended) or up to 8?
3. **Tone**: goofy-violent (juice splatter, "PULP'D") or family-friendly (stars and sparkles)?
4. **Items**: on by default (Smash party style) or off (competitive)?
