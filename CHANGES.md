# Changelog

All notable changes to this project will be documented in this file.

## [0.50] - 2026-01-25

- add PC/DOS (Pentium + SB16 + SVGA) emulation (uses dosbox_pure core) - w.i.p., does not work on GitHub-hosted version

## [0.41] - 2026-01-24

- fixes for keyboard input and image scaling across multiple platforms

## [0.40] - 2026-01-19

- fixed image scaling in the emulator display output
- update all cores (except virtualxt) and nostalgist.js to most recent versions
- ZX Spectrum: add Spectrum 128K, Spectrum +2/+2A/+3 support (incl. AY sound chip)
- ZX Spectrum: add savestates support
- C128: fix aspect ratio
- fix screen corruption on screen resize or rotate (hopefully)
- fix NMB command not working

## [0.30] - 2025-11-11

- add gamepad support in CLI/menus (work in progress)
- UX adjustments in touchscreen and desktop mode

## [0.21] - 2025-10-09

- touch: UX changes (popup options instead of cycling options, button size adjustments)

## [0.20.2] - 2025-10-08

- Amiga: add Worms (1995) custom touch controller

## [0.20.1] - 2025-09-28

- Amiga: add Pinball Illusions custom touch controller
- touch: custom controller fixes

## [0.20] - 2025-09-27

- add support for custom controller schemes in touch mode
- Amiga: add Pinball Dreams / Pinball Fantasies custom touch controller
- add smooth scrolling & mousewheel scrolling to Save Browser and Collection Browser
- visual touch controller adjustments 

## [0.10] - 2025-07-06

- add IBM PC/XT (8088 + CGA) emulation (uses virtualxt core) - w.i.p.
- add PICO-8 emulation (uses retro8 core) - w.i.p.
- add NMB command to boot without media inserted (Atari 800, ZX Spectrum, C64, C128, C264, VIC-20)

## [0.9.8] - 2025-04-14

- desktop: show key mapping tooltip on hover over keyboard mode selector
- improve Collections Browser animations and behaviour
- improve Save Browser animations and behaviour
- use longer captions for GUI buttons (avoid single letters)
- temporarily hide guided tour button
- improve Fast Forward button handling

## [0.9.7] - 2025-02-10

- refine touch keyboard size & appearance
- ZX Spectrum: replace Interface 2 Port Right touchscreen mapping with Q+W+E+R+Space and 1+8+9+B / Deathchase

## [0.9.6] - 2025-02-02

- ZX Spectrum: add joystick emulation on touchscreens (Cursor Joystick, Interface 2 Port 1+2, Q+A+O+P+Space)
- CLI: add CHKFIX command for VM/E app storage data integrity check and repair
- Atari 800: add arrow keys emulation on touchscreens
- CPC: add arrow keys emulation on touchscreens and fixes for keyboard mapping for touchscreens
- fix Save Browser UI and performance issues

## [0.9.5] - 2025-01-26

- CPC: add touchscreen joystick controls support, fix overscan issues
 
## [0.9.4] - 2025-01-18

- desktop: add in-emulation toggle for keyboard modes on emulated computer platforms (joystick vs full keyboard)
- CLI: add BACKUP and RESTORE commands to export and import savestates

## [0.9.3] - 2025-01-15

- Save Browser: clicking on adjacent items scrolls the list instead of selecting them
- Save Browser: preserve selected game on back navigation

## [0.9.2] - 2025-01-13

- Save Browser: display games list before displaying individual savestates

## [0.9.1] - 2025-01-12

- Amiga: add arrow keys emulation on touchscreens
- Amiga: add function keys layer on touch keyboard
- Neo Geo: add the ability to find games by real titles instead of romset filenames
- CLI: add CLEARALL command to wipe all VM/E settings and data

## [0.9.0] - 2025-01-07

- add arcade games emulation (uses MAME 2003-Plus core)
- add lightgun emulation (MAME)
- add the ability to find games by real titles instead of romset filenames (MAME)
- fix multitouch issues in touchscreen mouse emulation

## [0.8.9] - 2024-10-24

- fix touch controls od Android
- add support for loading software through CORS proxies

## [0.8.8] - 2024-10-20

- add Atari 7800 support (uses ProSystem core)
- disable autorun for local files

## [0.8.7] - 2024-10-19

- Save Browser: add platform selection filter
- add Intellivision support (uses freeintv core)

## [0.8.6] - 2024-10-04

- add SNES support (uses snes9x core)
- desktop: display keyboard controls on program launch
- CPC: add zip file support

## [0.8.5] - 2024-09-27

- disabled autorun - user must now press any key to start the emulation
- add ColecoVision support (uses gearcoleco core)
- toast notifications support
- toast notification when the state has been successfully saved

## [0.8.4] - 2024-09-04

- Amiga: fix keyboard input

## [0.8.2] - 2024-08-31

- add option to enable debug mode

## [0.8.1] - 2024-08-28

- Desktop: full screen mode support
- Desktop: pointer lock support (mouse emulation)
- Amiga: use auto crop modes

## [0.8.0] - 2024-08-25

- add initial Commodore Amiga support (uses puae core)
- fix invalid savestate screenshot ratio

## [0.7.7] - 2024-08-21

- print loading progress when downloading files from the Internet
- only enable specific touch control types on specific platforms

## [0.7.6] - 2024-08-20

- Atari 800: CAS format support
- runs in fullscreen PWA mode on Android

## [0.7.4] - 2024-08-08

- add Neo Geo MVS / AES support (uses fbalpha2012_neogeo core)
- Desktop: add Controls button with quick access to special buttons/keys

## [0.7.3] - 2024-08-05 

- Compilations Browser: add restore button to load the most recent savestate
- Touch: fix Quickshot controler issues

## [0.7.2] - 2024-08-04

- bug fixes

## [0.7.0] - 2024-08-03

- add Game Boy Advance support (uses mgba core)
- add Compilations Browser: a new way of loading programs
- CLI: UX changes

## [0.6.1] - 2024-07-21

- add Atari Lynx support (uses handy core)
- VIC20: add touchscreen mode support
- C264: add touchscreen mode support

## [0.6.0] - 2024-07-20

- add Sega Mega Drive / Genesis support (uses genesis_plus_gx core)
- add warning message for unsupported/w.i.p. platforms
- Desktop: add drag&drop support for opening files
- add progress counter when opening vme_import.zip

## [0.5.6] - 2024-06-20

- add PC Engine / TurboGrafx-16 emulation (uses mednafen_pce_fast core)
- ZX Spectrum: disable savestates in GUI (not supported by fuse-libretro core)

## [0.5.5] - 2024-06-20

- disable RGUI hotkey globally
- C64: initial touch & physical keyboard support
- C64: fix joystick mapping for touchscreens
- C64: add F1, RUN/STOP and SPACE quick access buttons in touch mode

## [0.5.4] - 2024-06-19

- Save Browser: fix display when deleting saves
- A5200, GB, GBC, NES and SMS: use Quickshot Dynamic touch controls by default 

## [0.5.3] - 2024-06-17

- Atari 800: initial touch keyboard support
- Atari 800: fix joystick mapping for touchscreens
- Atari 800: fix joystick mapping for physical controllers

## [0.5.0] - 2024-06-07

- Save Browser: initial save state support
- CLI: multiline results by default

## [0.4.4] - 2024-05-21

- Touch: fix Quickshot freeze issue on multitouch events
- add GB and GBC LCD shaders

## [0.4.3] - 2024-05-17 

- Atari 800: add START and OPTION quick access buttons in touch mode
- CLI: add L command to load previously launched program for the selected platform
- CLI: add WIKI command to browse WikiPedia (tm) articles in VM/E CLI

## [0.4.2] - 2024-05-17 

- add Atari 5200 emulation
- Atari 800: fix autoconfig
- Quest Browser: hide touch controls during emulation

## [0.4.1] - 2024-05-16

- Initial (pre)release


