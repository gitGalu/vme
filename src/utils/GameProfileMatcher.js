function matchesPattern(pattern, value) {
    if (Array.isArray(pattern)) {
        return pattern.some((entry) => matchesPattern(entry, value));
    }

    if (pattern instanceof RegExp) {
        pattern.lastIndex = 0;
        return pattern.test(String(value ?? ''));
    }

    if (typeof pattern === 'function') {
        return pattern(value);
    }

    if (typeof pattern === 'string') {
        const normalizedPattern = pattern.trim().toLowerCase();
        const normalizedValue = String(value ?? '').trim().toLowerCase();
        if (!normalizedPattern || !normalizedValue) {
            return false;
        }
        return normalizedValue === normalizedPattern;
    }

    return false;
}

function matchesRule(rule, context) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        return false;
    }

    return Object.entries(rule).every(([key, pattern]) => {
        return matchesPattern(pattern, context?.[key]);
    });
}

export function resolveGameProfile(profiles, context) {
    if (!Array.isArray(profiles) || profiles.length === 0 || !context) {
        return null;
    }

    for (const profile of profiles) {
        if (!profile || profile.enabled === false) {
            continue;
        }

        const rules = [];
        if (profile.match && typeof profile.match === 'object' && !Array.isArray(profile.match)) {
            rules.push(profile.match);
        }
        if (Array.isArray(profile.matchAny)) {
            rules.push(...profile.matchAny);
        }

        if (rules.length === 0) {
            continue;
        }

        if (rules.some((rule) => matchesRule(rule, context))) {
            return profile;
        }
    }

    return null;
}
