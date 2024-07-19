import { s } from '../dom.js';
import { CommandBase } from './CommandBase.js';
import { createGuiButton } from '../GuiButton.js';

export class CLI {
    #kb_event_bound;
    #is_loading;
    #default_clear_handler;
    #currentIndex;
    #lines = [];
    static #corsQuery = document.getElementById('cors_query');;
    #articleMode;


    constructor() {
        this.#currentIndex = -1;
        this.#articleMode = false;
        this.cursorShowing = false;
        this.directMode = false;

        this.commands = [];
        this.default_command_name = null;
        this.is_command_selectable = false;
        this.is_enter_required = false;

        this.#kb_event_bound = this.#kb_event.bind(this);

        this.set_loading(false);

        createGuiButton('menu-item-system', 'System', 'sys', () => {
            CLI.#corsQuery.textContent = 'sys ';
            this.parse_input(CLI.#corsQuery.textContent);
        });

        createGuiButton('menu-item-help', 'Help', '?', () => {
            CLI.#corsQuery.textContent = 'help';
            this.parse_input(CLI.#corsQuery.textContent);
        });
    }

    #showCursor() {
        s('#cursor').classList.add('blinking');
    }

    #hideCursor() {
        s('#cursor').classList.remove('blinking');
    }

    set_selection_mode(val) {
        if (val) {
            this.#hideCursor();
        } else {
            this.#showCursor();
            if (this.selected_command) {
                this.selected_command.selection_changed();
            }
        }
    }

    set_loading(val) {
        this.#is_loading = val;
        if (val) {
            this.#hideCursor();
        } else {
            this.#showCursor();
        }
    }

    set_article_mode(val) {
        this.#articleMode = val;
    }

    #kb_event(event) {
        event.preventDefault();
        if (this.#is_loading) {
            return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.process_input(event.key);
        } else if (event.key === 'Backspace') {
            this.process_input('backspace');
        } else if (event.key == 'Enter') {
            this.process_input('enter');
        } else if (event.key === 'Escape') {
            this.process_input('escape');
        } else if (event.key === 'ArrowDown') {
            if (this.#articleMode) {
                let div = s('#cors_results');
                div.scrollTop += div.offsetHeight;
            } else if (this.#currentIndex != -1) {
                let items = s('#cors_results').children;
                if (this.#currentIndex < items.length - 1) {
                    this.#currentIndex++;
                }
                else if (this.#currentIndex == items.length - 1) {
                    this.#currentIndex = 0;
                }
            } else if (!this.is_command_selectable) {
                let div = s('#cors_results');
                div.scrollTop += div.offsetHeight;
            }
        } else if (event.key === 'ArrowUp') {
            if (this.#articleMode) {
                let div = s('#cors_results');
                div.scrollTop -= div.offsetHeight;
            } else if (this.#currentIndex != -1) {
                let items = s('#cors_results').children;
                if (this.#currentIndex > 0) {
                    this.#currentIndex--;
                }
                else if (this.#currentIndex == 0) {
                    this.#currentIndex = items.length - 1;
                }
            } else if (!this.is_command_selectable) {
                let div = s('#cors_results');
                div.scrollTop -= div.offsetHeight;
            }
        }
        this.update();
    }

    on() {
        document.addEventListener('keydown', this.#kb_event_bound);
    }

    off() {
        document.removeEventListener('keydown', this.#kb_event_bound);
    }

    update() {
        if (this.is_command_selectable) {
            const container = s('#cors_results');
            let items = [...container.children];
            items = items.filter(item => item.classList.contains('corsrow'));
            if (items.length == 0) return;
            items.forEach(item => item.querySelector('span').classList.remove('highlight'));
            if (this.#currentIndex >= 0) {
                this.#addFlashingClass(items[this.#currentIndex].querySelector('span'));
                this.selected_command.selection_changed(items[this.#currentIndex]);
            }
            if (this.#currentIndex != -1) {
                if (!this.#isElementInContainerViewport(items[this.#currentIndex].querySelector('span'), container)) {
                    items[this.#currentIndex].scrollIntoView({ behavior: 'auto', block: 'start', inline: 'start' });
                }
            }
        }
    }

    #addFlashingClass(element) {
        element.classList.remove('highlight');
        void element.offsetWidth;
        element.classList.add('highlight');
    }

    process_input(value) {
        let is_enter = false;
        if (value.length === 1) {
            if (this.#currentIndex == -1) CLI.#corsQuery.textContent += value;
        } else if (value === 'Backspace' || value === 'backspace') {
            if (this.#currentIndex == -1) CLI.#corsQuery.textContent = CLI.#corsQuery.textContent.slice(0, -1);
        } else if (value === ' ' || value === 'space') {
            if (this.#currentIndex == -1) CLI.#corsQuery.textContent += ' ';
        } else if (value === 'clear') {
            if (this.#currentIndex == -1) CLI.#corsQuery.textContent = '';
            if (this.#default_clear_handler instanceof Function) this.#default_clear_handler();
        } else if (value == 'escape') {
            this.#articleMode = false;
            if (this.#currentIndex >= 0) {
                this.#currentIndex = -1;
                this.set_selection_mode(false);
            } else if (this.#currentIndex == -1) {
                this.process_input('clear');
                this.set_selection_mode(false);
            }
        } else if (value == 'enter') {
            if (this.#articleMode) return;

            is_enter = true;

            let items = s('#cors_results').children;
            if (this.is_enter_required && this.#currentIndex == -1) {
                is_enter = true;
            }
            else
                if (this.is_command_selectable && this.#currentIndex == -1) {
                    if (items.length > 0) this.#currentIndex++;
                    this.set_selection_mode(true);
                } else if (this.#currentIndex >= 0) {
                    this.#simulateClick(items[this.#currentIndex]);
                    this.selected_command.selection_changed();
                    // this.selected_command.process_selection(items[currentIndex].dataset.value);
                    // currentIndex = -1;
                    // showCursor();
                    // ???
                    return;
                }
        }
        this.parse_input(CLI.#corsQuery.textContent, is_enter);
    }

    register_command(command) {
        if (command instanceof CommandBase) {
            this.commands.push(command);
            command.set_cli(this);
        } else {
            throw new Error('Invalid command');
        }
    }

    register_default(command_name) {
        this.default_command_name = command_name;
    }

    #clearResults() {
        this.clear();
    }

    #clearPrefix() {
        s("#cors_query_prefix").style.display = "none";
        s('#cors_query_prefix').innerHTML = "";
    }

    #setPrefix(prefix) {
        s("#cors_query_prefix").style.display = "inline";
        s('#cors_query_prefix').innerHTML = prefix + " ";
    }

    parse_hidden_input() {
        let query = CLI.#corsQuery.textContent;
        this.parse_input(CLI.#corsQuery.textContent, query == "open");
    }

    parse_input(input, is_enter) {
        input = input.trim().toLowerCase();
        const tokens = input.split(/\s+/);
        const [command, ...parameters] = tokens;

        this.#clearPrefix();
        this.#clearResults();

        let selected_command = null;
        let params = null;

        for (let cmd of this.commands) {
            const keywords = cmd.get_keywords();
            if (keywords.includes(command)) {
                selected_command = cmd;
                params = parameters;
                break;
            }
        }

        if (selected_command == null && this.default_command_name && input.length > 3) {
            for (let cmd of this.commands) {
                const keywords = cmd.get_keywords();
                if (keywords.includes(this.default_command_name)) {
                    selected_command = cmd;
                    params = tokens;
                    this.#setPrefix(this.default_command_name);
                    break;
                }
            }
        }

        if (selected_command != null) {
            this.is_command_selectable = selected_command.is_selection_enabled();
            this.selected_command = selected_command;
            selected_command.process_input(params, is_enter);
        } else {
            this.selected_command = null;
        }
    }

    print_help() {
        this.clear();
        this.#lines.push("CLI commands:");
        this.commands.forEach((command) => {
            this.#lines.push("&nbsp;");
            this.#lines.push("<p style='margin-left: 1ch;'>" + command.get_help()[0] + "</p>");

            this.#lines.push("<p style='margin-left: 3ch;'>" + command.get_help()[1] + "</p>");
        });

        var table = s("#cors_results");
        table.innerHTML = "";

        this.#lines.forEach(msg => {
            var td = document.createElement('div');
            var p = document.createElement('p');
            p.innerHTML = msg;
            td.appendChild(p);
            table.append(td);
        });
    }

    redraw() {
        var table = s("#cors_results");
        table.innerHTML = "";
        this.#lines.forEach(msg => {
            var td = document.createElement('div');
            var p = document.createElement('p');
            p.innerHTML = msg;
            td.appendChild(p);
            table.append(td);
        });
    }

    clear() {
        this.#lines = [];
        var table = s("#cors_results");
        table.innerHTML = "";
    }

    reset() {
        this.#currentIndex = -1;
        this.#articleMode = false;
        CLI.#corsQuery.textContent = '';
        this.#clearPrefix();
        this.set_selection_mode(false);
        this.set_loading(false);
        this.clear();
    }

    message_clear(...messages) {
        this.clear();
        this.message(messages);
    }

    message(...messages) {
        messages.forEach(line => this.#lines.push(line));
        this.#lines.push('&nbsp;');
        this.#lines.push('Press any key to continue.');
        this.redraw();

        // temporary
        document.addEventListener('click', function () {
            setTimeout(function () {
                location.reload();
            }, 120);
        });

        document.addEventListener('keydown', function () {
            setTimeout(function () {
                location.reload();
            }, 120);
        });
    }

    print_progress(line) {
        let p = s("#progress_line");
        if (p == null) {
            const table = s("#cors_results");
            const div = document.createElement('div');
            p = document.createElement('p');
            p.id = 'progress_line';
            div.appendChild(p);
            table.append(div);
        }
        p.innerHTML = line;
    }

    print(line) {
        this.#lines.push(line);
        this.redraw();
    }

    soft_msg(line) {
        this.clear();
        this.#lines.push(line);
        this.redraw();
    }

    #isElementInContainerViewport(element, parent) {
        const elementRect = element.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        return (
            elementRect.top >= parentRect.top &&
            elementRect.left >= parentRect.left &&
            elementRect.bottom <= parentRect.bottom &&
            elementRect.right <= parentRect.right
        );
    }

    #simulateClick(element) {
        if (element == undefined) return;

        var event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(event);
    }

    set_default_handler(handler) {
        this.#default_clear_handler = handler;
    }
}