import { CLI } from '../src/cli/CLI.js';
import { FindCommand } from '../src/cli/FindCommand.js';
import { ListCommand } from '../src/cli/ListCommand.js';
import { PlatformManager, SelectedPlatforms } from '../src/platforms/PlatformManager.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function runCliDirectorySortTest() {
    const cli = new CLI();
    const stored = [];
    const updatePlatform = PlatformManager.prototype.updatePlatform;
    let manager;
    try {
        PlatformManager.prototype.updatePlatform = () => {};
        manager = new PlatformManager({}, cli, { storeFile: (...args) => { stored.push(args); } }, {}, {});
    } finally { PlatformManager.prototype.updatePlatform = updatePlatform; }
    manager.setSelectedPlatform(SelectedPlatforms.A800);
    cli.register_command(new FindCommand(manager));
    cli.register_command(new ListCommand(manager));
    const model = {
        root: '/', bases: ['native/', 'win/', 'whd/'], tags: [null, 'WIN', 'WHDLoad'], tagPriority: { WIN: 1 },
        items: [
            ['Alpha.xex', 0, 'alpha.xex', 0, 'Hero Alpha'],
            ['Alpha.exe', 1, 'alpha.exe', 0, 'Hero Alpha WIN'],
            ['Zulu.zip', 2, 'zulu.zip', 0, 'Hero Zulu'],
            ['Beta.xex', 0, 'beta.xex', 0, 'Hero Beta']
        ]
    };
    const rows = () => [...document.querySelectorAll('#cors_results .corsrow')].map(row => row.getAttribute('data-value'));
    const expectRows = (expected, message) => assert(JSON.stringify(rows()) === JSON.stringify(expected), message);
    const originalItems = JSON.stringify(model.items);
    try {
        manager.loadCorsFile(model);
        const expected = ['/whd/zulu.zip', '/native/alpha.xex', '/native/beta.xex', '/win/alpha.exe'];
        cli.inject('find hero', false);
        expectRows(expected, 'FIND preserves tag priority and filename order');
        cli.inject('find hero alpha', false);
        expectRows(['/native/alpha.xex', '/win/alpha.exe'], 'Multi-token FIND uses display captions and retains sorted order');
        cli.inject('find ^hero.*beta$', false);
        expectRows(['/native/beta.xex'], 'FIND still supports regular expressions');
        cli.inject('list hero', false);
        expectRows(expected, 'Filtered LIST uses the same ordering as FIND');
        cli.inject('list', true);
        expectRows(expected, 'Full LIST preserves the directory ordering');
        assert(JSON.stringify(model.items) === originalItems, 'Browsing leaves original directory items unchanged');
        cli.inject('find missing', false);
        expectRows([], 'An unmatched filter returns an empty list');

        // Reload the same JSON object with changed priorities and filenames.
        model.tagPriority.WIN = -2;
        model.items[0][0] = 'Omega.xex';
        manager.loadCorsFile(model);
        cli.inject('find hero', false);
        expectRows(['/win/alpha.exe', '/whd/zulu.zip', '/native/beta.xex', '/native/alpha.xex'], 'Reloading rebuilds ordering even when the JSON object and item count stay the same');

        const imported = { root: '/new/', bases: [''], items: [['New.xex', 0, 'new.xex', 0, 'Hero New']] };
        manager.importCorsFile('test.software', imported);
        cli.inject('list hero', false);
        expectRows(['/new/new.xex'], 'Import replaces the cached directory');
        assert(stored.length === 1 && stored[0][1] === imported, 'Import still persists the directory');

        manager.setSelectedPlatform(SelectedPlatforms.NES);
        manager.loadCorsFile({ root: '/nes/', bases: [''], items: [['Hero.nes', 0, 'hero.nes', 0, 'Hero NES']] });
        cli.inject('find hero', false);
        expectRows(['/nes/hero.nes'], 'Loading another platform cannot reuse previous search results');
    } finally { cli.reset(); }
    return 'CLI directory ordering: FIND/LIST filters, tags, regex, original order, same-object reload, import and platform change';
}
