import { CommandBase } from './CommandBase.js';
import { s } from '../dom.js';


export class WikiCommand extends CommandBase {
    #wiki_lang = 'en';

    get_keywords() {
        return ['wiki'];
    }

    get_help() {
        return ['wiki [QUERY]', 'find and read WikiPedia(tm) articles'];
    }

    process_input(parameters, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Query + enter to search WikiPedia(tm)");
            this.cli.redraw();
            return;
        } else {
            this.cli.clear();
            this.cli.print("Connecting to WikiPedia(tm)...");
            this.cli.redraw();

            this.get_wiki_results(parameters.join(' '))
                .then(results => {
                    if (results.length > 0) {
                        this.currentIndex = 0;
                        this.show_results(results, true);
                    } else {
                        this.show_results([]);
                    }
                })
        }
    }

    #add_wiki_styles() {
        var styleId = 'wiki-style';

        if (!document.getElementById(styleId)) {
            var style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                #wiki img {
                    display: none;
                }
                #wiki .image, 
                #wiki .caption {
                    display: none;
                }
                #wiki {
                    line-height: 200%;
                }
                #wiki h1, h2, h3, h4, h5, h6 {
                }
            `;
            document.head.appendChild(style);
        }
    }

    exit_selection() {
        return true;
    }

    process_selection(item) {
        this.currentIndex = -1;
        this.cli.set_article_mode(true);
        this.get_wiki_article(item.label)
            .then(results => {
                this.cli.clear();
                var table = s("#cors_results");
                table.innerHTML = "";
                this.#add_wiki_styles();
                var td = document.createElement('div');
                td.id = 'wiki';
                td.innerHTML = results;
                table.append(td);
                return;
            });
    }

    is_selection_enabled() {
        return true;
    }

    is_enter_required() {
        return true;
    }

    #remove_accents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    async get_wiki_results(str) {
        try {
            const response = await fetch(`https://${this.#wiki_lang}.wikipedia.org/w/api.php?action=opensearch&search=${str}&limit=20&namespace=0&format=json&origin=*`);
            const data = await response.json();
            let results = [];
            data[1].forEach((item, index) => {
                let row = {
                    label: data[1][index],
                    url: data[3][index]
                }
                results.push(row);
            });
            return results;
        } catch (error) {
            console.error('Error fetching Wikipedia(tm) results:', error);
            return [];
        }
    }

    async get_wiki_article(id) {
        try {
            const response = await fetch(`https://${this.#wiki_lang}.wikipedia.org/w/api.php?action=query&titles=${id}&prop=extracts&format=json&origin=*`);
            const data = await response.json();
            const pages = data.query.pages;
            let result = pages[Object.keys(pages)[0]].extract;
            result = this.#remove_accents(result);
            return result;
        } catch (error) {
            console.error('Error fetching Wikipedia(tm) article:', error);
        }
    }
}