import { CommandBase } from './CommandBase.js';

export class SplashCommand extends CommandBase {
    #gamepad;
    #playing = false;

    constructor(gamepad) {
        super();
        this.#gamepad = gamepad;
    }

    get_keywords() {
        return ['splash'];
    }

    get_help() {
        return ['splash', 'show the VM/E splash screen'];
    }

    is_enter_required() {
        return true;
    }

    async process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.cli.print('Press ENTER to display the splash screen.');
            return;
        }
        if (this.#playing) return;
        this.#playing = true;
        this.cli.set_loading(true);
        const navigationEnabled = this.#gamepad.guiNavigationEnabled;
        const triggerEnabled = this.#gamepad.isMenuTriggerEnabled();
        this.#gamepad.setGuiNavigationEnabled(false);
        this.#gamepad.setMenuTrigger(false);
        this.#gamepad.stopAutoRepeat();
        try {
            const { showSplash } = await import('../startup/SplashScreen.js');
            await showSplash({
                version: __APP_VERSION__,
                mode: 'manual',
                // Restore the CLI behind the opaque overlay before the final dissolve.
                onReady: () => this.cli.set_loading(false),
            });
        } catch (error) {
            console.error('Could not display splash screen', error);
            this.cli.print('Could not display the splash screen.');
        } finally {
            this.cli.set_loading(false);
            this.#gamepad.setGuiNavigationEnabled(navigationEnabled);
            this.#gamepad.setMenuTrigger(triggerEnabled);
            this.#playing = false;
        }
    }
}
