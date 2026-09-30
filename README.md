<p align="center"><img src="icon.png"/></p>

# Starter Kit FPS

This package includes a basic template for a first person shooter in Godot 4.6. Includes features like;

- Character controller
- Weapons, switching weapons
- Enemies
- Sprites and 3D Models _(CC0 licensed)_

### Screenshot

<p align="center"><img src="screenshots/screenshot.png"/></p>

### Controls

| Key | Command |
| --- | --- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Movement |
| <kbd>Spacebar</kbd> | Jump |
| <kbd>Left mouse button</kbd> | Shoot |
| <kbd>E</kbd> | Switch weapon |

### Instructions

1. How to add more weapons?

Duplicate one of the existing resources in the 'weapons' folder, adjust the properties in the inspector. Select the 'Player' node in the scene and add your new resources to the 'Weapons' array.

2. How to adjust properties like cooldown, damage and spread?

Select the resource of the weapon you'd like to change in the 'weapons' folder, adjust the properties in the inspector.

### License

MIT License

Copyright (c) 2026 Kenney

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Assets included in this package (2D sprites, 3D models and sound effects) are [CC0 licensed](https://creativecommons.org/publicdomain/zero/1.0/)

## Arenas

`scenes/menu.tscn` is the entry point: pick **Lockout** or **Beaver Creek** (keyboard, mouse or Xbox pad; View/Tab returns to the menu).
Maps are built from code (`maps/*.gd` on top of `scripts/level_kit.gd`): convex-hull collision only, sealed perimeter, energy barriers on every elevated edge.

Regression test (headless, walks the real player along routes, then fuzzes for stuck/fall-out):

    godot --headless --fixed-fps 60 -s tools/map_test.gd -- lockout
    godot --headless --fixed-fps 60 -s tools/map_test.gd -- beaver_creek

## Players online

The menu shows a live count (top right). It reads from a presence server; with none configured it shows OFFLINE (no fake numbers).

    python3 tools/presence_server.py 8787          # run anywhere reachable
    PRESENCE_URL=http://host:8787 godot --path .   # or set project setting game/presence_url

Each client heartbeats every 20s; sessions expire after 45s.
