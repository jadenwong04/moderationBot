import { 
    Guild,
    GuildBasedChannel,
    User,
    Message,
    inlineCode,
    codeBlock,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} from "discord.js"
import {
    format_tabular_data
} from "../util/InteractiveComponent.js"
import discord_client from "../DiscordClient.js"
import { guildRepository } from "../repositories/Index.js"

export abstract class Violation {
    name: string
    description: string
    user: User
    guild: Guild

    constructor(
        name: string,
        description: string,
        user: User,
        guild: Guild
    ) {
        this.name = name
        this.description = description
        this.user = user
        this.guild = guild
    }

    warn(additional_fields: Array<[string, string]>): void {
        const warning_embed = this.get_warning_embed_template()
        warning_embed.addFields(
            ...(additional_fields.map(([field_name, field_value]) => ({
                name: field_name,
                value: field_value
            })))
        )
        this.user.send({ embeds: [warning_embed] })
    }

    get_warning_embed_template(): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(`Warning from ${inlineCode(this.guild.name)}`)
            .setColor('Red')
            .setDescription(`Category: ${inlineCode(this.name)}`)
            .addFields(
                { 
                    name: "Reason:",
                    value: codeBlock(this.description)
                }
            )
            .setAuthor(
                { 
                    name: discord_client.user?.displayName || 'Bot',
                    iconURL: discord_client.user?.displayAvatarURL() || ''
                }
            );
    }

    abstract logToChannel(): Promise<void>;
}

export class BannedTerm extends Violation {
    message: Message
    channel: GuildBasedChannel
    used_banned_term: Map<string, number>

    constructor(
        user: User,
        guild: Guild,
        channel: GuildBasedChannel,
        message: Message,
        used_banned_term: Map<string, number>
    ) {
        super("Banned Term", "Use of Banned Term in Message.", user, guild)
        this.message = message
        this.channel = channel
        this.used_banned_term = used_banned_term
    }

    override warn(): void {
        super.warn(
            [
                ['Your Message:', codeBlock(this.message.content)],
                ['From Channel:', codeBlock(this.channel.name)],
                ['Banned Term Analysis:', format_tabular_data(['Banned Term', 'Times Used'], Array.from(this.used_banned_term.entries()).filter(([_, value]) => value > 0))]
            ]
        )
    }

    async logToChannel(): Promise<void> {
        const logChannelId = await guildRepository.getLogChannelId(this.guild.id);
        if (!logChannelId) return;

        try {
            const channel = await this.guild.channels.fetch(logChannelId);
            if (channel && channel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(`Violation Log`)
                    .setColor('Red')
                    .setDescription(`Category: ${inlineCode(this.name)}`)
                    .addFields(
                        { 
                            name: "Target User:", 
                            value: `<@${this.user.id}>`,
                            inline: true
                        },
                        { 
                            name: "Channel:", 
                            value: `<#${this.channel.id}> ([Jump to Message](https://discord.com/channels/${this.guild.id}/${this.channel.id}/${this.message.id}))`,
                            inline: true
                        },
                        { 
                            name: "Violating Message:", 
                            value: codeBlock(this.message.content) 
                        },
                        { 
                            name: "Banned Term Analysis:", 
                            value: format_tabular_data(['Banned Term', 'Times Used'], Array.from(this.used_banned_term.entries()).filter(([_, value]) => value > 0))
                        }
                    )
                    .setAuthor({ 
                        name: discord_client.user?.displayName || 'Bot',
                        iconURL: discord_client.user?.displayAvatarURL() || ''
                    })
                    .setTimestamp();

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`audit:${this.user.id}:${this.channel.id}:${this.message.id}`)
                    .setPlaceholder("Choose Moderation Action...")
                    .addOptions([
                        {
                            label: "Delete Message",
                            description: "Delete the offending message",
                            value: "delete"
                        },
                        {
                            label: "Warn User",
                            description: "Send a warning Direct Message to the user",
                            value: "warn"
                        },
                        {
                            label: "Timeout User",
                            description: "Timeout the member",
                            value: "timeout"
                        },
                        {
                            label: "Kick User",
                            description: "Kick the member from server",
                            value: "kick"
                        },
                        {
                            label: "Ban User",
                            description: "Ban the member from server",
                            value: "ban"
                        },
                        {
                            label: "Ignore Log",
                            description: "Mark this log as resolved (no action)",
                            value: "ignore"
                        }
                    ]);

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await channel.send({ embeds: [logEmbed], components: [row] });
            }
        } catch (error) {
            console.error("[Violation] Failed to send log to channel:", error);
        }
    }
}
