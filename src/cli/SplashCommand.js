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
        return this.play();
    }

    async play(mode = 'manual') {
        if (this.#playing) return;
        this.#playing = true;
        const manual = mode === 'manual';
        const wasLoading = this.cli.is_loading();
        if (manual) this.cli.reset();
        this.cli.set_loading(true);
        const navigationEnabled = this.#gamepad.guiNavigationEnabled;
        const triggerEnabled = this.#gamepad.isMenuTriggerEnabled();
        this.#gamepad.setGuiNavigationEnabled(false);
        this.#gamepad.setMenuTrigger(false);
        this.#gamepad.stopAutoRepeat();
        let cliRestored = false;
        const restoreCli = () => {
            if (cliRestored) return;
            cliRestored = true;
            if (manual) this.cli.process_input('escape');
            this.cli.set_loading(wasLoading);
        };
        try {
            const { showSplash } = await import('../startup/SplashScreen.js');
            await showSplash({
                version: __APP_VERSION__,
                mode,
                // Restore the CLI behind the opaque overlay before the final dissolve.
                onReady: restoreCli,
            });
        } catch (error) {
            console.error('Could not display splash screen', error);
            restoreCli();
            if (manual) this.cli.print('Could not display the splash screen.');
        } finally {
            restoreCli();
            this.#gamepad.setGuiNavigationEnabled(navigationEnabled);
            this.#gamepad.setMenuTrigger(triggerEnabled);
            this.#playing = false;
        }
    }
}
