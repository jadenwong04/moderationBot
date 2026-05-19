import packageInfo from '../../package.json' with { type: 'json' };
import SubCommand from '../util/SubCommand.js';
import discord_client from "../DiscordClient.js";
import { 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    MessageFlags,
    channelMention,
    userMention,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ChannelSelectMenuInteraction
} from "discord.js";
import { 
    Paginator,
    ListingConfig
} from "../util/Paginator.js";
import { channelRepository } from '../repositories/Index.js';
import config from "../../config.json" with { type: 'json' };

const { name } = packageInfo;

export default class IgnoreChannel extends SubCommand {
    interact_input_interval = config.ui.interaction.defaultInterval;
    channel_select_input_interval = config.ui.interaction.channelSelectInterval;
    listing_config: ListingConfig = {
        "title": "Ignored Channels",
        "header": ["Channel ID", "Channel Name"],
        "color": config.ui.embedColor,
        "pageSize": config.ui.pagination.defaultPageSize
    };

    private readonly handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
        show: this.handleShow,
        add: this.handleAdd,
        delete: this.handleDelete
    };

    constructor(){
        super('setting', 'ignore_channel', `Channels that should not moderated by ${name}`)
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
        const guild = await discord_client.guilds.fetch(interaction.guildId!)
        const ignored_channel_ids = await channelRepository.getIgnoredChannelIds(interaction.guildId!)
        const ignored_channels = await Promise.all(ignored_channel_ids.map(channel_id => guild.channels.fetch(channel_id).catch(() => null)))
        const ignored_channel_embed_data = ignored_channels.map((channel, index) => [ignored_channel_ids[index], channel?.name || 'Unknown'])

        const paginator = new Paginator(
            interaction,
            ignored_channel_embed_data,
            this.listing_config,
            this.interact_input_interval
        )

        await paginator.send()
    }

    private async handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel_select_component = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId("channel_input")
                .setPlaceholder("select channel")
        )

        const add_channel_response = await interaction.reply(
            {
                content: `Add a channel to be ignored by ${userMention(discord_client.user!.id)}`,
                components: [channel_select_component],
                withResponse: true,
                flags: MessageFlags.Ephemeral,
            }
        );

        try {
            const channel_select = await add_channel_response.resource?.message?.awaitMessageComponent({ 
                filter: (i) => i.customId === 'channel_input' && i.user.id === interaction.user.id,
                time: this.channel_select_input_interval 
            }) as ChannelSelectMenuInteraction;
            
            try {
                await channelRepository.addIgnoredChannel(interaction.guildId!, channel_select.values[0])
                await interaction.followUp({ content: `Successfully added ${channelMention(channel_select.values[0])} to ignored channels.`, flags: MessageFlags.Ephemeral })
            } catch {
                await interaction.followUp({ content: `Failed to add ${channelMention(channel_select.values[0])} to ignored channels.`, flags: MessageFlags.Ephemeral })
            }
            channel_select.deferUpdate()
        } catch {
            await interaction.followUp({ content: "Command execution not completed within specified time interval."})
        }
    }

    private async handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel_select_component = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId("channel_input")
                .setPlaceholder("select channel")
        )

        const remove_channel_response = await interaction.reply(
            {
                content: `Remove a channel that is ignored by ${userMention(discord_client.user!.id)}`,
                components: [channel_select_component],
                withResponse: true,
                flags: MessageFlags.Ephemeral,
            }
        );

        try {
            const channel_select = await remove_channel_response.resource?.message?.awaitMessageComponent({ 
                filter: (i) => i.customId === 'channel_input' && i.user.id === interaction.user.id,
                time: this.channel_select_input_interval 
            }) as ChannelSelectMenuInteraction;

            try {
                await channelRepository.removeIgnoredChannel(interaction.guildId!, channel_select.values[0])
                await interaction.followUp({ content: `Successfully removed ${channelMention(channel_select.values[0])} from ignored channels.`, flags: MessageFlags.Ephemeral })
            } catch {
                await interaction.followUp({ content: `Failed to remove ${channelMention(channel_select.values[0])} from ignored channels.`, flags: MessageFlags.Ephemeral })
            }
            channel_select.deferUpdate()
        } catch {
            await interaction.followUp({ content: "Command execution not completed within specified time interval | Abort Command Execution."})
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
                        { name: 'show-channels', value: 'show' },
                        { name: 'add-channel', value: 'add' },
                        { name: 'delete-channel', value: 'delete' }
                    )
                    .setRequired(true)
                )
        )
    }
}
