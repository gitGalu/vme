import { CLI } from './CLI.js';
import { s } from '../dom.js';
import { StorageManager } from '../storage/StorageManager.js';


export class CommandBase {

    constructor() {
        if (new.target === CommandBase) {
            throw new Error();
        }
    }

    get_keywords() {
        throw new Error();
    }

    get_help() {
        throw new Error();
    }

    process_input(input, is_enter_pressed) {
        throw new Error();
    }

    install() {
    }

    uninstall() {
    }

    is_selection_enabled() {
        return false;
    }

    is_enter_required() {
        return false;
    }

    exit_selection() {
        return false;
    }

    process_selection(item) {
        return false;
    }

    set_cli(cli) {
        this.cli = cli;
    }

    #show_results(results, force_selection) {
        const container = s("#cors_results");
        container.innerHTML = "";
    
        results.forEach((item) => {
            const p = document.createElement('p');
            p.setAttribute('data-value', item.data);
            p.classList.add('corsrow');
    
            const span = document.createElement('span');
            if (StorageManager.getValue("LINES") != "single") {
            } else {
                span.classList.add('singleline');
            }
    
            if (item.tag) {
                const tagSpan = document.createElement('span');
                tagSpan.classList.add('tag');
                tagSpan.innerHTML = "[" + item.tag + "] ";
                span.appendChild(tagSpan);
            }
    
            span.append(item.label);
            p.append(span);
            p.addEventListener('click', id => {
                this.process_selection(item);
            });
            container.append(p);
        });
    
        if (results.length > 0 && force_selection) {
            this.cli.set_selection_mode(true);
            this.cli.update();
        }
    }

    show_results(results, force_selection) {
        if (results == []) {
            return;
        }
        this.#show_results(results, force_selection);
    }

    selection_changed(item) {
    }
}