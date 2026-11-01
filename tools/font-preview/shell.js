import { GamepadMenu } from '../../src/gamepad/GamepadMenu.js';
import { GamepadManager } from '../../src/gamepad/GamepadManager.js';
import { XrShellPainter } from '../../src/xr/XrShellPainter.js';
import { t } from '../../src/i18n/shellStrings.js';
import { BASELINE_STACK, BASELINE_XR_STACK } from './fonts.js';

export function createShellPreview(source, items, values) {
    const root = source.getElementById('gamepad-menu');
    const legend = document.createElement('div');
    legend.id = 'gamepad-legend-bar';
    legend.className = 'gamepad-legend-bar';
    const vrStage = document.createElement('div');
    vrStage.id = 'preview-vr-stage';
    vrStage.hidden = true;
    document.body.append(root, legend, vrStage);

    const menu = new GamepadMenu();
    const painter = new XrShellPainter();
    painter.canvas.id = 'preview-vr-canvas';
    painter.canvas.tabIndex = 0;
    painter.canvas.setAttribute('aria-label', 'Tekstura VM/E Shell w VR. Nawigacja strzałkami, Enter i Escape.');
    vrStage.append(painter.canvas);
    let vr = false;
    let platform = 'A800';

    const gameList = (title, filterable = false) => ({
        title,
        filterable,
        placeholder: t('search.placeholder'),
        items: rows(''),
        buildItems: rows,
    });
    function rows(query) {
        return items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(item => ({
            id: String(item.id), label: item.title, hint: item.credits, vrThumb: item.image,
            onActivate: () => menu.notify({ message: `${item.title} · ${item.credits}` }),
        }));
    }
    const settings = () => ({ title: t('menu.settings'), items: [
        { id: 'display', label: 'Display mode', hint: 'Authentic', onActivate: () => menu.notify({ message: 'Authentic · Pixel perfect · Fill screen' }) },
        { id: 'audio', label: 'Audio', hint: 'On', onActivate: () => {} },
        { id: 'language', label: 'Language / Język', hint: values.get('SHELL_LANG') === 'pl' ? 'Polski' : 'English', onActivate: () => {
            values.set('SHELL_LANG', values.get('SHELL_LANG') === 'pl' ? 'en' : 'pl');
            menu.popToRoot(mainMenu());
        } },
    ] });
    const mainMenu = () => ({ title: t('app.title'), items: [
        { id: 'platform', label: t('menu.platform'), hint: platform, onActivate: () => menu.pushView({
            title: t('platform.title'), items: ['A800', 'Amiga', 'C64', 'DOS', 'NES', 'SNES'].map(label => ({
                id: label, label, onActivate: () => { platform = label; menu.popToRoot(mainMenu()); },
            })),
        }) },
        { id: 'saves', label: t('menu.saves'), onActivate: () => menu.pushView(gameList(t('menu.saves'))) },
        { id: 'collections', label: t('menu.collections'), onActivate: () => menu.pushView(gameList(t('menu.collections'))) },
        { id: 'search', label: t('menu.search'), onActivate: () => menu.pushView(gameList(t('menu.search'), true)) },
        { id: 'browse', label: t('menu.browse'), onActivate: () => menu.pushView(gameList(t('menu.browse'), true)) },
        { id: 'recent', label: t('menu.recent'), onActivate: () => menu.pushView(gameList(t('menu.recent'))) },
        { id: 'open', label: t('menu.open'), disabled: vr, hint: vr ? t('menu.vr2dOnly') : '', onActivate: () => menu.notify({ message: 'Zażółć gęślą jaźń · 0123456789' }) },
        { id: 'settings', label: t('menu.settings'), onActivate: () => menu.pushView(settings()) },
    ] });

    function repaint() {
        const snapshot = menu.getVrSnapshot();
        painter.paint(snapshot);
        if (!snapshot) return;
        // Reuse the actual legend renderer without starting a gamepad polling manager.
        GamepadManager.prototype.setLegend.call({ legendBar: legend }, [
            { glyph: 'A', label: t('legend.select') },
            { glyph: 'B', label: t(snapshot.isRoot ? 'legend.exit' : 'legend.back') },
            ...(snapshot.filterable ? [{ glyph: 'X', label: t('legend.filter') }] : []),
        ]);
    }
    menu.setRootView(mainMenu);
    menu.setChangeHandler(repaint);
    painter.onThumbLoad = repaint;

    function activateRow(index) {
        if (menu.getVrSnapshot()?.focusMode === 'keyboard') menu.toggleFilter();
        const total = menu.getVrSnapshot()?.total ?? 0;
        for (let step = 0; step <= total; step++) {
            const snapshot = menu.getVrSnapshot();
            const current = snapshot.start + snapshot.rows.findIndex(row => row.focused);
            if (current === index) { menu.activate(); return; }
            menu.navigate(index > current ? 1 : -1);
        }
    }
    root.addEventListener('click', event => {
        const row = event.target.closest('.gm-item:not(.gm-item-disabled)');
        if (row) activateRow(Number(row.dataset.index));
        const key = event.target.closest('.gm-kbd-key');
        if (key) {
            if (menu.getVrSnapshot().focusMode !== 'keyboard') menu.toggleFilter();
            const rowIndex = [...key.parentElement.parentElement.querySelectorAll('.gm-kbd-row')].indexOf(key.parentElement);
            const column = [...key.parentElement.children].indexOf(key);
            const focus = menu.getVrSnapshot().keyboard.focus;
            menu.navigate(rowIndex - focus.row, column - focus.col);
            menu.activate();
        }
    });
    painter.canvas.addEventListener('click', event => {
        const snapshot = menu.getVrSnapshot();
        if (!snapshot || snapshot.keyboard) return;
        const rect = painter.canvas.getBoundingClientRect();
        const y = (event.clientY - rect.top) * painter.canvas.height / rect.height;
        const height = Math.min(46, Math.floor((768 - 88 - 96) / Math.max(snapshot.rows.length, 1)));
        const index = Math.floor((y - 96) / height);
        if (index >= 0 && index < snapshot.rows.length && !snapshot.rows[index].disabled) activateRow(snapshot.start + index);
    });

    return {
        open(mode) {
            vr = mode === 'shell-vr';
            vrStage.hidden = !vr;
            legend.classList.toggle('visible', !vr);
            if (!menu.isOpen()) menu.open();
            else if (menu.isAtRoot()) menu.replaceRoot(mainMenu());
            repaint();
        },
        close() { menu.close(); vrStage.hidden = true; legend.classList.remove('visible'); },
        applyFont(stack) { painter.setFontFamily(stack === BASELINE_STACK ? BASELINE_XR_STACK : stack); repaint(); },
        handleKey(event) {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const action = {
                ArrowUp: () => menu.navigate(-1), ArrowDown: () => menu.navigate(1),
                ArrowLeft: () => menu.navigate(0, -1), ArrowRight: () => menu.navigate(0, 1),
                Enter: () => menu.activate(), Escape: () => menu.back(),
                Backspace: () => menu.backspaceExternal(), x: () => menu.toggleFilter(), X: () => menu.toggleFilter(),
            }[event.key];
            if (action) { event.preventDefault(); event.stopImmediatePropagation(); action(); }
        },
    };
}
