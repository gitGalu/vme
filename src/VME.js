import { s, show, hide, addButtonEventListeners } from './dom.js';
import { CLI } from './cli/CLI.js';
import { SaveBrowser } from './SaveBrowser.js';
import { CollectionBrowser } from './CollectionBrowser.js';
import { KeyboardManager } from './keyboard/KeyboardManager.js';
import { StorageManager } from './storage/StorageManager.js';
import { HelpCommand } from './cli/HelpCommand.js';
import { SystemCommand } from './cli/SystemCommand.js';
import { ListCommand } from './cli/ListCommand.js';
import { RandomCommand } from './cli/RandomCommand.js';
import { FindCommand } from './cli/FindCommand.js';
import { SetCommand } from './cli/SetCommand.js';
import { OpenCommand } from './cli/OpenCommand.js';
import { AboutCommand } from './cli/AboutCommand.js';
import { LastCommand } from './cli/LastCommand.js';
import { NextCommand } from './cli/NextCommand.js';
import { RecentCommand } from './cli/RecentCommand.js';
import { WikiCommand } from './cli/WikiCommand.js';
import { SaveBrowserCommand } from './cli/SaveBrowserCommand.js';
import { BackupCommand } from './cli/BackupCommand.js';
import { RestoreBackupCommand } from './cli/RestoreBackupCommand.js';
import { BrowseCommand } from './cli/BrowseCommand.js';
import { ClearallCommand } from './cli/ClearallCommand.js';
import { CheckFixCommand } from './cli/CheckFixCommand.js';
import { BootCommand } from './cli/BootCommand.js';
import { PlatformManager, SelectedPlatforms } from './platforms/PlatformManager.js';
import { HistoryManager } from './history/HistoryManager.js';
import { t, getShellLang, setShellLang, SHELL_LANGS, formatRelativeShell } from './i18n/shellStrings.js';
import { UiManager } from './ui/UiManager.js';
import { ThumbnailPreview, ThumbnailPreviewClass } from './ui/ThumbnailPreview.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { NetworkManager } from './NetworkManager.js';
import { isMobile } from 'react-device-detect';
import { JOYSTICK_TOUCH_MODE, BOOT_TO, BOOT_TO_COLLECTION_BROWSER, COLLECTION_BROWSER_COLLECTION_INDEX, COLLECTION_BROWSER_ITEM_INDEX } from './Constants.js';
import { ButtonManager } from './ButtonManager.js';
import { Debug } from './Debug.js';
import { GamepadManager } from './gamepad/GamepadManager.js';
import { GamepadMenu } from './gamepad/GamepadMenu.js';

export class VME {
    #cli;
    #kb;
    #env;
    #net;
    #pl;
    #db;
    #ui;

    #save_browser;
    #collection_browser;
    #gamepad;
    #gamepad_menu;
    #gamepad_thumbnail;
    #open_command;
    #platform_ready = true;   // false greys out Browse/Search until readiness is checked
    #return_to_shell = false;  // browser opened from shell -> on close return to shell, not CLI
    #pendingLaunchTitle = '';
    #launchedFromGamepad = false; // launched from shell/gamepad skin -> no on-screen UX
    #ingameMenuOpen = false;
    #ingameFocus = 0;
    #ingameJoyState = null;
    #ingameLatestSaveId = null; // null = no save; 'Load state' disabled

    static whitespace = "&nbsp;";

    static CURRENT_SCREEN = {
        STANDALONE_WARNING: 50,
        MENU: 100,
        EMULATION: 200,
        SAVE_BROWSER: 220,
        COLLECTION_BROWSER: 300
    };

    static CURRENT_ENV = {
        TOUCH_SMALL: 100,
        TOUCH_BIG: 200,
        DESKTOP: 300
    }

    static CURRENT_MAIN_MENU = {
        NONE: 10,
        PLATFORM_SELECT: 100,
        CORS_QUERY: 200
    };

    static SCREEN_SIZE = {
        SMALLER: 100,
        BIGGER: 300
    }

    constructor() {
        window.onload = function () {
            document.body.classList.add("fade-in-visible");
        }

        if (this.#guard()) {
            show("#warningStandalone", "block");
            show("html");
            return;
        }

        this.#cli = new CLI();
        this.#net = new NetworkManager();
        this.#kb = new KeyboardManager(this.#cli);
        this.#db = new StorageManager();
        this.#pl = new PlatformManager(this, this.#cli, this.#db, this.#net, this.#kb);
        ThumbnailPreview.init(this.#pl);
        this.#env = new EnvironmentManager(this.#pl);
        this.#ui = new UiManager(this.#pl, this.#kb);
        this.#save_browser = new SaveBrowser(this, this.#pl, this.#db, this.#cli);
        this.#collection_browser = new CollectionBrowser(this, this.#pl, this.#db, this.#cli);
        this.#gamepad = new GamepadManager();
        this.#gamepad_menu = new GamepadMenu();

        this.#gamepad.setManagers(this.#kb, this.#cli);

        this.#gamepad_thumbnail = new ThumbnailPreviewClass();
        this.#gamepad_thumbnail.init(this.#pl, 'gamepad-menu-thumbnail');

        this.#gamepad_menu.setCloseHandler(() => this.#exitGamepadMenu());
        this.#gamepad_menu.setRootView(() => this.#buildGamepadRootView());
        this.#gamepad_menu.setContextHandler((ctx) => this.#updateMenuLegend(ctx));
        this.#gamepad_menu.setFocusChangeHandler((item) => this.#updateGamepadThumbnail(item));

        this.#kb.setGamepadManager(this.#gamepad);

        this.#kb.clicks_on();

        this.#cli.register_command(new SystemCommand(this.#pl));
        this.#cli.register_command(new FindCommand(this.#pl));
        this.#cli.register_command(new ListCommand(this.#pl));
        this.#cli.register_command(new RandomCommand(this.#pl));
        this.#open_command = new OpenCommand(this.#pl);
        this.#cli.register_command(this.#open_command);
        this.#cli.register_command(new AboutCommand(this.#pl));
        this.#cli.register_command(new SaveBrowserCommand(this.#save_browser));
        this.#cli.register_command(new BrowseCommand(this.#collection_browser));
        this.#cli.register_command(new LastCommand(this.#pl));
        this.#cli.register_command(new NextCommand(this.#pl));
        this.#cli.register_command(new RecentCommand(this.#pl));
        this.#cli.register_command(new HelpCommand());
        this.#cli.register_command(new WikiCommand());
        this.#cli.register_command(new ClearallCommand());
        this.#cli.register_command(new BackupCommand(this.#db));
        this.#cli.register_command(new RestoreBackupCommand(this.#db));
        this.#cli.register_command(new CheckFixCommand(this.#db));
        this.#cli.register_command(new SetCommand());
        this.#cli.register_command(new BootCommand(this.#pl));

        this.#cli.register_default('find');

        this.#addListeners();

        this.#kb.initButtons();

        let bm = new ButtonManager(this.#cli, this.#collection_browser);
        bm.addButtons();

        EnvironmentManager.detectDevice();

        s('#versionLabel').innerHTML = `v${__APP_VERSION__}`;
        this.toggleScreen(VME.CURRENT_SCREEN.MENU);
        if (StorageManager.getValue(BOOT_TO) == BOOT_TO_COLLECTION_BROWSER) {
            let bootToCollectionIndex = StorageManager.getValue(COLLECTION_BROWSER_COLLECTION_INDEX);
            let bootToCollectionItemIndex = StorageManager.getValue(COLLECTION_BROWSER_ITEM_INDEX);

            if (bootToCollectionIndex && bootToCollectionItemIndex) {
                this.#collection_browser.open(bootToCollectionIndex, bootToCollectionItemIndex);
            } else {
                this.#collection_browser.open();
            }
        }

        if (Debug.isEnabled()) {
            Debug.setVisible(true);
        }
    }

    #addListeners() {
        // ROM ready and waiting for a gesture -> show the 'press to start' screen now
        // (deferred so it can't cover a launch-settings dialog on other paths).
        document.addEventListener('vme:awaiting-launch-gesture', (e) => {
            const title = this.#pendingLaunchTitle || e.detail?.caption || '';
            this.#showLaunchScreen(title);
            this.#setLaunchAwaiting();
        });

        window.addEventListener('resize', () => {
            EnvironmentManager.resizeCanvas(this.#pl.getNostalgist());
            EnvironmentManager.detectDevice();
        });

        window.addEventListener('orientationchange', () => {
            EnvironmentManager.detectDevice();
            setTimeout(() => {
                EnvironmentManager.resizeCanvas(this.#pl.getNostalgist());
            }, 100);
        });

        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                EnvironmentManager.resizeCanvas(this.#pl.getNostalgist());
            }, 100);
        });

        window.addEventListener('gamepaddisconnected', () => {
            EnvironmentManager.detectDevice();
            this.#updateGamepadHelpMessage();
        });
        window.addEventListener('gamepadconnected', () => {
            EnvironmentManager.detectDevice();
            this.#updateGamepadHelpMessage();
            // Browsers only fire gamepadconnected after the first button press, so this
            // event itself means "the user used the pad". On the MENU screen treat it as a
            // trigger and open the shell immediately; not in-game/in-browser.
            if (this.#gamepad.isMenuTriggerEnabled() && !this.#gamepad_menu.isOpen()) {
                this.#enterGamepadMenu();
            }
        });
    }

    #updateGamepadHelpMessage() {
        this.#pl.updateGamepadStatus();
    }

    #guard() {
        const params = new URLSearchParams(window.location.search);
        const isPwa = params.get('source') === 'pwa';

        if (import.meta.env.DEV) {
            return false;
        }

        return isMobile && !((window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || isPwa);
    }

    emulationStarted() {
        const defaultController = this.#pl.getSelectedPlatform().default_touch_controller;

        const additionalKeyboard = this.#pl.getSelectedPlatform().additional_keyboard;

        if (additionalKeyboard) {
            this.#kb.setAdditionalLayer(additionalKeyboard);
        }

        this.#ui.initQuickJoy();
        this.#ui.initQuickshot();
        this.#ui.initMousepad();
        this.#ui.initHideaway();
        this.#ui.initCursorKeys();

        this.#ui.initFastUI();
        this.#ui.initCustomControllers();

        if (defaultController) {
            UiManager.setCurrentJoyTouchMode(defaultController);
        } else {
            UiManager.setCurrentJoyTouchMode(JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY);
        }

        this.#ui.initDesktopUI();

        this.toggleScreen(VME.CURRENT_SCREEN.EMULATION);
        EnvironmentManager.updateDeviceType();

        this.#ui.initTouchControllerMenu();
        this.#ui.applyAutoGameProfile(this.#pl.getCurrentGameProfile());
        EnvironmentManager.resizeCanvas(this.#pl.getNostalgist());
    }

    applyCurrentAutoGameProfile() {
        this.#ui.applyAutoGameProfile(this.#pl.getCurrentGameProfile());
    }

    toggleScreen(mode) {
        // Capture whether the gamepad skin was active BEFORE removing it, so EMULATION
        // knows the game was launched via pad (Collection/Save in pad mode).
        const skinWasActive = document.body.classList.contains('gamepad-browser-skin');
        // The gamepad browser skin only applies while a browser is open; remove it on any
        // transition out of a browser (MENU/EMULATION are exits).
        if (mode === VME.CURRENT_SCREEN.MENU || mode === VME.CURRENT_SCREEN.EMULATION) {
            document.body.classList.remove('gamepad-browser-skin');
        }
        switch (mode) {
            case VME.CURRENT_SCREEN.MENU:
                // Drop the gamepad filter (may linger after a game) - otherwise it would
                // zero out buttons during shell navigation.
                this.#pl.clearGamepadFilter?.();
                document.body.classList.remove('gamepad-emulation');
                this.#teardownIngameMenu();
                hide('#warningStandalone');
                hide('#save-browser');
                hide('#collection-browser');
                hide('#emulator');
                hide('#quickjoys');
                hide('#fastui');
                hide('#quickshot');
                show('#settings', 'flex');
                this.#cli.on();
                this.#kb.clicks_on();
                this.#kb.updateMode(mode);
                document.body.classList.remove('black');

                const settingsElement = document.getElementById('settings');
                if (settingsElement) {
                    settingsElement.classList.remove('launch-starting');
                    settingsElement.classList.remove('launch-loading');
                    settingsElement.style.pointerEvents = 'auto';
                }

                const menuButtons = document.querySelectorAll('#menu-button-strip button, #menu-button-header-strip button');
                menuButtons.forEach(btn => {
                    btn.style.pointerEvents = 'auto';
                });

                if (this.#gamepad) {
                    this.#gamepad.setGuiNavigationEnabled(true);
                }

                this.#gamepad.setMenuTrigger(true, () => this.#enterGamepadMenu());

                if (this.#return_to_shell) {
                    this.#return_to_shell = false;
                    setTimeout(() => this.#enterGamepadMenu(), 0);
                }
                break;
            case VME.CURRENT_SCREEN.EMULATION:
                this.#return_to_shell = false;
                this.#hideLaunchScreen();
                // Pad mode: launched from shell OR browser skin (state before removal).
                const gamepadEmu = this.#launchedFromGamepad || skinWasActive;
                this.#launchedFromGamepad = false;
                this.#cli.off();
                hide('#warningStandalone');
                hide('#settings');
                hide('#save-browser');
                hide('#collection-browser');
                show('#emulator', 'block');

                if (gamepadEmu) {
                    // Pad-only control -> no on-screen UX (touch or desktop).
                    document.body.classList.add('gamepad-emulation');
                    hide('#fastui', 'grid');
                    hide('#quickshots');
                    hide('#quickshot');
                    hide('#quickjoys');
                    hide('#quickjoy');
                    hide('#mousepads');
                    hide('#toggle-keyboard');
                    this.#setupIngameMenu();   // long-press Start -> in-game menu
                } else {
                    document.body.classList.remove('gamepad-emulation');
                    if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
                        hide('#fastui', 'grid');
                        hide('#quickshots');
                        hide('#quickshot');
                        hide('#quickjoys');
                        hide('#quickjoy');
                        hide('#mousepads');
                    } else {
                        show('#fastui', 'grid');
                    }
                }
                this.#kb.hideTouchKeyboard();
                this.#kb.clicks_off();
                this.#kb.updateMode(mode);
                document.body.classList.add('black');

                this.#gamepad.clearMenuFocus();
                this.#leaveGamepadMenuContext();
                break;
            case VME.CURRENT_SCREEN.SAVE_BROWSER:
                this.#cli.off();
                hide('#warningStandalone');
                hide('#settings');
                hide('#emulator');
                hide('#collection-browser');
                show('#save-browser', 'flex');
                document.body.classList.add('black');

                this.#gamepad.clearMenuFocus();
                this.#leaveGamepadMenuContext();
                break;
            case VME.CURRENT_SCREEN.COLLECTION_BROWSER:
                this.#cli.off();
                hide('#warningStandalone');
                hide('#save-browser');
                hide('#emulator');
                hide('#settings');
                hide('#quickjoys');
                hide('#fastui');
                hide('#quickshot');
                show('#collection-browser', 'flex');
                document.body.classList.add('black');

                this.#gamepad.clearMenuFocus();
                this.#leaveGamepadMenuContext();
                break;
        }
    }

    #leaveGamepadMenuContext() {
        this.#gamepad.setMenuTrigger(false);
        this.#gamepad.setGamepadMenuActive(false);
        if (this.#gamepad_menu.isOpen()) {
            this.#gamepad_menu.close();
        }
        // Re-enable GUI navigation (disabled on entering pad mode) so pad navigation in the
        // browsers (handleBrowserNavigation) works.
        this.#gamepad.setGuiNavigationEnabled(true);
    }

    #buildGamepadRootView() {
        const noop = (name) => () => console.log(`[gamepad-menu] ${name} (not wired yet)`);
        const current = this.#pl.getSelectedPlatform();

        return {
            title: t('app.title'),
            items: [
                {
                    id: 'platform',
                    label: t('menu.platform'),
                    hint: current ? current.short_name : '',
                    onActivate: () => this.#gamepad_menu.pushView(this.#buildPlatformView())
                },
                { id: 'saves', label: t('menu.saves'), onActivate: () => this.#openBrowserFromShell(() => this.#save_browser.open()) },
                { id: 'collections', label: t('menu.collections'), onActivate: () => this.#openBrowserFromShell(() => this.#collection_browser.open()) },
                {
                    id: 'search', label: t('menu.search'),
                    disabled: !this.#platform_ready,
                    onActivate: () => this.#openSearchView()
                },
                {
                    id: 'browse', label: t('menu.browse'),
                    disabled: !this.#platform_ready,
                    onActivate: () => this.#openBrowseView()
                },
                {
                    id: 'recent', label: t('menu.recent'),
                    onActivate: () => this.#gamepad_menu.pushView(this.#buildRecentView())
                },
                { id: 'open', label: t('menu.open'), onActivate: () => this.#openImport() },
                { id: 'options', label: t('menu.settings'), onActivate: () => this.#gamepad_menu.pushView(this.#buildOptionsView()) }
            ]
        };
    }

    /**
     * Display mode: one setting, 3 mutually exclusive modes, mapped consistently onto the
     * SHADER + MAXIMIZE_IMAGE flags. Takes effect on the next game start.
     */
    #DISPLAY_MODES = [
        { id: 'authentic', labelKey: 'display.authentic', shader: true,  maximize: false },
        { id: 'pixel',     labelKey: 'display.pixel',      shader: false, maximize: false },
        { id: 'fill',      labelKey: 'display.fill',       shader: false, maximize: true }
    ];

    #currentDisplayMode() {
        const shaderOn = StorageManager.getValue('SHADER') !== '0';        // on by default
        const maximizeOn = StorageManager.getValue('MAXIMIZE_IMAGE') === '1';
        return this.#DISPLAY_MODES.find(m => m.shader === shaderOn && m.maximize === maximizeOn)
            || this.#DISPLAY_MODES[0];
    }

    /** Shell settings sub-screen. Changes take effect on the next game start. */
    #buildOptionsView() {
        const current = this.#currentDisplayMode();
        const lang = getShellLang();
        return {
            title: t('settings.title'),
            items: [
                {
                    id: 'display',
                    label: t('settings.display'),
                    hint: t(current.labelKey),
                    onActivate: () => {
                        const idx = this.#DISPLAY_MODES.indexOf(current);
                        const next = this.#DISPLAY_MODES[(idx + 1) % this.#DISPLAY_MODES.length];
                        StorageManager.storeValue('SHADER', next.shader ? '1' : '0');
                        StorageManager.storeValue('MAXIMIZE_IMAGE', next.maximize ? '1' : '0');
                        this.#gamepad_menu.replaceTop(this.#buildOptionsView());
                    }
                },
                {
                    id: 'language',
                    label: t('settings.language'),
                    hint: lang === 'pl' ? 'Polski' : 'English',
                    onActivate: () => {
                        // Rebuild the WHOLE shell in the new language: root (underneath) +
                        // Settings (on top) + legend (via #emitContext).
                        const idx = SHELL_LANGS.indexOf(lang);
                        setShellLang(SHELL_LANGS[(idx + 1) % SHELL_LANGS.length]);
                        this.#gamepad_menu.popToRoot(this.#buildGamepadRootView());
                        this.#gamepad_menu.pushView(this.#buildOptionsView());
                    }
                },
                {
                    id: 'import-library',
                    label: t('settings.enterCode'),
                    onActivate: () => this.#gamepad_menu.pushView(this.#buildImportLibraryView())
                },
                {
                    id: 'exit-cli',
                    label: t('settings.exitCli'),
                    onActivate: () => this.#gamepad_menu.requestCloseToCli()
                }
            ]
        };
    }

    /**
     * Asset-import sub-screen (CLI 'OPEN IA' / 'OPEN COL' equivalent). The available codes
     * are DELIBERATELY not listed; the user must TYPE the code (IA/COL) on the pad keyboard,
     * and an unknown code reveals nothing. Enter submits.
     */
    #buildImportLibraryView() {
        return {
            title: t('code.title'),
            filterable: true,
            placeholder: t('code.placeholder'),
            // No result list - this is a code field, not a filter. buildItems returns empty.
            buildItems: () => [],
            emptyHint: t('code.hint'),
            minChars: 1,   // below threshold shows emptyHint instead of an empty list
            onSubmit: (code) => this.#runImportCode(code)
        };
    }

    #runImportCode(code) {
        const c = (code || '').trim().toUpperCase();
        if (['IA', 'COL', 'A8'].includes(c)) return this.#runAssetImport(c);
        // Unknown code - do not reveal what is available.
        this.#gamepad_menu.notify({ ok: false, message: t('code.unknown') });
    }

    /** Fetch and import an asset bundle; on success reload so new games appear. */
    async #runAssetImport(kind) {
        const CFG = {
            IA:  { file: '../assets/vme_import.zip',     run: (b) => this.#pl.loadVmeImportFile(b) },
            COL: { file: '../assets/vme_collection.zip', run: (b) => this.#pl.loadCollectionFile(b) },
            A8:  { file: '../assets/a8_vme_collection.zip', run: (b) => this.#pl.loadCollectionFile(b) }
        };
        const cfg = CFG[kind] || CFG.IA;

        this.#gamepad_menu.pushView({
            title: t('code.title'),
            message: t('import.importing'),
            isNotice: 'ok',
            items: []
        });

        let ok = false, message;
        try {
            const url = new URL(cfg.file, import.meta.url).href;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            await cfg.run(await response.blob());
            ok = true;
            message = t('import.done');
        } catch (error) {
            console.error('[import-library] failed:', error);
            message = t('import.failed');
        }

        this.#gamepad_menu.replaceTop({
            title: ok ? t('notice.done') : t('notice.error'),
            message,
            isNotice: ok ? 'ok' : 'error',
            items: [{
                id: '_ok', label: t('notice.ok'),
                onActivate: () => { if (ok) location.reload(); else this.#gamepad_menu.back(); }
            }]
        });
    }

    #buildPlatformView() {
        // Sort like SystemCommand: by platform name, then by id.
        const platforms = Object.values(SelectedPlatforms).slice().sort((a, b) => {
            const nameCmp = a.platform_name.localeCompare(
                b.platform_name, undefined, { sensitivity: 'base', numeric: true });
            if (nameCmp !== 0) return nameCmp;
            return String(a.platform_id).localeCompare(
                String(b.platform_id), undefined, { sensitivity: 'base', numeric: true });
        });

        const currentId = this.#pl.getSelectedPlatform()?.platform_id;

        // 'includes' filter over id / platform_name / short_name, like SystemCommand
        // (e.g. 'nes' matches both NES and SNES).
        const buildItems = (filterText) => {
            const f = filterText.trim().toLowerCase();
            const matched = f.length === 0
                ? platforms
                : platforms.filter(p =>
                    p.platform_id.toLowerCase().includes(f) ||
                    p.platform_name.toLowerCase().includes(f) ||
                    p.short_name.toLowerCase().includes(f));

            return matched.map(p => ({
                id: p.platform_id,
                label: p.platform_name,
                hint: p.platform_id === currentId ? '✓' : '',
                onActivate: () => this.#selectGamepadPlatform(p)
            }));
        };

        // Start focused on the CURRENT platform (its position in the sorted list) and on
        // the LIST (not the keyboard) so the cursor lands on the current one right away.
        const currentIndex = Math.max(0, platforms.findIndex(p => p.platform_id === currentId));

        return {
            title: t('platform.title'),
            filterable: true,
            placeholder: t('platform.placeholder'),
            buildItems,
            initialFocusMode: 'list',
            focusIndex: currentIndex
        };
    }

    /**
     * History view of recently launched programs.
     * @param {?string} filter platform_id to filter by (null = all).
     */
    #buildRecentView(filter = null) {
        const entries = HistoryManager.getAll(filter);
        const items = entries.map(entry => {
            const platform = Object.values(SelectedPlatforms).find(p => p.platform_id === entry.platformId);
            const ago = formatRelativeShell(entry.ts);
            return {
                id: entry.romPath + '|' + entry.platformId,
                label: `${entry.label || entry.romName} — ${ago}`,
                // Show the platform when unfiltered (cross-platform); pointless to repeat when filtered.
                hint: filter ? '' : (platform ? platform.short_name : entry.platformId),
                onActivate: () => this.#launchRecent(entry)
            };
        });
        const filterPlatform = filter
            ? Object.values(SelectedPlatforms).find(p => p.platform_id === filter)
            : null;
        return {
            title: filterPlatform ? `${t('recent.title')} · ${filterPlatform.short_name}` : t('recent.title'),
            items,
            emptyHint: filter ? t('recent.emptyPlatform') : t('recent.empty'),
            onSecondary: () => this.#gamepad_menu.pushView(this.#buildRecentFilterView(filter)),
            secondaryLabel: t('legend.filter')
        };
    }

    /** Filter-platform sub-screen for Recent: platforms PRESENT in history + 'All'. */
    #buildRecentFilterView(currentFilter) {
        const entries = HistoryManager.getAll();
        // Unique platforms from history, sorted by short_name.
        const seen = new Set();
        const platforms = [];
        for (const e of entries) {
            if (seen.has(e.platformId)) continue;
            seen.add(e.platformId);
            const p = Object.values(SelectedPlatforms).find(pp => pp.platform_id === e.platformId);
            if (p) platforms.push(p);
        }
        platforms.sort((a, b) => a.short_name.localeCompare(b.short_name, undefined, { sensitivity: 'base', numeric: true }));

        const apply = (filter) => {
            this.#gamepad_menu.popToRoot(this.#buildGamepadRootView());
            this.#gamepad_menu.pushView(this.#buildRecentView(filter));
        };

        const items = [
            {
                id: '__all', label: t('recent.allPlatforms'),
                hint: currentFilter ? '' : '✓',
                onActivate: () => apply(null)
            },
            ...platforms.map(p => ({
                id: p.platform_id,
                label: p.platform_name,
                hint: p.platform_id === currentFilter ? '✓' : '',
                onActivate: () => apply(p.platform_id)
            }))
        ];

        return { title: t('recent.platformTitle'), items };
    }

    /**
     * History entry: if a savestate exists for this game -> choice sub-screen
     * (Continue / Start over / Cancel); without a save -> start over immediately.
     */
    async #launchRecent(entry) {
        let latestSave = null;
        try {
            const metas = await this.#db.getAllSaveMeta();   // sorted: newest first
            latestSave = metas.find(m =>
                m.program_name === entry.romName && m.platform_id === entry.platformId) || null;
        } catch (e) {
            console.error('[recent] save lookup failed:', e);
        }

        if (!latestSave) {
            this.#startRecentFromRom(entry);
            return;
        }
        this.#gamepad_menu.pushView({
            title: t('recent.title'),
            items: [
                { id: 'continue', label: t('recent.continue'), onActivate: () => this.#continueRecentSave(latestSave.id) },
                { id: 'startover', label: t('recent.startOver'), onActivate: () => this.#startRecentFromRom(entry) },
                { id: 'cancel', label: t('recent.cancel'), onActivate: () => this.#gamepad_menu.back() }
            ]
        });
    }

    /** Start over: switch platform if different, then the standard shell ROM launch. */
    #startRecentFromRom(entry) {
        const current = this.#pl.getSelectedPlatform();
        if (entry.platformId && current && current.platform_id !== entry.platformId) {
            const target = Object.values(SelectedPlatforms).find(p => p.platform_id === entry.platformId);
            if (target) {
                this.#pl.setSelectedPlatform(target);
                this.#pl.updatePlatform({ printStatus: false });
            }
        }
        this.#loadBrowseRom(entry.romPath, entry.romName, entry.label || entry.romName);
    }

    /** Continue: load the newest savestate (like Save Browser restore), in shell mode. */
    async #continueRecentSave(saveId) {
        let data;
        try {
            data = await this.#db.getSaveData(saveId);
        } catch (e) {
            console.error('[recent] getSaveData failed:', e);
            return;
        }
        if (!data) return;
        if (data.caption == undefined) data.caption = data.program_name;

        // Same setup as #loadBrowseRom (close shell, launch screen, pad mode).
        this.#gamepad_menu.close();
        this.#exitGamepadMenu();
        this.#launchedFromGamepad = true;
        this.#pendingLaunchTitle = data.caption;
        // For loadState (via loadRomFile) to use the UNIFIED launch screen (#gamepad-launch
        // via the awaiting-launch-gesture event) instead of the browser overlay, the skin
        // class must be set. toggleScreen(EMULATION/MENU) removes it.
        document.body.classList.add('gamepad-browser-skin');
        this.#showLaunchScreen(data.caption);
        try {
            await this.#pl.loadState(
                data.platform_id, data.save_data, data.rom_data, data.program_name, data.caption,
                null,   // closeCallback - shell has no browser to close
                data.m3u_disks, data.m3u_disk_index, data.m3u_disk_rom_ids, data.m3u_disk_launch_names,
                data.dos_sram, data.dos_exec_hint, data.st_state_path, data.launch_bios, data.launch_core_config
            );
        } catch (error) {
            console.error('[recent] restore failed:', error);
            this.#setLaunchError(this.#friendlyLoadError(error));
        }
    }

    #selectGamepadPlatform(platform) {
        this.#pl.setSelectedPlatform(platform);
        this.#pl.updatePlatform();
        // New platform -> readiness unknown; assume false (grey out) until checked, so we
        // don't briefly show active Browse/Search for a not-yet-ready platform.
        this.#platform_ready = false;
        this.#gamepad_menu.popToRoot(this.#buildGamepadRootView());
        this.#refreshPlatformReady();
    }

    #openBrowseView() {
        // Browse = LIST: filter on LEADING characters (startsWith) -> prefix match.
        this.#openSoftwareListView({
            titleKey: 'browse.title',
            placeholder: t('browse.placeholder'),
            findMatch: (name, f) => name.startsWith(f) ? 0 : -1
        });
    }

    #openSearchView() {
        // Search = FIND: 'contains' filter (includes) -> match anywhere (indexOf).
        // List hidden until 3 chars - with tens of thousands of entries a shorter filter
        // is useless; the hint nudges the user to type a name.
        this.#openSoftwareListView({
            titleKey: 'search.title',
            placeholder: t('search.placeholder'),
            findMatch: (name, f) => name.indexOf(f),
            minChars: 3,
            emptyHint: t('search.minHint')
        });
    }

    #openSoftwareListView({ titleKey, placeholder, findMatch, minChars = 0, emptyHint = '' }) {
        // Shared software-list view for the current platform (Browse/Search differ only in
        // the filter predicate + text). No directory -> message.
        const shortName = this.#pl.getSelectedPlatform()?.short_name;
        const title = shortName ? `${t(titleKey)} · ${shortName}` : t(titleKey);

        const model = this.#pl.get_software_dir();
        if (!model || !Array.isArray(model.items) || !Array.isArray(model.bases)) {
            this.#gamepad_menu.pushView({
                title,
                items: [{ id: '_empty', label: t('browse.noDir') }]
            });
            return;
        }

        // Sort once (tags first, then alphabetical) - like ListCommand.
        const sorted = model.items.slice().sort((a, b) => {
            const tagA = model.tags ? model.tags[a[1]] : null;
            const tagB = model.tags ? model.tags[b[1]] : null;
            if ((tagA && tagB) || (!tagA && !tagB)) {
                return a[0].localeCompare(b[0]);
            }
            return tagA ? -1 : 1;
        });

        // Filters by label (item[4] || item[0]) - like FindCommand on the visible name.
        // Also returns match position (matchStart/matchLen) for highlighting in the list.
        const buildItems = (filterText) => {
            const f = filterText.trim().toLowerCase();
            const result = [];

            for (const item of sorted) {
                const label = item[4] ? item[4] : item[0];
                let matchStart = -1;
                if (f.length > 0) {
                    matchStart = findMatch(label.toLowerCase(), f);
                    if (matchStart < 0) continue;
                }
                const baseIndex = item[1];
                const romName = item[0];
                const url = model.root + model.bases[baseIndex] + item[2];
                result.push({
                    id: url,
                    label,
                    matchStart,
                    matchLen: f.length,
                    romName,   // for the thumbnail (ThumbnailPreview resolves by file name)
                    onActivate: () => this.#loadBrowseRom(url, romName, label)
                });
            }
            return result;
        };

        this.#gamepad_menu.pushView({
            title,
            filterable: true,
            placeholder,
            buildItems,
            showThumbnails: true,
            minChars,
            emptyHint
        });
    }

    #openImport() {
        // Do NOT close the pad overlay - pad mode is a closed world. The OS-native picker
        // renders above the page (not subject to DOM z-index), so the overlay doesn't hide
        // it. Cancelling the picker leaves us in the pad menu. If a ROM is chosen,
        // emulationStarted() switches to EMULATION and the overlay disappears on its own.
        // Non-ROM imports (software dir/BIOS/collection) report a result -> confirmation screen.
        this.#open_command.openFilePicker((result) => {
            this.#gamepad_menu.notify(result);
        });
    }

    async #loadBrowseRom(url, romName, label) {
        // Close the shell and show the launch screen (covers the CLI while loading). It
        // starts in 'Loading…' and switches to 'press to start' on awaiting-launch-gesture.
        // The launch-settings dialog (if any) has a HIGHER z-index and appears above the
        // launch screen (see CSS).
        this.#gamepad_menu.close();
        this.#exitGamepadMenu();
        this.#launchedFromGamepad = true;
        this.#pendingLaunchTitle = label;
        // Skip the desktop/mobile launch-settings (Autoconfig) dialog in the shell - use
        // defaults (a dedicated shell form will come later).
        this.#pl.skipLaunchSettingsPromptOnce?.();
        this.#showLaunchScreen(label);
        try {
            await this.#pl.loadRomFileFromUrl(url, romName, label);
        } catch (error) {
            console.error('[gamepad-menu] load failed:', error);
            this.#setLaunchError(this.#friendlyLoadError(error));
        }
    }

    /** Maps a raw load error to a concise, readable message. */
    #friendlyLoadError(error) {
        return t('launch.error');
    }

    #setLaunchError(message) {
        const root = document.getElementById('gamepad-launch');
        if (!root) return;
        const s = document.getElementById('gamepadLaunchStatus');
        // Title stays (game name), status -> error message + how to go back.
        if (s) {
            s.innerHTML = `${message}<span class="gl-hint">${t('launch.errorBack')}</span>`;
        }
        root.classList.remove('awaiting');
        root.classList.add('visible', 'error');
        // The pad MAY now dismiss the error screen and return to the shell - arm the
        // trigger, but pointed at returning to the shell (not reloading).
        this.#gamepad.setMenuTrigger(true, () => {
            this.#hideLaunchScreen();
            this.#enterGamepadMenu();
        });
    }

    #showLaunchScreen(title) {
        const root = document.getElementById('gamepad-launch');
        if (!root) return;
        // Disable the shell trigger - otherwise a pad press on the launch screen opens the
        // shell over the loading screen.
        this.#gamepad.setMenuTrigger(false);
        const titleEl = document.getElementById('gamepadLaunchTitle');
        const s = document.getElementById('gamepadLaunchStatus');
        if (titleEl) titleEl.textContent = title || '';
        if (s) s.textContent = t('launch.loading');
        root.classList.remove('awaiting');
        root.classList.add('visible');
        document.body.classList.add('gamepad-launch-active');   // body bg = shell base (Safari chrome)
        // Hide the legend bar (its 'Press any button...' would clash with the launch screen).
        this.#gamepad.hideLegendBar?.();
    }

    #setLaunchAwaiting() {
        const root = document.getElementById('gamepad-launch');
        if (!root || !root.classList.contains('visible')) return;
        const s = document.getElementById('gamepadLaunchStatus');
        // One message (remote/keyboard/touch) - no separate hint about the pad.
        if (s) s.textContent = t('launch.press');
        root.classList.add('awaiting');
    }

    #hideLaunchScreen() {
        const root = document.getElementById('gamepad-launch');
        if (root) root.classList.remove('visible', 'awaiting', 'error');
        document.body.classList.remove('gamepad-launch-active');
    }

    // ===== In-game pad menu (long-press Start) =====

    /** Wires the in-game menu into GamepadManager (called when a game launches via pad). */
    #setupIngameMenu() {
        this.#ingameMenuOpen = false;
        this.#ingameFocus = 0;
        this.#ingameJoyState = { up: false, down: false, left: false, right: false, fire: false };
        this.#gamepad.setIngameMenu({
            openMenu: () => this.#openIngameMenu(),
            isMenuOpen: () => this.#ingameMenuOpen,
            navigate: (d) => this.#navigateIngameMenu(d),
            activate: () => this.#activateIngameMenu(),
            close: () => this.#closeIngameMenu(),
            // Joystick bridge: 'joystick-via-keyboard' platforms (Atari/C64...) don't listen
            // to the joypad for directions, so translate the d-pad/stick into the same
            // synthetic keys as touch (keyboard_joystick_mapping). null = no bridge.
            joystick: this.#hasIngameJoyBridge() ? (st) => this.#applyIngameJoystick(st) : null
        });
    }

    #hasIngameJoyBridge() {
        return !!window.__VME_KB_JOY_MAP;
    }

    /**
     * Translates pad direction/fire state to the retropad via Nostalgist.pressDown/pressUp -
     * the same path TOUCH uses (QuickshotComponent mode:'nostalgist'). Works in BOTH browsers
     * (Chrome and Safari), unlike synthetic keys which only reached the core in Chrome.
     * Fire -> 'b' (like A800 touch: SingleTouchButtonJoyListener('b')).
     */
    #applyIngameJoystick({ up, down, left, right, fire }) {
        const nostalgist = this.#pl.getNostalgist?.();
        if (!nostalgist) return;
        const prev = this.#ingameJoyState;
        const dirs = [
            ['up', up, 'up'],
            ['down', down, 'down'],
            ['left', left, 'left'],
            ['right', right, 'right'],
            ['fire', fire, 'b']
        ];
        for (const [name, now, button] of dirs) {
            if (now && !prev[name]) {
                nostalgist.pressDown?.(button);
            } else if (!now && prev[name]) {
                nostalgist.pressUp?.(button);
            }
        }
        this.#ingameJoyState = { up, down, left, right, fire };
    }

    /** Releases all held directions/fire (e.g. on opening the menu / leaving the game). */
    #releaseIngameJoystick() {
        if (!this.#ingameJoyState) return;
        this.#applyIngameJoystick({ up: false, down: false, left: false, right: false, fire: false });
    }

    #teardownIngameMenu() {
        this.#releaseIngameJoystick();
        this.#closeIngameMenu();
        this.#gamepad.setIngameMenu(null);
    }

    #ingameItems() {
        const hasSave = this.#ingameLatestSaveId != null;
        return [
            { label: t('ingame.resume'), run: () => this.#closeIngameMenu() },
            { label: t('ingame.saveState'), run: async () => { await this.#pl.saveState(); this.#closeIngameMenu(); } },
            // Load the newest save of the current game in place; disabled when no save exists.
            { label: t('ingame.loadState'), disabled: !hasSave, run: () => this.#loadIngameState() },
            // Restart: resume FIRST (the core must be running frames), then RESET - otherwise
            // RetroArch ignores RESET while paused (frozen loop). Close the menu WITHOUT
            // resuming again (already resumed below).
            { label: t('ingame.restart'), run: () => {
                const n = this.#pl.getNostalgist();
                this.#closeIngameMenu(true);   // hide overlay, don't call resume here
                n?.resume?.();
                setTimeout(() => {
                    try { n?.sendCommand?.('RESET'); } catch (e) { console.error('[ingame] reset failed', e); }
                }, 60);
            } },
            { label: t('ingame.exit'), run: () => { location.reload(); } }
        ];
    }

    async #openIngameMenu() {
        if (this.#ingameMenuOpen) return;
        const root = document.getElementById('gamepad-ingame');
        if (!root) return;
        this.#releaseIngameJoystick();   // release held directions so they don't stick in-game
        this.#ingameMenuOpen = true;
        this.#pl.getNostalgist()?.pause?.();

        // Look up the newest save of the current game (to enable 'Load state').
        this.#ingameLatestSaveId = null;
        try {
            const program = this.#pl.getProgramName?.();
            const platformId = this.#pl.getSelectedPlatform?.()?.platform_id;
            const metas = await this.#db.getAllSaveMeta();   // newest first
            const m = metas.find(x => x.program_name === program && x.platform_id === platformId);
            if (m) this.#ingameLatestSaveId = m.id;
        } catch (e) {
            console.error('[ingame] save lookup failed:', e);
        }
        if (!this.#ingameMenuOpen) return;   // closed during the await

        const titleEl = document.getElementById('gamepadIngameTitle');
        if (titleEl) titleEl.textContent = this.#pendingLaunchTitle || t('ingame.resume');

        const items = this.#ingameItems();
        // Start focused on the first ENABLED item (skip disabled).
        this.#ingameFocus = items.findIndex(it => !it.disabled);
        if (this.#ingameFocus < 0) this.#ingameFocus = 0;

        const listEl = document.getElementById('gamepadIngameList');
        if (listEl) {
            listEl.innerHTML = '';
            items.forEach((item, i) => {
                const row = document.createElement('div');
                row.className = 'gm-item'
                    + (i === this.#ingameFocus ? ' focused' : '')
                    + (item.disabled ? ' gm-item-disabled' : '');
                const label = document.createElement('span');
                label.className = 'gm-item-label';
                label.textContent = item.label;
                row.appendChild(label);
                listEl.appendChild(row);
            });
        }
        root.classList.add('visible');
    }

    #navigateIngameMenu(delta) {
        const items = this.#ingameItems();
        const n = items.length;
        if (!n) return;
        // Skip disabled items.
        let idx = this.#ingameFocus;
        for (let step = 0; step < n; step++) {
            idx = (idx + delta + n) % n;
            if (!items[idx].disabled) break;
        }
        this.#ingameFocus = idx;
        document.querySelectorAll('#gamepadIngameList .gm-item').forEach((el, i) => {
            el.classList.toggle('focused', i === this.#ingameFocus);
        });
    }

    #activateIngameMenu() {
        const item = this.#ingameItems()[this.#ingameFocus];
        if (item && !item.disabled) item.run?.();
    }

    /** Load the newest save of the current game in place (no restart), then resume. */
    async #loadIngameState() {
        const id = this.#ingameLatestSaveId;
        if (id == null) return;
        const nostalgist = this.#pl.getNostalgist?.();
        if (!nostalgist) return;
        let data;
        try {
            data = await this.#db.getSaveData(id);
        } catch (e) {
            console.error('[ingame] load state failed:', e);
            this.#closeIngameMenu();
            return;
        }
        // RESUME the game BEFORE LOAD_STATE - RetroArch only processes LOAD_STATE while the
        // core is running frames (like RESET). Loading while paused was lost and desynced
        // the pause state (menu vanished but game stayed paused / next menu didn't pause).
        // Close the menu WITHOUT resuming again (already resumed).
        this.#closeIngameMenu(true);
        nostalgist.resume?.();
        setTimeout(async () => {
            try {
                if (data && data.save_data) await nostalgist.loadState(data.save_data);
            } catch (e) {
                console.error('[ingame] load state failed:', e);
            }
        }, 60);
    }

    #closeIngameMenu(skipResume = false) {
        if (!this.#ingameMenuOpen) return;
        this.#ingameMenuOpen = false;
        const root = document.getElementById('gamepad-ingame');
        if (root) root.classList.remove('visible');
        // Resume the game (unless the action already did - e.g. restart()).
        if (!skipResume) this.#pl.getNostalgist()?.resume?.();
    }

    #enterGamepadMenu() {
        if (this.#gamepad_menu.isOpen()) return;

        // Entering pad mode - stop listening for the trigger and route input to the pad screen.
        this.#gamepad.setMenuTrigger(false);
        this.#gamepad.setGuiNavigationEnabled(false); // calls clearMenuFocus() internally

        this.#gamepad.setGamepadMenuActive(true, {
            navigate: (deltaRow, deltaCol) => this.#gamepad_menu.navigate(deltaRow, deltaCol),
            activate: () => this.#gamepad_menu.activate(),
            back: () => this.#gamepad_menu.back(),
            toggleFilter: () => this.#gamepad_menu.toggleFilter(),
            backspace: () => this.#gamepad_menu.backspaceExternal()
        });
        // open() triggers #emitContext -> #updateMenuLegend sets the right legend.
        this.#gamepad_menu.open();
        // The bottom legend bar appears only NOW (shell active), not when the pad connects.
        this.#gamepad.showLegendBar();

        this.#refreshPlatformReady();
    }

    #openBrowserFromShell(openFn) {
        // Opening a browser from the shell: mark it so closing returns to the shell (not the
        // classic CLI). The flag is consumed in toggleScreen(MENU).
        this.#return_to_shell = true;
        // Pad skin: same browser, but restyled to match the shell via a <body> class.
        // Touch/desktop do NOT get this class -> they look as before.
        document.body.classList.add('gamepad-browser-skin');
        openFn();
    }

    async #refreshPlatformReady() {
        const ready = await this.#pl.isSelectedPlatformReady();
        if (ready === this.#platform_ready) return;
        this.#platform_ready = ready;
        // Rebuild the root only if the menu is open and we're on it (not in a sub-screen).
        if (this.#gamepad_menu.isOpen() && this.#gamepad_menu.isAtRoot()) {
            this.#gamepad_menu.replaceRoot(this.#buildGamepadRootView());
        }
    }

    #updateGamepadThumbnail(item) {
        if (item && item.romName) {
            this.#gamepad_thumbnail.show(item.romName);
        } else {
            this.#gamepad_thumbnail.hide();
        }
    }

    #updateMenuLegend(ctx) {
        // Legend depends on context (per focus mode).
        let actions;
        if (ctx.screen === 'keyboard') {
            actions = [
                { glyph: 'A', label: t('legend.type') },
                { glyph: 'Y', label: t('legend.delete') },
                { glyph: 'X', label: t('legend.list') },
                { glyph: 'B', label: t('legend.back') }
            ];
        } else if (ctx.screen === 'list') {
            actions = [
                { glyph: 'A', label: t('legend.select') },
                { glyph: 'B', label: t('legend.back') }
            ];
            if (ctx.filterable) {
                actions.splice(1, 0, { glyph: 'X', label: t('legend.filter') });
            } else if (ctx.secondaryLabel) {
                // View with a secondary X action (e.g. Recent: platform filter).
                actions.splice(1, 0, { glyph: 'X', label: ctx.secondaryLabel });
            }
        } else {
            actions = [
                { glyph: 'A', label: t('legend.select') },
                { glyph: 'B', label: t('legend.exit') }
            ];
        }
        this.#gamepad.showLegendActions(actions);
    }

    #exitGamepadMenu() {
        // Return to the classic CLI: stop routing to the pad screen and re-arm the trigger
        // so it can be re-entered.
        this.#gamepad.setGamepadMenuActive(false);
        this.#gamepad.setGuiNavigationEnabled(true);
        this.#gamepad.setMenuTrigger(true, () => this.#enterGamepadMenu());
        this.#gamepad.hideLegendBar();
    }

    hasGamepad() {
        if (this.#gamepad && this.#gamepad.hasGamepad()) {
            return true;
        }

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                return true;
            }
        }

        return false;
    }

    getGamepadManager() {
        return this.#gamepad;
    }

    /** Whether the current game launch came from the gamepad shell (Browse/Search) or the
     *  browser skin. Used e.g. to honor 'Fill screen' (MAXIMIZE_IMAGE) only in the shell, not the CLI. */
    isGamepadLaunch() {
        return this.#launchedFromGamepad
            || document.body.classList.contains('gamepad-browser-skin');
    }

    /** Mark that leaving the browser should return to the gamepad shell (not the CLI). Used
     *  when the browser was opened NOT from the shell (e.g. Collection autostart via BOOT_TO)
     *  but the user used the pad (enabled the skin) - exit should land in the shell. */
    markReturnToShell() {
        this.#return_to_shell = true;
    }

    clearCollectionCache() {
        if (this.#collection_browser) {
            this.#collection_browser.clearCache();
        }
    }

}
