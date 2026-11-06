# VM/E Collection Builder

Run from the VM/E repository root:

```sh
npm run collection-builder
```

Open `http://127.0.0.1:8083/`. This starts a separate development server; the
main VM/E app is not required. `npm run collection-builder:https -- --host`
uses the existing certificates in `certs/` for testing on another device.
The port can be changed with `-- --port 8084`.

## Import and search

**Import catalogs** accepts multiple files:

- `vme_import.zip`: imports software JSONs referenced by `vme_import.json`, with
  platform IDs from that manifest. Dependencies/BIOS files are not exported.
- Standalone `CORSFILEv1` software JSONs (also `.software` files): choose the
  platform in the import dialog if the file does not declare one. Other imports
  do not show this dialog; cancelling it skips that file.
- Existing `*_vme_collection.zip` archives or collection JSONs: searches their
  entries too. Embedded images and game files can be reused when the ZIP is
  available. **Use as draft** replaces the current list with that collection.

The workspace has two input tabs: **Paste a list** and **Search catalogs**.
One shared **Platform** selector scopes catalog searches and unprefixed list
titles. Explicit platform prefixes on individual lines take precedence.

Search matches title, original filename and tag, ignoring case and accents.
**More filters** contains Catalog and Tag. Each control is shown only when
there is more than one relevant choice for the selected platform. Results are paginated so
large source lists do not create hundreds of thousands of DOM rows. Common
documentation/image files are hidden from game results. Distinct game versions
stay separate; filenames and tags remain visible when choosing a variant.

Catalog source files and the collection draft are stored in this tool's own
`VME_COLLECTION_BUILDER` IndexedDB database and restored after reopening the
page. VM/E's own imported directories and database are not changed. To use a
catalog already imported into VM/E, select its source ZIP/JSON in this tool too.
The original source archives remain local to the browser; they are not uploaded
to the development server. The server is used only for selected URL downloads.

## Build from a pasted program list

**Copy prompt** copies a Polish prompt for requesting a compatible list from an
assistant. Its full platform ID/name list is generated from VM/E's current
registry. If the browser blocks clipboard access, the tool offers selectable
prompt text for manual copying.

Select **Paste a list** and paste one request per line:

```text
amiga | Lemmings | WHDLoad
dos | Doom
atari800 | Bruce Lee
nes | Super Mario Bros. (World).nes
```

The format is `platform | title | optional variant`. Tab-separated columns also
work. You can paste only titles and choose the shared **Platform**, or leave it
at **All platforms**. IDs, registered platform names and
common aliases (`a8`, `Atari ST`, `MS-DOS`, `Genesis`, etc.) are recognized.
Empty lines, `#`/`//` comments, bullet/number prefixes and an optional
`platform | title | variant` header are ignored. Up to 2,000 programs can be
matched at once.

**Match list** searches the imported catalogs and immediately updates the shared
collection list, without downloading program data. It scans the library once
for the entire list and reports:

- **matched**: a complete release selected automatically, including titles with many TOSEC versions;
- **ambiguous**: matches on different hardware platforms or several different expanded titles; choose the intended program;
- **missing**: no exact normalized title or filename match;
- **blocked**: only incomplete or ambiguous disk sets;
- **invalid**: a malformed request or an unknown/disabled platform;
- **duplicate**: the same chosen game is requested again; included once;
- **excluded**: a request removed from the collection; omitted from the build.

Resolved games and unresolved requests appear together, instead of a separate
match-results table and a second selected-games list. Expand **Change version**
for release choices, source filenames and matching reasons. Image actions live
under **Image**, and editable metadata/files under **Edit details**.

Matching ignores capitalization, punctuation, accents and spacing, handles
WHDLoad names and `Title, The` ordering, and recognizes complete disk sets as a
single candidate. It also equates canonical multi-letter Roman sequel numbers
and Arabic numbers (`II`/`2`, `IV`/`4`, etc., through 39). Single-letter `I`, `V`
and `X` require a part/episode/chapter/volume label, so a name such as `Mega Man X`
does not automatically become `Mega Man 10`.

When no full title/numeral match exists, a generic fallback compares shortened
and expanded names. It recognizes a subtitle after `:` or a spaced dash, or a
continuation starting with a connector such as `in`, `and`, `of` or `the`. The
shorter name needs at least two meaningful terms and must retain all sequel
numbers. For example, a title ending in `in the Space Adventure` can match its
shorter base name. There is no table of aliases or exceptions for specific
games. Several different expanded titles sharing a base remain **ambiguous**;
they are not treated as release variants of one game. Exact title matches take
precedence over this fallback, and reports record `matchedVia: numeral` or
`matchedVia: shortened` with the reason.

It does not use arbitrary fuzzy similarity to silently pick a different game or
sequel. A full source filename selects a specific release and is not expanded
through shortened-name matching; the third column narrows matches by words in
the filename, title, tag or source name.

Each **missing** request has a prefilled search field. Edit the title (for
example, shorten `Zool: Ninja of the Nth Dimension` to `Zool`) and press Enter
or **Find**. A compact list below the field shows matching catalog filenames,
tags, sources and disk counts. **Use** resolves that request and adds the chosen
game to the collection. Searches stay within the request's platform, or all
supported platforms if none was specified. Results are paged in groups of 20
catalog entries. Incomplete or ambiguous disk sets cannot be used.

The original request remains in the report alongside the manual search choice.
The choice is preserved when matching the list again and after restoring the
workspace; selecting the same game twice still includes it only once. Unused
search text/results are also saved with the draft.

The sidebar's **Prefer WHDLoad (Amiga)** checkbox adds an Amiga-only preference
after completeness and bad-dump/prerelease checks, before the remaining TOSEC
criteria. WHDLoad is recognized from tags, filenames, source names or URL paths.
When no eligible WHDLoad candidate exists, normal release selection applies.
Explicit filenames, variant filters and manual version choices still take
precedence. After changing the checkbox, click **Match list** to update existing
matches; **Build ZIP** also refreshes a pending list. The preference is saved
with the workspace and retained for new collections. With it off, the existing
ranking below applies, including the catalog's own tag priorities.

For a title within one platform, the tool automatically ranks **all** available
releases using policy `tosec-v1`, in this order:

1. Complete, unambiguous disk sets; incomplete/uncertain sets are ineligible.
2. No bad-dump `[b]` flags, then regular releases before demo/beta/preview/shareware builds.
3. Fewer hack, modification, trainer, translation or fix flags (`[h]`, `[m]`,
   `[t]`/`[t+3]`, `[tr]`, `[f]`). Cracking tags (`[cr ...]`) alone are neutral.
4. Verified `[!]` dumps, then ordinary dumps before alternative `[a]` dumps.
5. The imported catalog's tag priorities, matching VM/E (for example WHDLoad
   above untagged Amiga entries, or DOS above `WIN` when the catalog declares it).
6. English/international metadata before unspecified or other language tags.
7. Game packages before distributions explicitly marked as installers.
8. Newer declared release years, then version/revision numbers compared
   numerically (`1.10 > 1.9`). Unspecified years are ranked below declared years.
9. A stable filename/source/URL order for otherwise equivalent releases.

For multi-disk games the ranking checks the flags of every disk. The result is a
metadata preference, not a claim that the emulator has tested that release.
Explicit filenames and variant filters are applied **before** ranking, so a
requested French release or a particular dump is retained. The results and
report record the chosen release, preference data, policy and reason. You can
override it with the dropdown; manual choices are recorded as such.

The tool evaluates all matching releases even when the displayed candidates are
limited to the best 500 (100 initially visible per dropdown). Adding `WHDLoad`,
a year, language or release tag can narrow the options. When no platform is
specified and a title exists on multiple platforms, the tool asks for the
platform instead of choosing hardware arbitrarily.

Rematching updates games associated with the pasted requests while preserving
manually added games, explicit release choices and edits for unchanged games.
Changing a release keeps its custom title/description/artwork but uses the new
release's ROM. Replacing a requested title with a different game does not copy
the previous game's metadata. **New collection** starts a fresh game list,
name and cover while retaining imported catalogs and output/context preferences.

The single **Build ZIP** action can match a newly pasted list, apply the resolved
games, download missing images (optional), and build the archive in one action.
Unresolved rows remain in the report and do not block the available games.
The sidebar is the only place for output options: collection name, **Game files**
or **Links only**, and **Download missing images** (enabled by default). ID is
generated from the name; ID editing and an optional cover are under **Collection
details**. Choose **Game files** to download the programs, or **Links only** to
write their URLs without checking network availability. **Match list** lets you
review or override automatically selected versions before building.

When building from the UI, failed game downloads are reported and skipped while
other games continue. A multi-disk game is included only after **every** disk
downloads successfully; no partial disk set or orphan image is exported. If all
downloads fail, no empty collection is generated, and the failure report is
still available. **Cancel** stops matching, image downloads or file export and
does not return a partial ZIP. The one contextual **Cancel** button stops the
active matching/image/export operation. The agent API's lower-level `export()`
retains strict behavior unless `allowMissing` is explicitly enabled.

**Download report** saves a JSON report, including the original line numbers,
requests, chosen candidates, unresolved rows and download errors. The same
report is included as `collection_report.json` in a list-built ZIP; VM/E ignores
the extra file when importing. Matching outcomes and file download outcomes have
separate counts. The pasted list, choices and latest report persist with the
draft, so missing programs can be reviewed or retried after reopening the tool.

## Build a collection

1. Click **Add** beside games. Re-adding the same source/URL on the same platform
   does not duplicate it.
2. Use ↑/↓ to reorder the collection or × to remove an entry.
3. Expand **Edit details** to edit metadata or attach a local game file. Artwork
   and uploads are under **Image**; disk lists are under **Version / files**.
4. Enter a collection name. Its generated ID determines the output filename.
5. Choose the output and image option in the sidebar, then click **Build ZIP**.

**Links only** writes each entry's original HTTP(S) URL and omits game payloads.
The export does not download games. An entry imported from a file-only collection
needs a URL before it can be exported in this mode; local filenames are not
converted into invented links. The current VM/E importer downloads these URLs
when importing the collection.

**Game files** embeds attached files or files from imported collection
ZIPs, and downloads selected remote entries through the local server. URLs are
assembled exactly as VM/E does (`root + bases[index] + item[2]`) to preserve
encoded archive-member paths. Downloads use public HTTP(S) access without browser
login cookies. If a download is unavailable, attach the local game file instead.
Failures skip the affected whole game and are recorded in the report; **Cancel**
stops the build without producing a partial archive.

Both modes produce `<id>_vme_collection.zip` with a root `vme_collection.json`,
collection cover and per-game images, as required by VM/E's existing importer.
Embedded assets use unique paths even when two games share a launch filename.
The original launch filename and chosen entry order are retained. Single-file
games use `file` or `url`. Multi-disk games use an ordered `disks` list described
below, preventing the importer from choosing only the first disk.

Existing images are reused. Uploaded images are converted to PNG. Missing images
receive generated title/platform cards, so the ZIP is immediately importable.

## Built-in VM/E import tester

Every generated ZIP is checked before it is offered for download. The tool and
`PlatformManager.loadCollectionFile` use the **same** import pipeline in
`src/utils/CollectionImport.js`, with the actual registered platform definitions.
The tester supplies temporary memory storage instead of the VM/E database.

For embedded files it checks ZIP integrity/CRC, the root manifest, supported
platform IDs, readable cover/game images, non-empty program files, and complete
multi-disk bundle/M3U preparation. A successful result says **Current-source
archive check passed** with the checked game count. A failure prevents the automatic ZIP
download.

The tester runs the current working sources, including changes that have not
been published. It also checks compatibility with the earlier manifest format,
whose importer requires a `file` or `url` for every game. A game expressed only
as `disks` requires the updated importer: the result is **Updated VM/E required**,
with the first incompatible game and platform, and `partial` in the report even
if all current-source checks pass. The affected games are marked **Needs
attention**. A full linked download test cannot remove this compatibility
warning. Update/deploy VM/E to use these collections. The tool does not execute
or detect the installed/published VM/E version. Rebuild archives with results
from older testers to obtain the compatibility check.

The result appears in **Last ZIP import test**, immediately below the build
status in the sidebar. Errors include the stage, game number/title/platform and
the relevant ZIP path or URL; disk errors include the disk number. The affected
game is marked **Needs attention**, with its file details expanded. **Import
details** shows the execution trace. The latest result is included under
`importTest` in **Download report**, and survives reopening the tool. The ZIP's
own `collection_report.json` is the earlier matching/export report; test results
are not injected into the already-tested archive.

For **Links only**, the automatic check validates structure and local assets
without downloading program payloads. It explicitly reports linked files as
**untested**, rather than claiming a full import pass. **Test import · downloads
linked files** then runs the complete importer with direct browser downloads,
matching VM/E's collection import network path. It checks HTTP errors, empty
files, HTML responses and browser/CORS failures. This uses the tool's current
browser origin, recorded in the report. The game-file export proxy is deliberately
not used by the import tester. **Cancel** stops a running test. After reopening
the tool, rebuild the ZIP before running a full linked test again; generated
archive bytes are not duplicated into persistent storage.

The tester checks collection import and asset preparation. BIOS/core dependency
availability is deliberately bypassed and listed as untested. Actual database
quota/writes and game startup are also untested; no emulator runs and no VM/E
collection is saved. Normal VM/E imports still check installed dependencies and
write to their real storage. Their errors now carry the same stage/game/file
context, including failures during the storage step.

## Screenshots and artwork

With **Download missing images** checked, **Build ZIP** looks up every selected game in VM/E's local
`src/thumbnail-index` files and downloads matched artwork from the same libretro
mirror as the running app. It prefers a gameplay screenshot, then a title
screen, then a box art; failed downloads can fall back to the next available
type. Existing uploaded/downloaded images and images included in an imported
collection are skipped. The summary reports downloaded, existing, unmatched and
failed entries. **Cancel** keeps completed downloads and stops the remaining
work. Game files are never downloaded by these image actions.

For individual review, expand **Image** on a game and click **Find images**, then choose
**Screenshot**, **Title screen** or **Box art** from its indexed matches. This
explicit choice can replace an existing image. The source filename and link
are shown with a larger preview. You
can also upload an image manually, remove a downloaded image, or return to the
image included in the source collection.

Platform names, CDN repository URLs (including the Atari 8-bit override) and
name matching come from VM/E. The matcher supports filename tags, WHDLoad names,
multi-disk members and the chosen display title. It uses indexed filenames;
it does not guess unavailable image URLs or use fuzzy title matching. A
platform needs both a configured source and a populated local index to match.
An unmatched game retains its existing image or generated title card.

Downloaded artwork is decoded and converted to PNG before it replaces an image.
The image and its source choice persist in the browser draft. Both export modes,
including **Links only**, embed the chosen image in the collection ZIP; its
display in VM/E does not depend on the image server remaining available.

Exports are built in browser memory. Original catalogs remain intact, and no
archive is downloaded until the complete export succeeds.

## Multi-disk games

The tool reads `multidisk` and core IDs from VM/E's registered platforms and
reuses `DiskSetBuilder` (Amiga/ST/CPC/Apple II) and `Atari800DiskSets` (Atari 800).
The current supported platforms are Amiga, Atari 800, Atari ST, CPC and Apple II.
Selecting either disk adds the whole ordered set as **one game**. Other selected
members show **Added**, so clicking the other disk cannot duplicate the game.
Catalog rows still show individual source filenames and their detected set.

Both search results and the selected game show the disk count; expand the game's
version details for the ordered disk list. Missing disks and ambiguous
variants block export. Grouping stays within the imported catalog and platform;
the existing VM/E matching rules retain edition/chipset/dump distinctions.
For Atari, inferred counts have the same limits as VM/E: without an explicit
total the tool cannot know about disks beyond the highest listed disk/side.

The editor offers a URL and optional local replacement for each disk. A ZIP
representing one disk must contain exactly one supported disk image (readme and
image files are ignored). Existing complete game ZIPs remain ordinary single
files; the tool does not recursively expand every game archive while searching.

Each multi-disk collection item has a `.zip` filename and an ordered `disks`
array instead of a top-level `url` or `file`:

```json
{
  "title": "My game",
  "platform_id": "amiga",
  "filename": "My game.zip",
  "image": "images/0001.png",
  "disks": [
    { "filename": "My game (Disk 1 of 2).adf", "url": "https://example.org/disk1.adf" },
    { "filename": "My game (Disk 2 of 2).adf", "url": "https://example.org/disk2.adf" }
  ]
}
```

File mode replaces each disk's `url` with its own embedded `file` path. Link
export does not download any disk; VM/E downloads them when importing. Both
variants can be re-imported into this tool, including embedded disk assets.

**Multi-disk exports require the updated VM/E importer included with this
change.** It validates all disks and stores one self-contained ZIP per game,
with a `vme_disks.json` manifest. On collection launch VM/E unwraps individual
disk ZIPs, creates unique disk aliases and an M3U, then uses its existing disk
switching and save infrastructure. The full game bundle remains available for
reopening. Ordinary ZIPs keep their existing loader behavior.

## Verification and agent API

```sh
npm run test:collection-builder
```

The tests cover encoded URLs, manifest imports, embedded and link exports,
colliding filenames, images, missing assets, failed/empty downloads, pagination,
legacy platform IDs and cancellation during both download and ZIP generation.
They also cover disk ordering, variant isolation, missing/ambiguous disks,
multi-disk exports/round trips, per-disk ZIP extraction and M3U preparation.
Artwork tests cover shared name matching, lazy index caching, WHDLoad/multi-disk
names, preservation of existing images, layer fallback and cancellation.
List tests cover parsing, platform aliases, exact title/filename matching,
automatic TOSEC release ranking, manual overrides, disk-set completeness,
duplicate requests and reports. Ranking tests cover flags on secondary disks,
tag priorities, language, numeric versions and candidates beyond the display limit. Export
tests ensure best-effort mode skips entire failed games and never swallows an
abort or creates an empty collection.

Browser integration test: start this tool, open it in a fresh isolated browser
context, then run:

```js
const tests = await import('/@fs/<absolute-repository-path>/tests/collection-builder.browser.js');
await tests.runCollectionBuilderTests();
// In another fresh isolated browser context:
await tests.runCollectionMultidiskTests();
// In a third fresh isolated browser context:
await tests.runCollectionArtworkTests();
// In another fresh isolated browser context:
await tests.runCollectionProgramListTests();
// In another fresh isolated browser context:
await tests.runCollectionTitleMatchingTests();
// In another fresh isolated browser context:
await tests.runCollectionSimplifiedUITests();
// In another fresh isolated browser context:
await tests.runCollectionImportTesterTests();
```

This uses synthetic data, checks the local download endpoint, and passes both
export variants through the actual `PlatformManager.loadCollectionFile` method.
Storage/dependency checks are stubbed; no emulator or VM/E database is started.
The multi-disk test exercises all five platforms through the real importer and
`loadRomFromCollection`, stopping at the emulator launch boundary with synthetic
disk bytes. It checks both export modes and duplicate prevention.
The artwork test uses VM/E's real Amiga index and synthetic PNG responses. It
checks manual/bulk selection, export of the downloaded PNG and cancellation.
The list test matches synthetic catalogs, selects an edition, simulates an
unavailable program, and imports the resulting partial ZIP through VM/E's real
importer. It also checks link export and cancellation of the whole workflow.
The simplified-UI test checks shared platform context, contextual filters and
import dialogs, one collection list, preserved custom artwork/metadata through
release changes and rematching, removed requests and unified building.
The import-tester test verifies automatic embedded-file tests, deferred and full
linked tests, exact errors shared with VM/E, blocked corrupt artifacts,
cancellation and the absence of the real `VME` database.
Vite may reload once when optimizing the extra test dependencies on the first
run; if that happens, rerun in a new isolated context after optimization.

The page exposes:

```js
await collectionBuilder.ready;
await collectionBuilder.importFile(file, { platformId: 'amiga' });
const { results, total } = collectionBuilder.search({ query: 'worms', platform: 'amiga', limit: 80 });
collectionBuilder.diskSet(results[0].key); // ordered disks and completeness/confidence
collectionBuilder.add(results[0].key);
const key = collectionBuilder.inspect().selected[0].key;
await collectionBuilder.findImages(key); // available indexed image types/URLs
await collectionBuilder.downloadImage(key, 'snaps'); // or 'titles' / 'boxarts'
await collectionBuilder.downloadMissingImages(); // skips existing images
collectionBuilder.setMetadata({ name: 'My games', id: 'my-games' });
const { bytes, manifest, filename } = await collectionBuilder.export({ mode: 'links' });
await collectionBuilder.flush();
collectionBuilder.inspect();
```

Program-list API (exports return bytes without triggering a download):

```js
const report = await collectionBuilder.matchList('amiga | Lemmings | WHDLoad\ndos | Doom');
// Optional override of the preferred release using a candidate in report.rows:
collectionBuilder.chooseListMatch(lineNumber, candidateKey);
// matchList already populated the draft; build its current edited state:
await collectionBuilder.build({ mode: 'files', images: true });
// Or explicitly rebuild from requested rows (legacy helper):
const result = await collectionBuilder.buildFromList({ mode: 'files', images: true, replace: true });
// Or match and build together:
await collectionBuilder.buildFromList({ text: 'Doom\nQuake', platform: 'dos', mode: 'links', images: false });
collectionBuilder.listReport();
collectionBuilder.importTestReport(); // result of the last automatic/manual test
await collectionBuilder.testImport(bytes, { filename, downloadLinks: false });
// Explicit full test, including direct downloads of linked programs:
await collectionBuilder.testImport(bytes, { filename, downloadLinks: true });
```

`remove(key)` and `move(key, -1|1)` edit the selection. API export returns ZIP
bytes without triggering a browser download. `inspect()` summarizes sources and
the draft without returning attached binary data. `newCollection()` resets the
draft while retaining sources; `setInputMode('list'|'search')` switches the tabs.
`importFiles(files)` uses the contextual platform dialog for standalone JSONs;
agents can use `importFile(file, {platformId})` directly to avoid that prompt.
`applyListMatches({replace})` remains available for existing scripts; the UI
applies matches automatically.

The tool's separate Vite configuration rejects production builds; its UI is
outside VM/E's application entry/PWA and adds no npm dependencies. Shared disk
bundle preparation lives in `src/utils/CollectionDiskSet.js`; VM/E's importer
and collection launch path use it to consume the new multi-disk entries.
`src/utils/ThumbnailMatching.js` is shared with VM/E's thumbnail preview.
`src/utils/CollectionImport.js` is the shared real importer used by the built-in
test. Automatic `build()`, `buildFromList()` and `export()` results include
`importTest`; failed tests reject the build with a structured report.
