import { Events, inlineCode, MessageFlags } from 'discord.js';
import { ModerationBot } from './ModerationBot.js';
import { 
    guildRepository
} from '../repositories/Index.js';
import { BannedTerm } from '../moderation/Violation.js';
import { auditLogManager } from './AuditLogManager.js';

export class EventRegistry {
    constructor(private bot: ModerationBot) {}

    public registerAll(): void {
        const client = this.bot.client;

        client.on(Events.ClientReady, async () => {
            const guilds_info = await client.guilds.fetch();
            const dc_guild_ids = guilds_info.map(guild => guild.id);
            
            for (const guild_id of dc_guild_ids) {
                await guildRepository.upsert(guild_id);
            }

            for (const guild_id of dc_guild_ids) {
                await this.bot.commandManager.registerWithDiscord(guild_id);
            }

            console.log(`Bot is ready and synced with ${dc_guild_ids.length} guilds.`);
        });

        client.on(Events.InteractionCreate, async interaction => {
            if (interaction.isChatInputCommand()) {
                const command = client.base_command.get(interaction.commandName);
                const subcommand = client.sub_command.get(interaction.commandName)?.get(interaction.options.getSubcommand());

                try {
                    if (command) {
                        await command.execute(interaction);
                        if (subcommand) await subcommand.execute(interaction);
                    }
                } catch (e) {
                    console.error(e);
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                    }
                }
            } 

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith("audit:")) {
                    await auditLogManager.handleSelectMenu(interaction);
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith("audit_modal:")) {
                    await auditLogManager.handleModalSubmit(interaction);
                } else {
                    try {
                        await this.bot.modalHandler.submit(
                            interaction.customId, 
                            { 
                                guild_id: interaction.guildId,
                                submission_field: interaction.fields.fields
                            }
                        );
                        await interaction.reply({
                            content: `Modal: ${inlineCode(interaction.customId)} Submitted Successfully!`,
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (e) {
                        console.error(e);
                        await interaction.reply({
                            content: `Modal: ${inlineCode(interaction.customId)} Failed!`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }
        });

        client.on(Events.GuildCreate, async guild => {
            await guildRepository.upsert(guild.id);
        });

        client.on(Events.MessageCreate, async message => {
            if (!message.guildId || message.author.bot) return;

            const guild = await client.guilds.fetch(message.guildId);
            const channel = await guild.channels.fetch(message.channelId);

            const lookout_violations = await this.bot.moderator.moderate(
                message.content,
                message.guildId
            );

            const findValueGreaterThanZero = (map: Map<string, number>): boolean => {
                for (const value of map.values()) {
                    if (value > 0) return true;
                }
                return false;
            };
            if (findValueGreaterThanZero(lookout_violations) && channel && channel.isTextBased()) {
                const violation = new BannedTerm(
                    message.author,
                    guild,
                    channel,
                    message,
                    lookout_violations
                );
                await violation.logToChannel();
            }
        });
    }
}
