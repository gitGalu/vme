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
