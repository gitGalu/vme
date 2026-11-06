import registry from '../../../src/platforms/PlatformManager.js?raw';
import PlatformBase from '../../../src/platforms/PlatformBase.js';

const sources = import.meta.glob('../../../src/platforms/systems/*.js', { query: '?raw', import: 'default', eager: true });
const registered = new Set((registry.match(/export const SelectedPlatforms\s*=\s*\{([^}]+)\}/)?.[1] || '').split(',').map(name => name.trim()));
export const platforms = Object.entries(sources).flatMap(([path, source]) => {
  if (!registered.has(path.split('/').pop().replace(/\.js$/, ''))) return [];
  const id = source.match(/\bplatform_id\s*:\s*['"]([^'"]+)['"]/)?.[1];
  const name = source.match(/\bplatform_name\s*:\s*['"]([^'"]+)['"]/)?.[1];
  const core = source.match(/\bcore\s*:\s*['"]([^'"]+)['"]/)?.[1];
  const system = source.match(/\blibretro_thumbnails_system\s*:\s*['"]([^'"]+)['"]/)?.[1];
  return id ? [{ id, name: name || id, core, multidisk: /\bmultidisk\s*:\s*true\b/.test(source),
    thumbnailUrls: PlatformBase.getThumbnailUrls.call({ libretro_thumbnails_system: system }) }] : [];
}).sort((a, b) => a.name.localeCompare(b.name));

const runtimeSources = import.meta.glob('../../../src/platforms/systems/*.js');
let runtimePlatforms;
export function loadImportPlatforms() {
  runtimePlatforms ||= Promise.all(Object.entries(runtimeSources)
    .filter(([path]) => registered.has(path.split('/').pop().replace(/\.js$/, '')))
    .map(async ([, load]) => (await load()).default));
  return runtimePlatforms;
}
