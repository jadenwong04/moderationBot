import packageInfo from "../../package.json" with { type: 'json' };
import SubCommand from '../util/SubCommand.js';
import { 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    MessageFlags,
    channelMention,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ChannelSelectMenuInteraction
} from "discord.js";
import { guildRepository } from '../repositories/Index.js';
import config from "../../config.json" with { type: 'json' };

const { name } = packageInfo;

export default class LogChannel extends SubCommand {
    channel_select_input_interval = config.ui.interaction.channelSelectInterval;

    private readonly handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
        show: this.handleShow,
        set: this.handleSet,
        remove: this.handleRemove
    };

    constructor(){
        super('setting', 'log_channel', `Configure where audit logs are posted by ${name}`)
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const action = interaction.options.getString('action') || '';
        const handler = this.handlers[action];

        if (!handler) {
            await interaction.reply({
                content: 'Invalid Action Chosen',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        return handler.call(this, interaction);
    }

    private async handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
        const logChannelId = await guildRepository.getLogChannelId(interaction.guildId!)
        if (logChannelId) {
            await interaction.reply({
                content: `The configured log channel is ${channelMention(logChannelId)}.`,
                flags: MessageFlags.Ephemeral
            })
        } else {
            await interaction.reply({
                content: "No log channel is currently configured.",
                flags: MessageFlags.Ephemeral
            })
        }
    }

    private async handleSet(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel_select_component = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId("log_channel_input")
                .setPlaceholder("select log channel")
        )

        const set_channel_response = await interaction.reply({
            content: `Select a channel to send audit logs to:`,
            components: [channel_select_component],
            withResponse: true,
            flags: MessageFlags.Ephemeral
        });

        try {
            const channel_select = await set_channel_response.resource?.message?.awaitMessageComponent({
                filter: (i) => i.customId === 'log_channel_input' && i.user.id === interaction.user.id,
                time: this.channel_select_input_interval
            }) as ChannelSelectMenuInteraction;

            const selectedChannelId = channel_select.values[0];

            try {
                await guildRepository.setLogChannelId(interaction.guildId!, selectedChannelId);
                await interaction.followUp({
                    content: `Successfully set ${channelMention(selectedChannelId)} as the log channel.`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                console.error(error);
                await interaction.followUp({
                    content: `Failed to set ${channelMention(selectedChannelId)} as the log channel.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            channel_select.deferUpdate();
        } catch {
            await interaction.followUp({
                content: "Command execution not completed within specified time interval.",
                flags: MessageFlags.Ephemeral
            });
        }
    }

    private async handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            await guildRepository.setLogChannelId(interaction.guildId!, null);
            await interaction.reply({
                content: "Successfully removed the configured log channel.",
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "Failed to remove the configured log channel.",
                flags: MessageFlags.Ephemeral
            });
        }
    }

    addBaseCmd(base_cmd_ref: SlashCommandBuilder): void {
        base_cmd_ref.addSubcommand(subcommand => 
            subcommand.setName(this.name)
                .setDescription(this.description)
                .addStringOption(option => option
                    .setName('action')
                    .setDescription('choose an action')
                    .addChoices(
                        { name: 'show-log-channel', value: 'show' },
                        { name: 'set-log-channel', value: 'set' },
                        { name: 'remove-log-channel', value: 'remove' }
                    )
                    .setRequired(true)
                )
        )
    }
}
