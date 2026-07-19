/**
 * Internationalization ONLY for the gamepad shell (menu, subscreens, legend, messages).
 * The classic CLI and browsers stay in English. Language is in StorageManager (key SHELL_LANG).
 *
 * Usage: import { t, getShellLang, setShellLang } from './i18n/shellStrings.js';
 *   t('menu.platform')  -> "Platform" / "Platforma"
 * Missing key -> returns the key (visible in the UI, easy to spot).
 */
import { StorageManager } from '../storage/StorageManager.js';

const LANG_KEY = 'SHELL_LANG';
export const SHELL_LANGS = ['en', 'pl'];

const STRINGS = {
    en: {
        // App / root
        'app.title': 'VME',

        // Main menu
        'menu.platform': 'Platform',
        'menu.recent': 'Recent',
        'menu.search': 'Search files',
        'menu.browse': 'Browse files',
        'menu.open': 'Open / Import',
        'menu.saves': 'Save states',
        'menu.collections': 'Collections',
        'menu.settings': 'Settings',
        'crumb.collection': 'Collection',
        'crumb.saves': 'Save states',
        'crumb.allPlatforms': 'All platforms',

        // Platform subview
        'platform.title': 'Platform',
        'platform.placeholder': 'Start typing to filter',

        // Browse / Search
        'browse.title': 'Browse files',
        'browse.placeholder': 'Type first letters…',
        'search.title': 'Search files',
        'search.placeholder': 'Search titles…',
        'search.minHint': 'Type at least 3 letters to search.',
        'browse.noDir': 'No software directory. Use Open / Import first.',

        // Recent
        'recent.title': 'Recent',
        'recent.platformTitle': 'Recent · Platform',
        'recent.allPlatforms': 'All platforms',
        'recent.empty': 'No recent games yet.',
        // Relative time (Recent). {n} = count. PL uses plural forms in formatRelative.
        'time.justNow': 'just now',
        'time.minAgo': '{n} min ago',
        'time.hrAgo': '{n}h ago',
        'time.yesterday': 'yesterday',
        'time.daysAgo': '{n} days ago',
        'time.weeksAgo': '{n} weeks ago',
        'time.monthsAgo': '{n} months ago',
        'recent.emptyPlatform': 'No recent games for this platform.',
        'recent.continue': 'Continue (latest save)',
        'recent.startOver': 'Start over',
        'recent.cancel': 'Cancel',

        // Settings
        'settings.title': 'Settings',
        'settings.display': 'Display',
        'display.authentic': 'Authentic (CRT/LCD effect)',
        'display.pixel': 'Pixel-perfect',
        'display.fill': 'Fill screen',
        'display.lowperf': 'Performance',
        'settings.language': 'Language',
        'settings.enterCode': 'Enter code',
        'settings.fpsMeter': 'FPS overlay',
        'settings.exitCli': 'Exit to CLI',
        'common.on': 'On',
        'common.off': 'Off',

        // Enter code
        'code.title': 'Enter code',
        'code.placeholder': 'Code…',
        'code.hint': 'Enter a code, then press ↵',
        'code.unknown': 'Unknown code.',

        // Import / notices
        'import.importing': 'Importing…',
        'import.done': 'Imported. Reloading…',
        'import.failed': 'Couldn’t import.',
        'notice.done': 'Done',
        'notice.error': 'Error',
        'notice.ok': 'OK',

        // Launch screen (press to start)
        'launch.loading': 'Loading…',
        'launch.press': 'Press a remote or keyboard button, or tap to start',
        'launch.error': 'Couldn’t download the program file.',
        'launch.errorBack': 'Press any button to go back',
        'launch.vr': 'Start in VR',
        'launch.mr': 'Start in MR (passthrough)',
        'launch.vrHint': 'In VR: click the right stick for the menu',
        'menu.vr2dOnly': 'Not in VR',

        // In-game menu
        'ingame.resume': 'Resume',
        'ingame.saveState': 'Save state',
        'ingame.loadState': 'Load state',
        'ingame.restart': 'Restart',
        'ingame.exitVr': 'Back to 2D',
        'ingame.anchor': 'Screen anchor',
        'ingame.anchorWorld': 'In space',
        'ingame.anchorHead': 'Follows view',
        'ingame.screenHint': 'Right stick: screen distance (↕) and size (↔)',
        'vr.savesEmpty': 'No save states yet',
        'vr.collectionsEmpty': 'No collection installed',
        'vr.collectionsFilter': 'Start typing to filter',
        'ingame.exit': 'Exit game',

        // Legend bar
        'legend.prompt': 'Press any button to use the gamepad shell',
        'legend.nav': 'Navigate',
        'legend.select': 'Select',
        'legend.back': 'Back',
        'legend.exit': 'Exit',
        'legend.type': 'Type',
        'legend.delete': 'Delete',
        'legend.list': 'List',
        'legend.filter': 'Filter',
        'legend.open': 'Open',
        'legend.load': 'Load',
        'legend.menu': 'Menu',
        'legend.covers': 'Covers'
    },
    pl: {
        'app.title': 'VME',

        'menu.platform': 'Platforma',
        'menu.recent': 'Ostatnio uruchamiane',
        'menu.search': 'Szukaj programów',
        'menu.browse': 'Przeglądaj programy',
        'menu.open': 'Otwórz / Importuj',
        'menu.saves': 'Wczytaj stan',
        'menu.collections': 'Kolekcje',
        'menu.settings': 'Ustawienia',
        'crumb.collection': 'Kolekcja',
        'crumb.saves': 'Stany gry',
        'crumb.allPlatforms': 'Wszystkie platformy',

        'platform.title': 'Platforma',
        'platform.placeholder': 'Zacznij pisać, aby filtrować',

        'browse.title': 'Przeglądaj programy',
        'browse.placeholder': 'Wpisz pierwsze litery…',
        'search.title': 'Szukaj programów',
        'search.placeholder': 'Szukaj tytułów…',
        'search.minHint': 'Wpisz co najmniej 3 litery.',
        'browse.noDir': 'Brak katalogu oprogramowania. Użyj Otwórz / Importuj.',

        'recent.title': 'Ostatnio uruchamiane',
        'recent.platformTitle': 'Ostatnio uruchamiane · Platforma',
        'recent.allPlatforms': 'Wszystkie platformy',
        'recent.empty': 'Brak ostatnio uruchamianych gier.',
        // PL: plural variants '1|2-4|5+' (selected by plRel in formatRelative). {n} = count.
        'time.justNow': 'przed chwilą',
        'time.minAgo': '{n} min temu',
        'time.hrAgo': '{n} godz. temu',
        'time.yesterday': 'wczoraj',
        'time.daysAgo': '{n} dzień temu|{n} dni temu|{n} dni temu',
        'time.weeksAgo': '{n} tydzień temu|{n} tygodnie temu|{n} tygodni temu',
        'time.monthsAgo': '{n} miesiąc temu|{n} miesiące temu|{n} miesięcy temu',
        'recent.emptyPlatform': 'Brak ostatnich gier dla tej platformy.',
        'recent.continue': 'Kontynuuj (ostatni zapis)',
        'recent.startOver': 'Od początku',
        'recent.cancel': 'Anuluj',

        'settings.title': 'Ustawienia',
        'settings.display': 'Obraz',
        'display.authentic': 'Wierny (efekt CRT/LCD)',
        'display.pixel': 'Pixel-perfect',
        'display.fill': 'Wypełnij ekran',
        'display.lowperf': 'Wydajność',
        'settings.language': 'Język',
        'settings.enterCode': 'Wpisz kod',
        'settings.fpsMeter': 'Diagnostyka FPS',
        'settings.exitCli': 'Wyjdź do CLI',
        'common.on': 'Wł.',
        'common.off': 'Wył.',

        'code.title': 'Wpisz kod',
        'code.placeholder': 'Kod…',
        'code.hint': 'Wpisz kod i naciśnij ↵',
        'code.unknown': 'Nieznany kod.',

        'import.importing': 'Importowanie…',
        'import.done': 'Zaimportowano. Przeładowywanie…',
        'import.failed': 'Nie udało się zaimportować.',
        'notice.done': 'Gotowe',
        'notice.error': 'Błąd',
        'notice.ok': 'OK',

        'launch.loading': 'Wczytywanie…',
        'launch.press': 'Naciśnij przycisk pilota lub klawiatury albo dotknij, aby rozpocząć',
        'launch.error': 'Nie udało się pobrać pliku programu.',
        'launch.errorBack': 'Naciśnij dowolny przycisk, aby wrócić',
        'launch.vr': 'Uruchom w VR',
        'launch.mr': 'Uruchom w MR (passthrough)',
        'launch.vrHint': 'W VR: klik prawej gałki otwiera menu',
        'menu.vr2dOnly': 'Niedostępne w VR',

        'ingame.resume': 'Wznów',
        'ingame.saveState': 'Zapisz stan',
        'ingame.loadState': 'Wczytaj stan',
        'ingame.restart': 'Restart',
        'ingame.exitVr': 'Wróć do 2D',
        'ingame.anchor': 'Zakotwiczenie ekranu',
        'ingame.anchorWorld': 'W przestrzeni',
        'ingame.anchorHead': 'Podąża za wzrokiem',
        'ingame.screenHint': 'Prawa gałka: odległość ekranu (↕) i rozmiar (↔)',
        'vr.savesEmpty': 'Brak zapisanych stanów',
        'vr.collectionsEmpty': 'Brak zainstalowanej kolekcji',
        'vr.collectionsFilter': 'Zacznij pisać, aby filtrować',
        'ingame.exit': 'Zakończ grę',

        'legend.prompt': 'Naciśnij dowolny przycisk, aby użyć shella gamepada',
        'legend.nav': 'Nawigacja',
        'legend.select': 'Wybierz',
        'legend.back': 'Wstecz',
        'legend.exit': 'Wyjdź',
        'legend.type': 'Pisz',
        'legend.delete': 'Usuń',
        'legend.list': 'Lista',
        'legend.filter': 'Filtr',
        'legend.open': 'Otwórz',
        'legend.load': 'Wczytaj',
        'legend.menu': 'Menu',
        'legend.covers': 'Okładki'
    }
};

export function getShellLang() {
    const v = StorageManager.getValue(LANG_KEY);
    return SHELL_LANGS.includes(v) ? v : 'en';   // default English
}

export function setShellLang(lang) {
    if (SHELL_LANGS.includes(lang)) StorageManager.storeValue(LANG_KEY, lang);
}

/** Translate a key into the current shell language. Missing -> returns the key. */
export function t(key) {
    const lang = getShellLang();
    return (STRINGS[lang] && STRINGS[lang][key]) || (STRINGS.en && STRINGS.en[key]) || key;
}

/** PL: pick the plural form (1 / 2-4 / 5+) from 'a|b|c'; n=count. */
function plForm(template, n) {
    const parts = template.split('|');
    if (parts.length < 3) return template;
    const mod10 = n % 10, mod100 = n % 100;
    let idx = 2;                                   // 5+ (default)
    if (n === 1) idx = 0;
    else if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) idx = 1;
    return parts[idx];
}

/** Relative time in the shell language (Recent). EN simple, PL with declension. */
export function formatRelativeShell(ts) {
    const lang = getShellLang();
    const diff = Math.max(0, Date.now() - ts);
    const sec = Math.floor(diff / 1000);
    const fmt = (key, n) => {
        let s = t(key);
        if (lang === 'pl') s = plForm(s, n);
        return s.replace('{n}', n);
    };
    if (sec < 60) return t('time.justNow');
    const min = Math.floor(sec / 60);
    if (min < 60) return fmt('time.minAgo', min);
    const hr = Math.floor(min / 60);
    if (hr < 24) return fmt('time.hrAgo', hr);
    const day = Math.floor(hr / 24);
    if (day === 1) return t('time.yesterday');
    if (day < 7) return fmt('time.daysAgo', day);
    const week = Math.floor(day / 7);
    if (week < 4) return fmt('time.weeksAgo', week);
    const month = Math.floor(day / 30);
    if (month < 6) return fmt('time.monthsAgo', month);
    // Older -> date (neutral, no translation).
    const d = new Date(ts);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
