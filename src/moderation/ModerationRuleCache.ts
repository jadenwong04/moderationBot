import { PatternTrieContext } from './PatternTrieContext.js';
import { LookoutRepository } from '../repositories/LookoutRepository.js';
import { guildRepository } from '../repositories/GuildRepository.js';

export class ModerationRuleCache {
    private cache: Map<string, PatternTrieContext> = new Map();
    private lookoutRepository: LookoutRepository;

    constructor() {
        this.lookoutRepository = new LookoutRepository();
    }

    public async prewarm(): Promise<void> {
        console.log('Pre-warming moderation rule cache...');
        const guildIds = await guildRepository.getAllIds();
        for (const guildId of guildIds) {
            await this.refreshCache(guildId);
        }
        console.log(`Pre-warmed cache for ${guildIds.length} guilds.`);
    }

    public async getTrieContext(guildId: string): Promise<PatternTrieContext> {
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId)!;
        }

        const trie = await this.refreshCache(guildId);
        return trie;
    }

    public async getLookoutTerms(guildId: string): Promise<Map<string, number>> {
        const lookoutTerms = await this.lookoutRepository.getLookoutTermsFormatted(guildId);
        const termMap = new Map<string, number>();
        for (const lookout of lookoutTerms) {
            const [term, maxEditDistanceStr] = lookout.split(':');
            const maxEditDistance = parseInt(maxEditDistanceStr, 10) || 0;
            termMap.set(term, maxEditDistance);
        }
        return termMap;
    }

    public async refreshCache(guildId: string): Promise<PatternTrieContext> {
        const lookoutTerms = await this.lookoutRepository.getLookoutTermsFormatted(guildId);
        
        const trie = new PatternTrieContext();
        for (const lookout of lookoutTerms) {
            const [term, maxEditDistanceStr] = lookout.split(':');
            const maxEditDistance = parseInt(maxEditDistanceStr, 10) || 0;
            trie.addPattern(term, maxEditDistance);
        }
        
        trie.buildFailureLinks();
        this.cache.set(guildId, trie);
        return trie;
    }

    public invalidateCache(guildId: string): void {
        this.cache.delete(guildId);
    }
}

export const moderationRuleCache = new ModerationRuleCache();
