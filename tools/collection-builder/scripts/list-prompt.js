export function createListPrompt(platforms) {
  const identifiers = [...platforms].sort((a, b) => a.id.localeCompare(b.id))
    .map(platform => `${platform.id} — ${platform.name}`).join('\n');
  return `Przygotuj listę do wklejenia do VM/E Collection Builder.

Każdy wiersz ma mieć format:
platforma | pełny tytuł programu

Używaj wyłącznie poniższych identyfikatorów platform.
W wynikowej liście wpisuj identyfikator z lewej strony, bez opisu platformy:

${identifiers}

Zwróć wyłącznie listę, bez nagłówków, numeracji, opisów,
komentarzy i pustych wierszy.

Podawaj pełne tytuły. Zachowuj numery części oraz podtytuły
będące elementem nazwy programu.
Nie dopisuj roku, wydawcy, regionu, języka ani oznaczeń wersji TOSEC
— narzędzie samo wybiera preferowane wydanie.

Przykładowy format wyniku:
amiga | Lemmings
amiga | Rick Dangerous 2
dos | Doom
atari800 | Bruce Lee`;
}
