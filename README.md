# VM/E

## VM/E - Virtual Machine / Emulator

Welcome to VM/E, an open-source experimental web-based retrocomputer & classic console emulator.
VM/E leverages the powerful Libretro framework to support a wide range of platforms, ensuring unified experience across them and tailored  for various runtime environments (iPhone/iPad, traditional desktops/laptops, VR/XR headsets).

The scope of the project is to provide features not available in other similiar software. For an initial release I'll focus on these:
- on touchscreens you can expect multiple control schemes inspired by best practices in the mobile game development
- instead of accessing local files, give the ability to provide a list of links to externally hosted software that list can then used for instant loading of programs, games, and demos

Please note that this is a "work in progress," and since the scope of work is (wille be) broad, it is worth keeping up to date with the regularly updated list of issues, changelogs and TODOs / planned features.

## Hosted version

Latest VM/E build is hosted on GitHub Pages.

Please visit [https://gitGalu.github.io/vme/](https://gitGalu.github.io/vme/).

On devices with touch screens (iPhone/iPad, Android smartphones), VM/E must operate in "standalone" mode, which means adding a shortcut to the home screen instead of using the web app directly in a browser tab. Only in this mode it can be comfortably used in full-screen without worrying that standard touch gestures will interfere with the on-screen buttons.

## Modes of Operation

VM/E adapts to various runtime environments and input peripherials, ensuring optimal usability. Below are the different modes in which the emulator will operate.

### MODE A

Designed for users accessing the emulator via a desktop browser with a traditional keyboard setup.

Keyboard is used for navigating the UI and as a joystick / game controller replacement.

Games can also be controlled by a USB or Bluetooth controller.

### MODE B

This mode is tailored for smartphones with touchscreen interfaces. 

Touch controls are used for navigating the UI. In the main interface, the user can input text using both the on-screen keyboard provided by VM/E and the system on-screen keyboard.

Games can also be controlled by a Bluetooth controller (if present).

### MODE B2

Same as above but optimizes the emulator for larger touchscreen devices.

### MODE C

For those who want to start using VM/E in Virtual Reality and Mixed Reality environments (like the Oculus Quest Browser). Uses a standard browser features like floating window, full screen support etc. Requires a Bluetooth game controller.

### MODE T (planned)

Future support for systems without physical keyboard and touch screen input, allowing to *** all the interactions using a USB / Bluetooth game controller.

### MODE X (planned)

A customizable VR/XR experience in "Immersive XR Mode" with features not possible in MODE E, like additional 3D models of emulated devices, support for custom gestures and Quest controllers etc.

## Built using

Libretro https://github.com/libretro

Nostalgist.js https://github.com/arianrhodsandlot/nostalgist

Emsdk https://github.com/emscripten-core/emsdk

Vite https://github.com/vitejs/vite

JSZip https://github.com/Stuk/jszip

Dexie.js https://github.com/dexie/Dexie.js

### Libretro cores used

vice-libretro https://github.com/libretro/vice-libretro

libretro-atari800 https://github.com/libretro/libretro-atari800

a5200 https://github.com/libretro/a5200

fuse-libretro https://github.com/libretro/fuse-libretro

81-libretro https://github.com/libretro/81-libretro

libretro-crocods https://github.com/libretro/libretro-crocods

libretro-fceumm https://github.com/libretro/libretro-fceumm

gambatte-libretro https://github.com/libretro/gambatte-libretro

stella2014-libretro https://github.com/libretro/stella2014-libretro

pce-fast https://github.com/libretro/beetle-pce-fast-libretro

genesis-plus-gx https://github.com/libretro/Genesis-Plus-GX

mgba https://github.com/FunKey-Project/mgba-libretro

fbalpha2012_neogeo https://github.com/libretro/fbalpha2012_neogeo

puae https://github.com/libretro/libretro-uae

virtualxt https://github.com/virtualxt/virtualxt/

retro8 https://github.com/libretro/retro8

### Assets used

https://www.kreativekorp.com/software/fonts/c64/

https://github.com/spartrekus/8bits-fonts

https://github.com/rewtnull/amigafonts/

https://fontstruct.com/fontstructions/show/1592365/pc-engine-super-cd-rom2-system-unused

https://fontstruct.com/fontstructions/show/2066750

## License

The source code license is GPL v3, as described in the LICENSE file.

## Touch controls

There will be multiple control schemes available for both games and other software.
Initially you can use these:

Quickjoy
Great for most joystick-based platform, racing and puzzle games. Left/right movement and up (which was extensively used for jumping in joystick based games) are separated. You can tap or slide between left and right and when emulating dual-button controlls like Game Boy or NES you can also slide between A and B to simulate simultanous press of these both.

Quickshot
Better for games using 8-directional input. Slide your left finger to move.




