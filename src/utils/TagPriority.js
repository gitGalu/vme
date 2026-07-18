// Ordering of software-directory results by base tag.
//
// Each collection item references a base index (item[1]); model.tags maps a
// base index to a tag label (e.g. "WHDLoad", "WIN"). Historically any tagged
// item sorted ABOVE untagged ones (WHDLoad games on top on Amiga).
//
// A collection may now declare per-tag priorities in an optional "tagPriority"
// map (tag label -> number). Lower numbers sort first (higher on the list):
//   - untagged items have priority 0
//   - a tagged item uses model.tagPriority[label] when present
//   - a tagged item WITHOUT an explicit priority defaults to -1 (i.e. above
//     untagged), preserving the original "tagged on top" behaviour for
//     collections that don't declare tagPriority (Amiga WHDLoad).
//
// Example: "tagPriority": { "WIN": 1 } pushes Windows titles below the
// untagged DOS games in the DOS/Windows collection.

const DEFAULT_TAGGED_PRIORITY = -1;
const UNTAGGED_PRIORITY = 0;

function tagRank(model, item) {
    const tag = model && model.tags ? model.tags[item[1]] : null;
    if (!tag) {
        return UNTAGGED_PRIORITY;
    }
    const priorities = model.tagPriority;
    if (priorities && typeof priorities[tag] === 'number') {
        return priorities[tag];
    }
    return DEFAULT_TAGGED_PRIORITY;
}

// Comparator for Array.prototype.sort. Orders by tag priority, then by the
// item's display name.
export function tagAwareCompare(model, a, b) {
    const rankA = tagRank(model, a);
    const rankB = tagRank(model, b);
    if (rankA !== rankB) {
        return rankA - rankB;
    }
    return a[0].localeCompare(b[0]);
}
