import { 
    StringSelectMenuInteraction, 
    ModalSubmitInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    ActionRowBuilder, 
    TextInputStyle, 
    PermissionFlagsBits, 
    MessageFlags,
    GuildMember,
    EmbedBuilder,
    inlineCode,
    codeBlock
} from "discord.js";

export class AuditLogManager {
    // Custom ID pattern for select menu: audit:<userId>:<channelId>:<messageId>
    
    public async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
        const customId = interaction.customId;
        if (!customId.startsWith("audit:")) return;

        const [, userId, channelId, messageId] = customId.split(":");
        const action = interaction.values[0];
        const guild = interaction.guild;
        if (!guild) return;

        const memberPermissions = interaction.memberPermissions;
        if (!memberPermissions) {
            await interaction.reply({ content: "Could not verify your permissions.", flags: MessageFlags.Ephemeral });
            return;
        }

        switch (action) {
            case "ignore": {
                if (!memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
                    await interaction.reply({ content: "You do not have permission to ignore violation logs.", flags: MessageFlags.Ephemeral });
                    return;
                }

                try {
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, "Ignore Log");
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: "Failed to ignore the log.", flags: MessageFlags.Ephemeral });
                }
                break;
            }
            case "delete": {
                if (!memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                    await interaction.reply({ content: "You do not have permission to delete messages.", flags: MessageFlags.Ephemeral });
                    return;
                }

                try {
                    await this.deleteOffendingMessage(guild, channelId, messageId);
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, "Delete Message");
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: "Failed to delete the message.", flags: MessageFlags.Ephemeral });
                }
                break;
            }
            case "warn": {
                if (!memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
                    await interaction.reply({ content: "You do not have permission to warn members.", flags: MessageFlags.Ephemeral });
                    return;
                }

                try {
                    const targetUser = await guild.client.users.fetch(userId);
                    const channel = await guild.channels.fetch(channelId);
                    const channelName = channel ? channel.name : "unknown-channel";

                    // Extract violation details from the existing log embed
                    const embed = interaction.message.embeds[0];
                    let violatingMessageContent = "Unknown (message deleted)";
                    let bannedTermAnalysis = "Unknown";

                    if (embed && embed.fields) {
                        const messageField = embed.fields.find(f => f.name === "Violating Message:");
                        if (messageField) {
                            violatingMessageContent = messageField.value;
                        }
                        const analysisField = embed.fields.find(f => f.name === "Banned Term Analysis:");
                        if (analysisField) {
                            bannedTermAnalysis = analysisField.value;
                        }
                    }

                    // Reconstruct the warning DM embed
                    const warningEmbed = new EmbedBuilder()
                        .setTitle(`Warning from ${inlineCode(guild.name)}`)
                        .setColor('Red')
                        .setDescription(`Category: ${inlineCode("Banned Term")}`)
                        .addFields(
                            { 
                                name: "Reason:",
                                value: codeBlock("Use of Banned Term in Message.")
                            },
                            {
                                name: "Your Message:",
                                value: violatingMessageContent
                            },
                            {
                                name: "From Channel:",
                                value: codeBlock(channelName)
                            },
                            {
                                name: "Banned Term Analysis:",
                                value: bannedTermAnalysis
                            }
                        )
                        .setAuthor({ 
                            name: guild.client.user?.displayName || 'Bot',
                            iconURL: guild.client.user?.displayAvatarURL() || ''
                        });

                    try {
                        await targetUser.send({ embeds: [warningEmbed] });
                    } catch (dmError: any) {
                        console.error("[AuditLogManager] Failed to send DM warning:", dmError);
                    }

                    // Delete the offending message
                    await this.deleteOffendingMessage(guild, channelId, messageId);

                    // Mark audit log as resolved
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, "Warn User");
                } catch (error: any) {
                    console.error(error);
                    await interaction.reply({ content: `Failed to execute action: ${error.message || error}`, flags: MessageFlags.Ephemeral });
                }
                break;
            }
            case "timeout": {
                if (!memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
                    await interaction.reply({ content: "You do not have permission to timeout members.", flags: MessageFlags.Ephemeral });
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`audit_modal:timeout:${userId}:${channelId}:${messageId}:${interaction.message.id}`)
                    .setTitle("Timeout User");

                const durationInput = new TextInputBuilder()
                    .setCustomId("duration")
                    .setLabel("Duration (Minutes)")
                    .setStyle(TextInputStyle.Short)
                    .setValue("10")
                    .setRequired(true);

                const reasonInput = new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel("Reason")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Reason for timeout")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
                );

                await interaction.showModal(modal);
                break;
            }
            case "kick": {
                if (!memberPermissions.has(PermissionFlagsBits.KickMembers)) {
                    await interaction.reply({ content: "You do not have permission to kick members.", flags: MessageFlags.Ephemeral });
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`audit_modal:kick:${userId}:${channelId}:${messageId}:${interaction.message.id}`)
                    .setTitle("Kick User");

                const reasonInput = new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel("Reason")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Reason for kick")
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

                await interaction.showModal(modal);
                break;
            }
            case "ban": {
                if (!memberPermissions.has(PermissionFlagsBits.BanMembers)) {
                    await interaction.reply({ content: "You do not have permission to ban members.", flags: MessageFlags.Ephemeral });
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`audit_modal:ban:${userId}:${channelId}:${messageId}:${interaction.message.id}`)
                    .setTitle("Ban User");

                const reasonInput = new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel("Reason")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Reason for ban")
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

                await interaction.showModal(modal);
                break;
            }
        }
    }

    public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const customId = interaction.customId;
        if (!customId.startsWith("audit_modal:")) return;

        const [, action, userId, channelId, messageId, auditLogMsgId] = customId.split(":");
        const guild = interaction.guild;
        if (!guild) return;

        const memberPermissions = interaction.memberPermissions;
        if (!memberPermissions) {
            await interaction.reply({ content: "Could not verify your permissions.", flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            let targetMember: GuildMember | null = null;
            try {
                targetMember = await guild.members.fetch(userId);
            } catch {
                // target member is no longer in the guild
            }

            const reason = interaction.fields.getTextInputValue("reason") || "No reason provided.";

            switch (action) {
                case "timeout": {
                    if (!memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
                        await interaction.reply({ content: "You do not have permission to timeout members.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    if (!targetMember) {
                        await interaction.reply({ content: "User is no longer in the guild.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const durationStr = interaction.fields.getTextInputValue("duration");
                    const durationMinutes = parseInt(durationStr, 10);

                    if (isNaN(durationMinutes) || durationMinutes <= 0) {
                        await interaction.reply({ content: "Please enter a valid positive number for duration.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    // Apply timeout
                    await targetMember.timeout(durationMinutes * 60 * 1000, reason);

                    // Delete the violating message if it still exists
                    await this.deleteOffendingMessage(guild, channelId, messageId);

                    // Mark audit log as resolved
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, `Timeout User (${durationMinutes}m)`);
                    break;
                }
                case "kick": {
                    if (!memberPermissions.has(PermissionFlagsBits.KickMembers)) {
                        await interaction.reply({ content: "You do not have permission to kick members.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    if (!targetMember) {
                        await interaction.reply({ content: "User is no longer in the guild.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    // Kick user
                    await targetMember.kick(reason);

                    // Delete offending message
                    await this.deleteOffendingMessage(guild, channelId, messageId);

                    // Mark audit log as resolved
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, "Kick User");
                    break;
                }
                case "ban": {
                    if (!memberPermissions.has(PermissionFlagsBits.BanMembers)) {
                        await interaction.reply({ content: "You do not have permission to ban members.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    // Ban user
                    await guild.bans.create(userId, { reason });

                    // Delete offending message
                    await this.deleteOffendingMessage(guild, channelId, messageId);

                    // Mark audit log as resolved
                    await this.markAuditLogAsResolved(interaction, interaction.user.id, "Ban User");
                    break;
                }
            }
        } catch (error: any) {
            console.error(error);
            await interaction.reply({ content: `Failed to execute action: ${error.message || error}`, flags: MessageFlags.Ephemeral });
        }
    }

    private async markAuditLogAsResolved(
        interaction: StringSelectMenuInteraction | ModalSubmitInteraction, 
        moderatorId: string, 
        actionName: string
    ): Promise<void> {
        try {
            const oldEmbed = interaction.message?.embeds[0];
            if (oldEmbed) {
                const resolvedEmbed = EmbedBuilder.from(oldEmbed)
                    .setColor('Green')
                    .addFields(
                        {
                            name: "Moderator:",
                            value: `<@${moderatorId}>`,
                            inline: true
                        },
                        {
                            name: "Action Taken:",
                            value: actionName,
                            inline: true
                        }
                    );

                await interaction.deferUpdate();
                await (interaction.message as any).edit({
                    embeds: [resolvedEmbed],
                    components: []
                });
            }
        } catch (e) {
            console.error("[AuditLogManager] Error marking audit log as resolved:", e);
        }
    }

    private async deleteOffendingMessage(guild: any, channelId: string, messageId: string): Promise<void> {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (channel && 'messages' in channel) {
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.delete();
                } catch (e: any) {
                    if (e.code === 10008) {
                        console.log("[AuditLogManager] Target message already deleted.");
                    } else {
                        throw e;
                    }
                }
            }
        } catch (e) {
            console.error("[AuditLogManager] Error deleting target message:", e);
        }
    }
}

export const auditLogManager = new AuditLogManager();
