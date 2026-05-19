import BaseCommand from '../util/BaseCommand.js';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export default class Test extends BaseCommand {
    constructor(){
        super('test', 'Replies with success!')
        this.permissions = PermissionFlagsBits.ManageGuild;
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply('Success!')
    }
}
