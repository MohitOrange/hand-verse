# 🖐 HANDVERSE

**A 3D room you control with your bare hands — plus 10 games — running in your browser with just a webcam.**

Walk around a neon loft by moving an open palm, pinch to grab and throw balls and cubes, see yourself in the magic mirror, switch the mood to disco, and point at any glowing station to jump into a game.

▶ **Play:** https://mohitorange.github.io/hand-verse/

## The games

| | Game | How you play |
|---|---|---|
| 🎈 | **Pop the Balls** | True AR: balls float over your live camera, pop them with any fingertip (both hands, all 10 fingers) |
| 🎨 | **Air Painting** | Pinch to paint glowing 3D strokes in mid-air; hand closer/farther paints in depth; mirror & kaleidoscope symmetry; save a PNG |
| 🏏 | **Cricket** | The bat follows your hand — swing fast as the ball arrives, swing upward to loft it for a six |
| ⚽ | **Football** | Penalty shootout: aim and flick to shoot, then your two hands become goalkeeper gloves |
| 👻 | **Ghost Room** | Dark haunted room; your hand is a flashlight — hold the beam on ghosts, pinch for a UV blast |
| 🎯 | **Shooting Gallery** | Finger-gun blaster: point, tap thumb to finger to fire, make a fist to reload |
| 🏃 | **Neon Run** | Endless runner: hand left/right = lane, flick up = jump, flick down or fist = slide |
| ♟️ | **Chess** | Pinch a piece to lift it, drop it on a glowing square; full rules and a 3-level computer opponent |
| 🎱 | **Carrom** | Slide the striker, pinch and pull back like a slingshot, release to strike |
| 🎳 | **Bowling** | Real rigid-body pin physics: pinch the ball, swing up and let go; full 10-frame scoring |

## Gestures

| Gesture | Does |
|---|---|
| ☝️ Point | Aim / move the cursor |
| 🤏 Pinch (thumb + index) | Click buttons, grab, paint, shoot |
| ✋ Open palm | Walk & turn in the room (palm up = forward, sideways = turn) |
| ✊ Fist | Reload, slide — game specific |

Every button can also be pressed by just holding your fingertip on it. **No face detection is needed — only hands.** There's also a full **mouse + keyboard mode** (WASD, click, drag, wheel).

## Run it locally

The camera needs `https://` or `localhost`:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No build step — plain ES modules. Libraries load from CDNs: [three.js](https://threejs.org) (rendering + bloom), [cannon-es](https://github.com/pmndrs/cannon-es) (room toys and bowling physics), and [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (21-point hand tracking, two hands).

## Project layout

```
index.html          UI shell, import map
css/style.css       all styling
js/main.js          renderer, bloom, room ⇄ game switching
js/hands.js         webcam + MediaPipe → pointer, pinch, gestures, depth, velocity (+ mouse fallback)
js/hand3d.js        renders your hands as glowing 3D skeletons
js/ui.js            hand cursor that clicks HTML buttons, HUD, cards, camera preview
js/lobby.js         the 3D room: physics toys, walking, stations, mirror, mood lights
js/icons.js         procedural 3D models (station icons, chess pieces, ghost)
js/audio.js         synthesised sound effects and ambient music
js/games/*.js       one file per game (+ chess-engine.js)
```

Privacy: the video is processed on your device and never uploaded.
