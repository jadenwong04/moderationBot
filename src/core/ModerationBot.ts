import 'dotenv/config';
import discord_client from '../DiscordClient.js';
import ModalHandler from '../util/ModalHandler.js';
import { EventRegistry } from './EventRegistry.js';
import { CommandManager } from './CommandManager.js';
import { RuleBasedModerator } from '../moderation/RuleBasedModerator.js';
import { moderationRuleCache } from '../moderation/ModerationRuleCache.js';

export class ModerationBot {
    public readonly client = discord_client;
    public readonly modalHandler = ModalHandler.get_instance();
    public readonly eventRegistry: EventRegistry;
    public readonly commandManager: CommandManager;
    public readonly moderator: RuleBasedModerator;

    constructor() {
        this.commandManager = new CommandManager(this.client);
        this.moderator = new RuleBasedModerator();
        this.eventRegistry = new EventRegistry(this);
    }

    public async start(): Promise<void> {
        this.eventRegistry.registerAll();
        
        await this.commandManager.loadCommands();

        await moderationRuleCache.prewarm();

        await this.client.login(process.env.DISCORD_TOKEN);
    }
}
