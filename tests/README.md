Run the archive regression tests in a **fresh isolated browser context**. They use
real IndexedDB and refuse to run when an existing `VME` database is present.

1. Start the normal Vite dev server (`npm run dev`).
2. Open `http://localhost:8080/vme/@fs/<absolute-repository-path>/tests/archive-programs.html`
   in a new isolated context (substitute the repository path).
3. Run `await window.runArchiveTests()` in the browser console.

The suite covers ZIP filtering, CLI member selection/filtering/cancellation with keyboard and touch controls, autoconfig, minimal
M3U bundles, payload deduplication, quicksave isolation, backups, CLI LAST/history,
local history exclusion, and restoring new and legacy saves. The core launch is
captured rather than running WASM. Actual emulation should also be checked manually.
The suite also checks CLI selection with keyboard and touch controls, preserved
result rows and thumbnails, wraparound, filtering, and the LIST/RND commands.
FIND/LIST ordering checks cover tag priorities, regular expressions, directory
reloading/import, and platform changes.
Held on-screen Backspace and selection arrows are checked with mouse/touch input,
cancellation, focus/visibility transitions, loading, and emulator key isolation.
GUI buttons are checked for immediate rapid activations, duplicate releases,
cancelled gestures, disabled state, and absence of queued delayed actions.

Only Atari 800 opts into `archive_program_extensions`. New saves keep the selected
file, or a deterministic ZIP containing a playlist and the selected set's disks.
`launch_core_config._vmeArchive` holds the source ZIP name/hash, full member path,
and payload storage mode (`entry` or `bundle`). VM/E strips private options before
passing configuration to RetroArch. Saves without this metadata retain legacy ZIP
loading. History and LAST store selection metadata only for remote launches.
For disk sets, the marker also retains `diskPaths` (original names) and `launchName`
(the generated playlist alias).
LAST reopens the source ZIP chooser; history replays its recorded member or set.

Atari800 recognises `Disk N`, TOSEC `(Disk N of M)`, `side A/B`, and compact
`(v1,s1)/(v1,s2)` names. Versions and dump tags remain separate. Only contiguous,
unambiguous sets from the same directory are grouped. Known totals must be complete;
without an explicit total, the highest available disk/side number is used.
ZIP sets become one chooser entry and a minimal saved playlist bundle. Direct
images in an imported software directory become a playlist with separately
deduplicated disk references. Both restore their saved disk index; backups retain
the disk payloads and index. The suite mocks the WASM core but checks the actual
launch packaging, IndexedDB storage and RetroArch disk-switch commands.

Run the filename convention checks separately with:
`node tests/atari800-disk-sets.mjs`.

The Jaguar and ColecoVision touch keypad has a standalone browser test page at
`tests/touch-keypad.html` (use the same `/@fs/<repository>/tests/` URL prefix).
Run `await window.runTouchKeypadTests()` to check tap/drag selection, held keys,
keyboard mappings, outside-touch dismissal, cancellation and release when controls are hidden. Use
`window.previewTouchKeypad()` to inspect portrait and landscape layouts.
Pass `'coleco'` to either function to check ColecoVision's keypad and placement.

Application version detection: run `npm run test:app-version`.
VM/E records `package.json`'s version after successful startup in
`VME_INTERNAL.LAST_APP_VERSION`. First launch establishes a baseline; only a higher
numeric version reports an update. Automatic splash playback remains disabled.
`vme:version-checked` on `document` carries `{ currentVersion, previousVersion,
isFirstRun, isUpdate }` in `detail`, for the future splash to consume.

To test in an isolated dev browser, set
`localStorage.setItem('VME_INTERNAL.LAST_APP_VERSION', '0.96')` and reload.
Inspect the startup snapshot using the already loaded VME module (including any
Vite timestamp in its URL):

```js
const moduleUrl = performance.getEntriesByType('resource')
    .find(r => /\/VME\.js(?:\?|$)/.test(r.name)).name;
(await import(moduleUrl)).VME.getVersionInfo();
```

`isUpdate` is true on that launch, then false after another reload. Remove only
that key to test first launch. Use a saved version higher than the current one to
check that a downgrade does not report an update.

The `SPLASH` command is manual and CLI-only: type `SPLASH` and press Enter.
It can be replayed regardless of update state; Escape dismisses it. The renderer
is loaded on demand, honors reduced motion and releases its WebGL resources on close.
Automatic splash playback after an update remains disabled.
The manual caption is `Virtual Machine / Emulator` plus the current version.
Update playback uses `Updated to version` (or its configured-language translation).

To run the browser regression, open the normal VM/E app in a fresh isolated
context, import `tests/splash.browser.js` through the same `/@fs/<repository>/`
prefix as above, and run `await runSplashTests()`. The suite plays the animation,
checks the return to the CLI and repeats it, then intentionally disables WebGL to
check recovery (a WebGL error in the console during that case is expected).

Also run `await runSplashRenderingTests()` with reduced motion disabled. This
checks actual colored pixels in the final WebGL framebuffer while modeling a GPU
that returns NaN for signed `pow` arguments. It catches a black logo even when
the HTML caption, animation timing and close/replay behavior all work.
