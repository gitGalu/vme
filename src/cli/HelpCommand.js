import { CommandBase } from './CommandBase.js';
import { CLI } from './CLI.js';

export class HelpCommand extends CommandBase {
    get_keywords() {
        return ['help'];
    }

    get_help() {
        return ['help', 'show available commands'];
    }

    process_input(input) {
        this.cli.print_help();
    }
}