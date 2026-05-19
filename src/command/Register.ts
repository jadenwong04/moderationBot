import BaseCommand from '../util/BaseCommand.js';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Register extends BaseCommand {
    constructor(){
        super('register', 'Register new commands and reload existing commands!')
        this.permissions = PermissionFlagsBits.Administrator;
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply("Begin registering command...")
        await interaction.followUp("Reloading command registration...")
        
        const registerPath = path.resolve(__dirname, '../RegisterCommand.js');
        const { default: registerCommand } = await import(`${registerPath}?update=${Date.now()}`);
        
        if (interaction.guildId) {
            await registerCommand(interaction.guildId);
            await interaction.followUp("Complete!");
        } else {
            await interaction.followUp("Failed: No Guild ID found.");
        }
    }
}
