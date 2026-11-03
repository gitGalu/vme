# Controller review and editor

Run from the VM/E repository root:

```sh
npm run touch-edit
```

Open `http://localhost:8082/`. The main VM/E server is not required.
For a phone/tablet, `npm run touch-edit:https` uses the development certificates
in `certs/`; open `https://<your-computer-address>:8082/` on a device that trusts
the certificate. Override the port with `-- --port 8083`.

## Review current sources

The default page is **Review**. Choose a platform and controller preset. It loads
the actual `custom_controllers` objects from `src/platforms/systems/*.js`
(currently Amiga, DOS and Atari ST), including referenced constants. Review never
reads or writes editor drafts. The source path, content fingerprint and loading
time identify the configuration being inspected. Vite reloads the page after a
source edit; **Reload source** explicitly reloads it too.

Each preview uses the actual `CustomControllerManager`, touch components and
`src/styles/vme.css` in an isolated iframe with its own viewport. This preserves
the runtime's orientation media queries, viewport units and 50 × 50 grid. Device
sizes in CSS pixels are iPhone 390 × 844, iPad 810 × 1080 and Android 412 × 915.
Landscape swaps the dimensions. Large previews scale down to fit the page;
component layout is still calculated at the native dimensions. **Grid overlay**
adds a guide without changing the controls.

Selection, source details and diagnostics live in the sidebar. **Fit to viewport**
is enabled by default: both previews scale to the available width and height,
with scrolling confined to the sidebar. On narrow windows the sidebar sits
below the previews and scrolls independently. The iframe's native device
dimensions stay unchanged. Disable fitting for larger previews with normal page
scrolling; this choice is shared in the URL as `fit=0`. Window resizing and
changing devices/orientations automatically update the scale.

**Fast buttons** are shown by default. They use `UiManager.initFastUI()` and
`initTouchControllerMenu()` with the actual platform definition and VM/E CSS,
including platform-specific additional keys, FFD/REWIND availability and the
custom preset's `hideAdditionalButtons`. The **DISK button** checkbox simulates
a two-disk playlist when checked, or a single disk when unchecked, on platforms
with multidisk support. Both settings are retained in shared links (`fastui=0`
and `disks=2`); existing links specifying three or four disks still open with the
checkbox checked.
FastUI is above the custom overlay, matching VM/E's stacking order. Diagnostics
warn when a fast button overlaps a custom button's rendered bounds.

### Keyboard test

Enable **Keyboard test** directly in Review, then press keys. Matching controls
light up in blue in both preview orientations, including individual halves of
multi-button controls. All matching bindings light up, so repeated assignments
are visible. Keyboard Quickshot/CursorKeys areas show the active direction arrows;
visible platform additional fast keys are included too. Joypad-only bindings do
not have an implicit keyboard assignment in this mode.

Matching prefers physical `KeyboardEvent.code`, distinguishing left/right Shift
and keypad keys, with keyCode/key fallbacks for legacy bindings. Explicitly
required modifiers must be held. This visualizes configuration bindings only:
it does not send physical key events into the mock core or change source data.
Synthetic events from tapping touch controls do not feed back into the test.

Release a key to clear its highlight. Blur, page hiding, preset/view changes,
**Release inputs** and disabling the mode also clear held keys. Form inputs and
selects keep their normal keyboard behavior; click a preview to resume testing
after using one. The mode is retained in shared links as `keyboard=1`.

Use **Copy link** to share a reproducible selection, for example:

```text
http://localhost:8082/?platform=DOS&preset=dos-qj-stunts&device=iphone&orientation=landscape&mode=review
```

Diagnostics report invalid components, missing bindings, unsupported runtime
binding types, duplicate IDs, invalid/out-of-bounds grid areas, suspicious key
codes, invisible controls and mounted-element counts. Overlaps and intentionally
hidden `anywhere` touchpads are informational. Browser exceptions appear as
errors. Warnings do not alter the source configuration.

Tap/drag controls to see keyboard, joypad and mouse events in **Input monitor**.
Desktop mouse gestures are translated to touch events before reaching the real
handlers. Fast-button presses are captured as `fastui-preview` events without
running QUIT, SAVE, emulator commands or input-mode changes. **Release inputs**
cancels active gestures and rebuilds the manager;
the monitor shows any inputs still held. **Download report** exports the current
source identity, findings, rendered bounds, bindings and captured input events.

The preview covers custom controls and touch FastUI, without the desktop toolbar
or an on-screen keyboard. It uses a mock core and an input-target canvas, so
no ROM, WASM, VM/E preferences or IndexedDB are involved. Safe-area insets are
those supplied by the hosting browser, not a simulated iOS notch. Validate
game-specific behavior in the actual emulator.

## Edit and export

**Edit workspace** opens `editor.html` for the same source preset. The editor
starts from the source configuration. **Restore draft** is an explicit action;
opening the editor preserves the existing draft until you change the workspace.
Browser storage keeps one draft, separate from VM/E preferences. **Review source**
returns to source verification; unsaved workspace edits do not modify Review.

Select a **Controller preset** below the platform loader; this selector stays
visible across all tabs. **Config** contains the selected preset's details.
Edit button labels, bindings, options and positions
for portrait/landscape, using iPhone/iPad/square proportions. Preset details have
their own **Save Preset Details** button; element edits use **Update Element**.
The editor's grids remain schematic for positioning; Review provides the real
runtime preview. **Load platform** replaces the workspace; **Undo** restores it.

In **Export**, choose **Current Preset Only** or **All Presets**:

- **Generate JSON** produces text to inspect and copy.
- **Download JSON** generates the current selection and downloads a JSON file.
- For a single preset, replace/add an entry in the platform's
  `custom_controllers.presets` array.
- For all presets, replace the value of the platform's `custom_controllers`
  property with the exported object. Global options such as `focus_defaults`
  and preset options such as `hideAdditionalButtons` are retained.

Export does not write to the platform source file. JSON files and pasted
configurations can be loaded from **Import**; this appends their presets.
Layout variants remain in the editor export; the default variant is also
exported as `layout`/`elements`, which the current VM/E runtime consumes.

## Agent checks

```sh
npm run test:touch-edit
npm run touch-edit:check
# Limit the review or change the artifact directory:
npm run touch-edit:check -- --platform DOS --preset dos-qj-stunts --devices iphone,ipad --orientations landscape,portrait --out build/touch-edit
```

The check command starts its own loopback-only Vite server and isolated headless
Chrome/Chromium profile, then closes both. Install Chrome/Chromium or point
`CHROME_PATH` at its executable. It needs permission to launch a browser and bind
a local port; it does not download browser binaries or require extra npm packages.
Use Node 22.12 or newer, also supported by Vite.

By default it checks every preset on all three devices in both orientations.
Artifacts go to ignored `build/touch-edit/`: one native-size PNG per view and
`report.json` with source fingerprints, static/runtime findings and input traces.
Each run replaces matching screenshots and `report.json`; unrelated files remain.
The JSON's `reports` array identifies exactly which screenshots belong to that run.
Exit code is 1 for errors, browser failures or inputs stuck after end/cancel;
warnings and informational overlaps do not fail the run.

The suite checks deep links, Review's isolation from drafts, editor startup and
explicit draft restoration. For each runtime view it targets controls with touch
start/move/end and cancellation, checks button output and input release, and tests
touchpad taps (including the runtime's delayed mouseup). This tests event routing;
it does not prove every control is reachable under every overlapping touch zone
or works as intended in the game. Review the screenshots too.
The checks also verify platform-dependent FastUI visibility, multi-disk previews
and that pressing any fast button only records a preview action.
Keyboard checks use real browser key events to verify separate button halves,
simultaneous keys, repeat, left/right Shift, iframe focus, blur, form editing,
preset changes and disabling the mode.
Fit checks cover desktop, short laptop and phone windows, iPhone/iPad previews,
both orientations, toggling fit after scrolling and preservation of the native
viewport sizes. `fit-viewport.png` captures the fitted Review layout.

For browser automation, wait for the public readiness promises:

```js
await window.touchEdit.ready;
await window.touchEdit.select({ platform: 'Amiga', preset: 'amiga-worms', device: 'ipad', orientation: 'both' });
const report = window.touchEdit.inspect();
const platforms = window.touchEdit.listPlatforms();
// Inside a preview frame (or frame.html):
await window.touchPreview.ready;
window.touchPreview.gesture(0, 'start', 0.2, 0.5);
window.touchPreview.gesture(0, 'cancel');
window.touchPreview.inspect();
```

`gesture` uses a rendered element index, phase (`start`, `move`, `end`, `cancel`),
relative x/y and optional touch identifier. An anywhere touchpad targets the full
grid. `inspect()` reports both the input trace and currently held inputs. The
editor exposes `window.touchEditor.ready` and `window.touchEditor.inspect()`.
Frame reports include `fastButtons` with IDs, labels, visibility and rendered
bounds. Use `touchPreview.gestureFastButton('fastsave', 'start')` followed by
`touchPreview.gestureFastButton('fastsave', 'end')` to test a preview-only action.
Reports also include `keyboardTest` with pressed physical keys and matching
element/slot IDs. For targeted agent checks, use `touchEdit.select({keyboard:true})`
or frame methods `touchPreview.setKeyboardTest(true)` and
`touchPreview.keyboardInput('keydown', {code:'ArrowLeft', key:'ArrowLeft', keyCode:37})`,
followed by the corresponding `keyup`. These API calls update visual test state;
they do not dispatch DOM keyboard events or emulate game input.

This tool was moved from the sibling `touchEdit` directory. Its standalone Vite
configuration is development-only and excluded from VM/E production/PWA builds.
