export class NetworkManager {
    #proxy_url;

    constructor() {
    }

    set_proxy(proxy_url) {
        this.#proxy_url = proxy_url;
    }

    async fetch(url, use_proxy) {
        if (use_proxy && this.#proxy_url) {
            url = this.#proxy_url + encodeURIComponent(url);
            return await fetch(url);
        } else {
            return await fetch(url);
        }
    }
}
