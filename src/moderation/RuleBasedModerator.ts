import natural from "natural";
import wordlist from 'wordlist-english';
import { moderationRuleCache } from './ModerationRuleCache.js';

export class RuleBasedModerator {
    private wordDict: Set<string>;
    private tokenizer = new natural.WordTokenizer();

    constructor() {
        const word_bank: string[] = (wordlist as any)['english'];
        this.wordDict = new Set(word_bank.map(word => RuleBasedModerator.normalize(word)));
    }

    /**
     * Computes the levenshtein edit distance between two strings without cost for delete operation.
     * @param s1
     * @param s2 
     * @returns 
     */
    public static editDistance(s1: string, s2: string): number {
        const n = s1.length;
        const m = s2.length;
        
        const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
        
        for (let i = 0; i <= n; i++) {
            dp[i][0] = 0;
        }

        for (let j = 1; j <= m; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j - 1] + cost,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j]
                );
            }
        }

        console.log(s1, s2, dp[n][m]);

        return dp[n][m];
    }

    public async moderate(messageContent: string, guildId: string): Promise<Map<string, number>> {
        const trieContext = await moderationRuleCache.getTrieContext(guildId);

        const normalizedMessage = RuleBasedModerator.normalize(messageContent);
        const candidates = trieContext.search(normalizedMessage);

        console.log(normalizedMessage, candidates)

        const violations = new Map<string, number>();
        const lookoutTerms = await moderationRuleCache.getLookoutTerms(guildId);
        const termMaxDistMap = new Map<string, number>();
        for (const [term, maxDist] of lookoutTerms) {
            termMaxDistMap.set(term, maxDist);
        }

        // Tokenize with offsets
        const tokens = this.tokenizer.tokenize(normalizedMessage) || [];
        const tokenIntervals: Array<{ start: number, end: number, text: string }> = [];
        let searchOffset = 0;
        for (const token of tokens) {
            const start = normalizedMessage.indexOf(token, searchOffset);
            const end = start + token.length - 1;
            tokenIntervals.push({ start, end, text: token });
            searchOffset = end + 1;
        }

        for (const [term, hits] of candidates.entries()) {
            let termViolations = 0;
            const maxDist = termMaxDistMap.get(term) ?? 0;
            const processedTokenIndices = new Set<number>();

            // Handle all exact matches
            for (const hit of hits) {
                if (hit.isExact) {
                    const tokenIdx = this.findTokenIndex(tokenIntervals, hit.physicalEnd);
                    if (tokenIntervals[tokenIdx].text.length > term.length && this.wordDict.has(tokenIntervals[tokenIdx].text)) {
                        continue;
                    }
                    if (tokenIdx !== -1) {
                        if (!processedTokenIndices.has(tokenIdx)) {
                            termViolations++;
                            processedTokenIndices.add(tokenIdx);
                        }
                    } else {
                        termViolations++;
                    }
                }
            }

            // Handle approximate matches
            for (const hit of hits) {
                if (!hit.isExact) {
                    const tokenIdx = this.findTokenIndex(tokenIntervals, hit.physicalEnd);
                    if (tokenIdx === -1 || processedTokenIndices.has(tokenIdx)) {
                        continue;
                    }

                    const token = tokenIntervals[tokenIdx];

                    // For approximate matches, check dictionary and edit distance
                    if (!this.wordDict.has(token.text)) {
                        const distance = RuleBasedModerator.editDistance(token.text, term);
                        if (distance <= maxDist) {
                            termViolations++;
                            processedTokenIndices.add(tokenIdx);
                        }
                    }
                }
            }
            
            if (termViolations > 0) {
                violations.set(term, termViolations);
            }
        }

        return violations;
    }

    private findTokenIndex(intervals: Array<{ start: number, end: number }>, pos: number): number {
        let low = 0;
        let high = intervals.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const interval = intervals[mid];
            if (pos >= interval.start && pos <= interval.end) {
                return mid;
            } else if (pos < interval.start) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return -1;
    }

    public static normalize(text: string): string {
        return text
            .toLowerCase()
    }
}
