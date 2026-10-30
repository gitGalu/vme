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

Collection Browser lifecycle and virtualization: in a fresh isolated app page,
import `tests/collection-browser.browser.js` through the `/@fs/<repository>/`
prefix, then run `await runCollectionBrowserTests()`. It covers overlapping opens,
closing during database reads, rapid grid/coverflow switching, distant selections,
bounded grid rendering, and observer/image cleanup. It uses mock storage and does
not import ROMs or change IndexedDB. To use the actual private Atari collection's
thumbnails on the dev server, pass
`{ zipUrl: '/vme/assets/a8_vme_collection.zip', switches: 24 }`.

Collection Browser title search: in a fresh isolated app page, import
`tests/collection-search.browser.js` through the same `/@fs/<repository>/` prefix,
then run `await runCollectionSearchTests()`. It covers grid and coverflow filtering,
case/diacritics and literal queries, no-result launch guards, native editing keys,
selection restoration, view switching, debounce cancellation, the gamepad keyboard,
and launching the matching game. Storage and launches are mocked; no ROMs or
IndexedDB records are changed. Open search with the magnifier, by typing, or with
Y on a gamepad. Enter (including the native search key) applies the latest query
and activates the selected game in one step. Down transfers focus to the cards;
Left/Right and Backspace still edit the search field. On the gamepad, X returns to
the results and A activates a card. Escape/B clears and closes search.

Touch search uses the existing VM/E CLI keyboard instead of the system keyboard.
In a fresh touch-enabled app context, import `tests/collection-touch-search.browser.js`
and run `await runCollectionTouchSearchTests()`. It covers letters/space, Clear,
held Backspace and cancellation, keyboard stacking and layout restoration, single
Enter launch, and returning input to the CLI. Storage and launches are mocked.

Save Browser title search: in a fresh isolated app page, import
`tests/save-search.browser.js` and run `await runSaveSearchTests()`. It checks
matching displayed game names (including archive versions and custom captions),
combined title/platform filters, immediate Enter, no-result guards, gamepad entry,
query/selection restoration after visiting a game's saves, metadata read counts,
screenshot URL reuse/cleanup, and closing during a pending read. Storage is mocked.
Both browsers use `src/ui/BrowserSearch.js`; Save Browser suspends it while showing
individual saves and resumes the filter when returning to the game list.

Save Browser also supports the Collection-style virtual grid. Run
`await runSaveSearchTests({ grid: true })` as well as the default list case. Both
check repeated layout switches, selection/query/platform preservation, game-level
navigation and screenshot URL reuse/cleanup. The chosen layout is remembered.

Save Browser keyboard filter: Tab from cards opens the platform dropdown; Up/Down
preview a platform, Enter applies it, Escape cancels, and either returns focus to
the cards. Search text is retained. `runSaveSearchTests()` covers keyboard ownership
in both layouts and changing layout before the entrance animation completes.

The Save Browser platform dropdown supports typing to narrow options and Backspace
to remove characters. All platforms stays visible and is focused when nothing
matches. Enter applies the preview; Escape cancels it. The query is cleared when
the filter closes. This also works in the gamepad skin's platform-selection panel.
The Save Browser regression covers typed matches, literal/case-insensitive input,
hidden-option navigation, Backspace, cancellation and the unmatched fallback.
