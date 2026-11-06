import { importCollectionArchive, collectionImportIssue } from '../../../src/utils/CollectionImport.js';

export async function testCollectionImport(input, { platforms, filename = 'collection.zip', downloadLinks = false,
  fetchFile, signal, onProgress = () => {}, checkImage } = {}) {
  const steps = [], dependencies = new Map();
  let position = { stage: 'archive' }, clippedSteps = 0;
  const report = { version: 2, filename, testedAt: new Date().toISOString(), status: 'running',
    scope: { storage: 'temporary memory', requirements: 'not checked', gameStartup: 'not checked',
      importer: 'current working sources; published VM/E is not executed',
      links: downloadLinks ? 'downloaded' : 'deferred', origin: globalThis.location?.origin || null }, steps };
  try {
    const result = await importCollectionArchive(input, { platforms, signal, downloadLinks, checkImage,
      storage: {
        async checkFiles(platform) {
          dependencies.set(platform.platform_id, (Array.isArray(platform.dependencies) ? platform.dependencies : []).map(item => item.key).filter(Boolean));
          return [[], [], null];
        },
        async storeCollection() { return true; }
      },
      network: { async fetch(url, _proxy, options) {
        if (!fetchFile) throw new Error('No downloader provided for the full link test.');
        return fetchFile(url, options);
      } },
      onProgress: value => {
        position = value;
        if (steps.length === 250) { steps.shift(); clippedSteps++; }
        steps.push({ ...value }); onProgress(value);
      }
    });
    const issues = result.requiredFeatures.map(({ feature, ...context }) => ({ ...context, feature, stage: 'compatibility',
      message: `Game ${context.entryIndex} (${context.title}) · ${context.platform_id}: requires VM/E with multi-disk collection import support. Older importers reject this entry because it has disks instead of file/url.` }));
    Object.assign(report, result, {
      compatibility: { legacyManifest: { status: issues.length ? 'unsupported' : 'compatible', issues } },
      status: result.pendingLinks.length || issues.length ? 'partial' : 'passed'
    });
  } catch (error) {
    const cancelled = signal?.aborted || error.name === 'AbortError';
    report.status = cancelled ? 'cancelled' : 'failed';
    report.error = { ...position, ...collectionImportIssue(error) };
  }
  report.requirements = [...dependencies].map(([platform_id, keys]) => ({ platform_id, keys }));
  if (clippedSteps) report.omittedSteps = clippedSteps;
  return report;
}
