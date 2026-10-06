import { CLI } from '../src/cli/CLI.js';
import { FindCommand } from '../src/cli/FindCommand.js';
import { ListCommand } from '../src/cli/ListCommand.js';
import { RandomCommand } from '../src/cli/RandomCommand.js';
import { ThumbnailPreview } from '../src/ui/ThumbnailPreview.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function runCliSelectionTest() {
    const directory = {
        root: '/', bases: ['games/'], tags: ['Test'],
        items: ['Alpha', 'Beta', 'Gamma'].map(name => [`${name}.xex`, 0, `${name}.xex`, 0, name])
    };
    const launched = [];
    const previews = [];
    const manager = {
        get_software_dir: () => directory,
        loadRomFileFromUrl: async (...args) => { launched.push(args); }
    };
    const cli = new CLI();
    cli.register_command(new FindCommand(manager));
    cli.register_command(new ListCommand(manager));
    cli.register_command(new RandomCommand(manager));
    const originalShow = ThumbnailPreview.show;
    ThumbnailPreview.show = title => { previews.push(title); };
    const container = document.getElementById('cors_results');
    const key = key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const selected = () => container.querySelector('span.highlight');
    const expectSelected = index => {
        assert(cli.get_selection_index() === index && selected() === container.children[index].querySelector('span'), 'Selection index and highlight stay in sync');
        assert(container.querySelectorAll('span.highlight').length === 1, 'Exactly one result is highlighted');
    };
    cli.on();
    try {
        cli.inject('list', true);
        const rows = [...container.children];
        key('Enter');
        assert(cli.is_selection_mode_active(), 'ENTER enters selection');
        assert(rows.every((row, index) => row === container.children[index]), 'Entering selection preserves the visible result rows');
        expectSelected(0);
        assert(previews[0] === 'Alpha', 'Thumbnail title excludes the directory tag');
        const previewCount = previews.length;
        cli.update();
        assert(previews.length === previewCount, 'Updating the same selection preserves the thumbnail');
        key('ArrowUp'); expectSelected(2);
        key('ArrowDown'); expectSelected(0);
        cli.move_selection('down'); expectSelected(1);
        rows[2].click(); expectSelected(2);
        assert(launched.length === 0, 'First tap selects without launching');
        key('Enter');
        assert(launched.length === 1 && launched[0][0] === '/games/Gamma.xex', 'ENTER loads the selected program exactly once');

        cli.reset();
        cli.inject('list', false);
        assert(!container.querySelector('.corsrow'), 'LIST initially shows its ENTER prompt');
        key('Enter');
        expectSelected(0);
        key('Escape');
        assert(!selected() && !cli.is_selection_mode_active(), 'ESC removes selection');
        key('Enter');
        expectSelected(0);
        cli.process_input('escape');
        cli.process_input('clear');
        assert(!selected(), 'Clearing results removes selection');

        cli.reset();
        cli.inject('find alpha', false);
        key('Enter'); expectSelected(0);
        cli.process_input('escape');
        cli.process_input('backspace');
        key('Enter'); expectSelected(0);
        assert(selected().textContent.endsWith('Alpha'), 'Filtering and re-entering selection highlight the new result row');

        cli.reset();
        cli.inject('rnd', false);
        key('Enter'); expectSelected(0);
        const randomRow = container.firstElementChild;
        key('ArrowDown'); expectSelected(0);
        assert(container.firstElementChild !== randomRow, 'RND arrows still reroll and highlight the replacement result');
    } finally {
        cli.off(); cli.reset();
        ThumbnailPreview.show = originalShow;
    }
    return 'CLI selection: retained rows, keyboard/touch navigation, wraparound, thumbnails, ENTER/ESC, filtering, LIST and RND';
}
