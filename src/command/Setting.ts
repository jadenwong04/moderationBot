import BaseCommand from '../util/BaseCommand.js';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export default class Setting extends BaseCommand {
    constructor() {
        super('setting', 'Configure various settings for the bot!')
        this.permissions = PermissionFlagsBits.ManageGuild;
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        // Implementation is handled by subcommands
    }
}
