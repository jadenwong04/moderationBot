import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js'

export default class BaseCommand {
    name: string;
    description: string;
    permissions?: bigint;

    constructor(name: string, description: string){
        this.name = name
        this.description = description
    }

    async async_init(): Promise<this> { return this }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply('Command function not implemented!')
    }

    getData(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder {
        const builder = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
        
        if (this.permissions) {
            builder.setDefaultMemberPermissions(this.permissions);
        }
        
        return builder;
    }
}
