import { Client, GatewayIntentBits, Collection } from 'discord.js';
import BaseCommand from './util/BaseCommand.js';
import SubCommand from './util/SubCommand.js';

export class ExtendedClient extends Client {
    base_command: Collection<string, BaseCommand>;
    sub_command: Collection<string, Collection<string, SubCommand>>;

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
        });
        this.base_command = new Collection();
        this.sub_command = new Collection();
    }
}

const discord_client = new ExtendedClient();

export default discord_client;
