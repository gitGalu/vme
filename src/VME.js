import { s, show, hide, addButtonEventListeners } from './dom.js';
import { CLI } from './cli/CLI.js';
import { SaveBrowser } from './SaveBrowser.js';
import { CollectionBrowser } from './CollectionBrowser.js';
import { KeyboardManager } from './keyboard/KeyboardManager.js';
import { StorageManager } from './storage/StorageManager.js';
import { HelpCommand } from './cli/HelpCommand.js';
import { SystemCommand } from './cli/SystemCommand.js';
import { ListCommand } from './cli/ListCommand.js';
import { FindCommand } from './cli/FindCommand.js';
import { SetCommand } from './cli/SetCommand.js';
import { OpenCommand } from './cli/OpenCommand.js';
import { AboutCommand } from './cli/AboutCommand.js';
import { LastCommand } from './cli/LastCommand.js';
import { WikiCommand } from './cli/WikiCommand.js';
import { RestoreCommand } from './cli/RestoreCommand.js';
import { BrowseCommand } from './cli/BrowseCommand.js';
import { PlatformManager } from './platforms/PlatformManager.js';
import { UiManager } from './ui/UiManager.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { isMobile } from 'react-device-detect';
import { JOYSTICK_TOUCH_MODE, BOOT_TO, BOOT_TO_COLLECTION_BROWSER, COLLECTION_BROWSER_COLLECTION_INDEX, COLLECTION_BROWSER_ITEM_INDEX } from './Constants.js';
import { ButtonManager } from './ButtonManager.js';
import { Debug } from './Debug.js';

export class VME {
    #cli;
    #kb;
    #env;
    #pl;
    #db;
    #ui;

    #save_browser;
    #collection_browser;

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
        if (this.#guard()) {
            show("#warningStandalone", "block");
            show("html");
            return;
        }

        this.#cli = new CLI();
        this.#kb = new KeyboardManager(this.#cli);
        this.#db = new StorageManager();
        this.#pl = new PlatformManager(this, this.#cli, this.#db);
        this.#env = new EnvironmentManager(this.#pl);
        this.#ui = new UiManager(this.#pl, this.#kb);
        this.#save_browser = new SaveBrowser(this, this.#pl, this.#db, this.#cli);
        this.#collection_browser = new CollectionBrowser(this, this.#pl, this.#db, this.#cli);

        this.#kb.clicks_on();

        this.#cli.register_command(new HelpCommand());
        this.#cli.register_command(new RestoreCommand(this.#save_browser));
        this.#cli.register_command(new BrowseCommand(this.#collection_browser));
        this.#cli.register_command(new OpenCommand(this.#pl));
        this.#cli.register_command(new ListCommand(this.#pl));
        this.#cli.register_command(new FindCommand(this.#pl));
        this.#cli.register_command(new SystemCommand(this.#pl));
        this.#cli.register_command(new SetCommand());
        this.#cli.register_command(new LastCommand(this.#pl));
        this.#cli.register_command(new WikiCommand());

        this.#cli.register_default('find');

        this.#addListeners();

        this.#kb.initButtons();

        this.#cli.register_command(new AboutCommand(this.#pl));

        let bm = new ButtonManager(this.#cli);
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
        window.addEventListener('resize', () => EnvironmentManager.resizeCanvas(this.#pl.getNostalgist()));
        window.addEventListener('resize', () => EnvironmentManager.detectDevice());
        window.addEventListener('orientationchange', () => EnvironmentManager.detectDevice());
        window.addEventListener('gamepaddisconnected', () => EnvironmentManager.detectDevice());
        window.addEventListener('gamepadconnected', () => EnvironmentManager.detectDevice());
    }

    #guard() {
        const params = new URLSearchParams(window.location.search);
        const isPwa = params.get('source') === 'pwa';

        if (isMobile && !((window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || isPwa)) {
            return true;
        }
    }

    emulationStarted() {
        let defaultController = this.#pl.getSelectedPlatform().default_touch_controller;

        this.#ui.initQuickJoy();
        this.#ui.initQuickshot();
        this.#ui.initMousepad();
        this.#ui.initHideaway();

        this.#ui.initFastUI();

        if (defaultController) {
            UiManager.toggleJoystick(defaultController, false);
        } else {
            UiManager.toggleJoystick(JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY, false);
        }

        this.#ui.initDesktopUI();

        this.toggleScreen(VME.CURRENT_SCREEN.EMULATION);
        EnvironmentManager.updateDeviceType();

        this.#ui.initTouchControllerMenu();
        EnvironmentManager.resizeCanvas(this.#pl.getNostalgist());
    }

    toggleScreen(mode) {
        switch (mode) {
            case VME.CURRENT_SCREEN.MENU:
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
                break;
            case VME.CURRENT_SCREEN.EMULATION:
                this.#cli.off();
                hide('#warningStandalone');
                hide('#settings');
                hide('#save-browser');
                hide('#collection-browser');
                show('#emulator', 'block');

                if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
                    hide('#fastui', 'grid');
                    hide('#quickshots');
                    hide('#quickshot');
                    hide('#quickjoys');
                    hide('#quickjoy');
                } else {
                    show('#fastui', 'grid');
                }
                this.#kb.hideTouchKeyboard();
                this.#kb.clicks_off();
                this.#kb.updateMode(mode);
                document.body.classList.add('black');
                break;
            case VME.CURRENT_SCREEN.SAVE_BROWSER:
                this.#cli.off();
                hide('#warningStandalone');
                hide('#settings');
                hide('#emulator');
                hide('#collection-browser');
                show('#save-browser', 'flex');
                document.body.classList.add('black');
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
                break;
        }
    }


}