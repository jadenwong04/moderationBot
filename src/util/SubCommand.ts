import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder
} from 'discord.js'

export default class SubCommand {
    base_command: string;
    name: string;
    description: string;

    constructor(base_command: string, name: string, description: string){
        this.base_command = base_command
        this.name = name
        this.description = description
    }

    async async_init(): Promise<this> { return this }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.followUp('Pls Implement!')
    }

    get_base_command(): string {
        return this.base_command
    }

    addBaseCmd(base_cmd_ref: SlashCommandBuilder): void {
        base_cmd_ref.addSubcommand((subcommand: SlashCommandSubcommandBuilder) => 
            subcommand.setName(this.name)
                .setDescription(this.description)
        )
    }
}
