class DiskSetBuilder {
    static #DISK_RE = /\(\s*disk\s*(\d+)\s*of\s*(\d+)\s*\)/i;
    static #YEAR_RE = /\(\s*((?:19|20)\d{2})\s*\)/;
    static #BRACKET_RE = /\[([^\]]+)\]/g;
    static #PAREN_RE = /\(([^)]+)\)/g;

    static #CHIPSET_TOKENS = new Set([
        'aga', 'ecs', 'ocs', 'cd32', 'cdtv',
        'st', 'ste', 'falcon', 'falcon030', 'tt'
    ]);

    static parseSizeToBytes(size) {
        if (typeof size === 'number' && Number.isFinite(size)) {
            return size;
        }
        if (typeof size !== 'string') {
            return null;
        }

        const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)$/i);
        if (!match) {
            return null;
        }

        const value = Number.parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const mul = unit.startsWith('k') ? 1024 : unit.startsWith('m') ? 1024 ** 2 : unit.startsWith('g') ? 1024 ** 3 : unit.startsWith('t') ? 1024 ** 4 : 1;
        return Math.round(value * mul);
    }

    static parseEntry(entry) {
        if (!entry || !entry.romName) {
            return null;
        }

        const rawName = entry.romName;
        const normalizedFile = this.#normalizeToken(rawName);
        const baseName = this.#stripExtension(rawName);
        const diskMatch = baseName.match(this.#DISK_RE);

        if (!diskMatch) {
            return null;
        }

        const diskNo = Number.parseInt(diskMatch[1], 10);
        const diskTotal = Number.parseInt(diskMatch[2], 10);
        if (!Number.isFinite(diskNo) || !Number.isFinite(diskTotal) || diskNo < 1 || diskTotal < 2 || diskNo > diskTotal) {
            return null;
        }

        const firstParenIdx = baseName.indexOf('(');
        const titleRaw = (firstParenIdx === -1 ? baseName : baseName.slice(0, firstParenIdx)).trim();
        const titleKey = this.#normalizeToken(titleRaw);
        if (!titleKey) {
            return null;
        }

        const yearMatch = baseName.match(this.#YEAR_RE);
        const year = yearMatch ? yearMatch[1] : null;

        const parenTokens = [];
        for (const m of baseName.matchAll(this.#PAREN_RE)) {
            const token = this.#normalizeToken(m[1]);
            if (!token) {
                continue;
            }
            if (/^(?:19|20)\d{2}$/.test(token)) {
                continue;
            }
            if (/^disk\s*\d+\s*of\s*\d+$/i.test(token)) {
                continue;
            }
            if (/^disk\s*[0-9a-z]+$/i.test(token)) {
                continue;
            }
            parenTokens.push(token);
        }

        const tags = [];
        for (const m of baseName.matchAll(this.#BRACKET_RE)) {
            const token = this.#normalizeToken(m[1]);
            if (token) {
                tags.push(token);
            }
        }

        const chipset = this.#extractChipset(parenTokens, tags);
        const publisher = this.#extractPublisher(parenTokens);
        const cracker = this.#extractCracker(tags);
        const importantTokens = this.#buildImportantTokenSet(parenTokens);

        return {
            ...entry,
            normalizedFile,
            baseName,
            titleRaw,
            titleKey,
            year,
            diskNo,
            diskTotal,
            parenTokens,
            tags,
            tagSet: new Set(tags),
            chipset,
            publisher,
            cracker,
            importantTokens,
            sizeBytes: this.parseSizeToBytes(entry.size)
        };
    }

    static buildBestSet(entries, anchorRomName, anchorUrl = null) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return null;
        }

        const parsed = entries
            .map((entry) => this.parseEntry(entry))
            .filter(Boolean);

        if (parsed.length === 0) {
            return null;
        }

        let anchor = null;
        if (anchorUrl) {
            anchor = parsed.find((item) => item.url === anchorUrl && item.romName === anchorRomName) || null;
        }
        if (!anchor) {
            anchor = parsed.find((item) => item.romName === anchorRomName) || null;
        }
        if (!anchor) {
            return null;
        }

        const family = parsed.filter((candidate) => {
            if (candidate.titleKey !== anchor.titleKey) {
                return false;
            }
            if (candidate.diskTotal !== anchor.diskTotal) {
                return false;
            }
            if (anchor.year && candidate.year !== anchor.year) {
                return false;
            }
            if (anchor.chipset && candidate.chipset !== anchor.chipset) {
                return false;
            }
            return true;
        });

        if (family.length === 0) {
            return null;
        }

        let workingFamily = family;
        const anchorDir = this.#safeUrlDir(anchor.url);
        if (anchorDir) {
            const sameDirFamily = family.filter((candidate) => this.#safeUrlDir(candidate.url) === anchorDir);
            if (this.#coversAllDisks(sameDirFamily, anchor.diskTotal)) {
                workingFamily = sameDirFamily;
            } else {
                const anchorParent = this.#safeUrlParentDir(anchorDir);
                if (anchorParent) {
                    const sameParentFamily = family.filter((candidate) => this.#safeUrlParentDir(this.#safeUrlDir(candidate.url)) === anchorParent);
                    if (this.#coversAllDisks(sameParentFamily, anchor.diskTotal)) {
                        workingFamily = sameParentFamily;
                    }
                }
            }
        }

        const selected = [];
        const missing = [];
        const lowConfidence = [];

        for (let diskNo = 1; diskNo <= anchor.diskTotal; diskNo++) {
            const perDisk = workingFamily.filter((item) => item.diskNo === diskNo);
            if (perDisk.length === 0) {
                missing.push(diskNo);
                continue;
            }

            const ranked = this.#rankCandidates(perDisk, anchor, diskNo);
            const top1 = ranked[0];
            const top2 = ranked[1] || null;
            selected.push(top1);

            const effectivelySame = top2 && (
                top1.normalizedFile === top2.normalizedFile
                || (top1.romName === top2.romName && top1.diskNo === top2.diskNo && top1.diskTotal === top2.diskTotal)
            );

            if (!top1.isForced && top2 && !effectivelySame && top1.score - top2.score < 15) {
                lowConfidence.push({
                    diskNo,
                    delta: top1.score - top2.score,
                    top1: top1.romName,
                    top2: top2.romName
                });
            }
        }

        selected.sort((a, b) => a.diskNo - b.diskNo);

        return {
            anchor,
            selected,
            missing,
            lowConfidence,
            total: anchor.diskTotal,
            isComplete: missing.length === 0,
            isConfident: lowConfidence.length === 0
        };
    }

    static #rankCandidates(candidates, anchor, diskNo) {
        const median = this.#median(candidates.map((item) => item.sizeBytes).filter(Number.isFinite));

        return candidates
            .map((candidate) => {
                const forced = diskNo === anchor.diskNo && candidate.romName === anchor.romName && (!anchor.url || candidate.url === anchor.url);
                const score = forced ? 10_000 : this.#scoreCandidate(candidate, anchor);
                const sizeDistance = Number.isFinite(median) && Number.isFinite(candidate.sizeBytes) ? Math.abs(candidate.sizeBytes - median) : Number.POSITIVE_INFINITY;
                return {
                    ...candidate,
                    score,
                    isForced: forced,
                    sizeDistance
                };
            })
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                if (a.sizeDistance !== b.sizeDistance) {
                    return a.sizeDistance - b.sizeDistance;
                }
                if (a.romName.length !== b.romName.length) {
                    return a.romName.length - b.romName.length;
                }
                return a.romName.localeCompare(b.romName);
            });
    }

    static #scoreCandidate(candidate, anchor) {
        let score = 0;

        if (this.#sameTokenSet(candidate.importantTokens, anchor.importantTokens)) {
            score += 80;
        }
        score += this.#scoreTagSimilarity(candidate, anchor);
        if (candidate.publisher && anchor.publisher && candidate.publisher === anchor.publisher) {
            score += 20;
        }
        score += this.#scoreUrlSimilarity(candidate.url, anchor.url);
        if (candidate.cracker && anchor.cracker && candidate.cracker === anchor.cracker) {
            score += 15;
        }
        if (anchor.cracker && candidate.cracker && candidate.cracker !== anchor.cracker) {
            score -= 30;
        } else if (anchor.cracker && !candidate.cracker) {
            score -= 16;
        } else if (!anchor.cracker && candidate.cracker) {
            score -= 12;
        }

        score += this.#scoreTagPenalties(candidate.tags);

        return score;
    }

    static #scoreTagSimilarity(candidate, anchor) {
        const candidateSet = candidate.tagSet || new Set();
        const anchorSet = anchor.tagSet || new Set();

        if (this.#sameTokenSet(candidateSet, anchorSet)) {
            return 45;
        }

        const overlap = this.#countSetOverlap(candidateSet, anchorSet);
        const extra = Math.max(0, candidateSet.size - overlap);
        const missing = Math.max(0, anchorSet.size - overlap);

        return (overlap * 10) - (extra * 18) - (missing * 22);
    }

    static #scoreTagPenalties(tags) {
        let score = 0;

        for (const tag of tags) {
            const token = this.#normalizeToken(tag);

            const isBadDump = /\bbad\s*dump\b/.test(token) || /\bbaddump\b/.test(token) || /\bcorrupt\b/.test(token) || /^b\d*\b/.test(token);
            const isModified = /^m\b/.test(token);
            const isTrainer = /^t\b/.test(token);
            const isFix = /^f\b/.test(token);
            const isHack = /^h\b/.test(token);
            const isAlt = /^a\d*\b/.test(token);

            if (isBadDump) {
                score -= 120;
            }
            if (isModified) {
                score -= 60;
            }
            if (isTrainer) {
                score -= 35;
            }
            if (isFix) {
                score -= 25;
            }
            if (isHack) {
                score -= 15;
            }
            if (isAlt) {
                score -= 20;
            }
        }

        return score;
    }

    static #buildImportantTokenSet(parenTokens) {
        const set = new Set();
        for (const token of parenTokens) {
            set.add(this.#normalizeToken(token));
        }
        return set;
    }

    static #extractChipset(parenTokens, tags) {
        const all = [...parenTokens, ...tags].map((token) => this.#normalizeToken(token));
        for (const token of all) {
            if (this.#CHIPSET_TOKENS.has(token)) {
                return token;
            }
        }
        return null;
    }

    static #extractPublisher(parenTokens) {
        for (const rawToken of parenTokens) {
            const token = this.#normalizeToken(rawToken);
            if (!token) {
                continue;
            }
            if (/^m\d+$/i.test(token)) {
                continue;
            }
            if (this.#CHIPSET_TOKENS.has(token)) {
                continue;
            }
            return token;
        }
        return null;
    }

    static #extractCracker(tags) {
        for (const rawTag of tags) {
            const tag = this.#normalizeToken(rawTag);
            const match = tag.match(/^cr\s+(.+)$/i);
            if (match && match[1]) {
                return this.#normalizeToken(match[1]);
            }
        }
        return null;
    }

    static #median(values) {
        if (!Array.isArray(values) || values.length === 0) {
            return null;
        }
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    static #sameTokenSet(a, b) {
        if (!a || !b || a.size !== b.size) {
            return false;
        }
        for (const token of a) {
            if (!b.has(token)) {
                return false;
            }
        }
        return true;
    }

    static #countSetOverlap(a, b) {
        if (!a || !b || a.size === 0 || b.size === 0) {
            return 0;
        }
        let overlap = 0;
        const [left, right] = a.size <= b.size ? [a, b] : [b, a];
        for (const token of left) {
            if (right.has(token)) {
                overlap += 1;
            }
        }
        return overlap;
    }

    static #coversAllDisks(candidates, diskTotal) {
        if (!Array.isArray(candidates) || candidates.length === 0 || !Number.isInteger(diskTotal) || diskTotal < 2) {
            return false;
        }
        const disks = new Set(candidates.map((item) => item.diskNo).filter(Number.isInteger));
        for (let diskNo = 1; diskNo <= diskTotal; diskNo++) {
            if (!disks.has(diskNo)) {
                return false;
            }
        }
        return true;
    }

    static #scoreUrlSimilarity(candidateUrl, anchorUrl) {
        const candidateDir = this.#safeUrlDir(candidateUrl);
        const anchorDir = this.#safeUrlDir(anchorUrl);
        if (!candidateDir || !anchorDir) {
            return 0;
        }
        if (candidateDir === anchorDir) {
            return 35;
        }

        const candidateParent = this.#safeUrlParentDir(candidateDir);
        const anchorParent = this.#safeUrlParentDir(anchorDir);
        if (candidateParent && anchorParent && candidateParent === anchorParent) {
            return 12;
        }

        return 0;
    }

    static #safeUrlDir(urlValue) {
        if (typeof urlValue !== 'string' || urlValue.length === 0) {
            return null;
        }
        try {
            const url = new URL(urlValue, 'https://example.invalid');
            const path = String(url.pathname || '');
            const idx = path.lastIndexOf('/');
            return idx <= 0 ? '/' : path.slice(0, idx);
        } catch {
            return null;
        }
    }

    static #safeUrlParentDir(dirPath) {
        if (typeof dirPath !== 'string' || dirPath.length === 0 || dirPath === '/') {
            return null;
        }
        const idx = dirPath.lastIndexOf('/');
        if (idx <= 0) {
            return '/';
        }
        return dirPath.slice(0, idx);
    }

    static #stripExtension(fileName) {
        const idx = fileName.lastIndexOf('.');
        return idx >= 0 ? fileName.slice(0, idx) : fileName;
    }

    static #normalizeToken(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
}

export { DiskSetBuilder };
