// Discover configurations without executing every platform's module.
const sources = import.meta.glob('../../../../src/platforms/systems/*.js', {
  query: '?raw', import: 'default', eager: true
});
const modules = import.meta.glob('../../../../src/platforms/systems/*.js');

export const platformSources = Object.entries(sources)
  .filter(([, source]) => /^\s*(?:custom_controllers|["']custom_controllers["'])\s*:/m.test(source))
  .map(([path]) => ({
    path,
    revision: fingerprint(sources[path]),
    name: path.split('/').pop().replace(/\.js$/, ''),
    sourceFile: `src/platforms/systems/${path.split('/').pop()}`
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function fingerprint(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function loadPlatformDefinition(path) {
  if (!platformSources.some(platform => platform.path === path)) {
    throw new Error('Unknown platform');
  }
  // Import the actual object, including references such as KeyMaps, rather than
  // parsing a JavaScript object literal or maintaining a second copy of the data.
  const { default: platform } = await modules[path]();
  return platform;
}

export async function loadPlatformControllers(path) {
  const platform = await loadPlatformDefinition(path);
  const controllers = platform?.custom_controllers;
  if (!controllers || !Array.isArray(controllers.presets)) {
    throw new Error('This platform has no custom controller presets');
  }
  return structuredClone(controllers);
}
