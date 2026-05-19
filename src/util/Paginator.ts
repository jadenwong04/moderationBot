import { 
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType,
    ChatInputCommandInteraction,
    ColorResolvable,
    MessageFlags
} from "discord.js";
import config from "../../config.json" with { type: 'json' };

export interface ListingConfig {
    pageSize: number;
    color: ColorResolvable;
    title: string;
    header: string[];
}

export class Paginator {
    private currentPage: number = 1;
    private maxPage: number;

    constructor(
        private interaction: ChatInputCommandInteraction,
        private data: any[][],
        private listingConfig: ListingConfig,
        private timeout: number = config.ui.pagination.timeout
    ) {
        this.maxPage = Math.ceil(this.data.length / this.listingConfig.pageSize);
    }

    public async send(): Promise<void> {
        console.log(`[Paginator] Sending initial embed for "${this.listingConfig.title}"`);
        const embed = this.buildEmbed();
        const buttons = this.buildButtons();

        await this.interaction.reply({
            embeds: [embed],
            components: [buttons],
            flags: MessageFlags.Ephemeral
        });

        this.setupCollector();
    }

    private buildButtons(): ActionRowBuilder<ButtonBuilder> {
        const nextBtn = new ButtonBuilder()
            .setCustomId("next")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("▶️")
            .setDisabled(this.currentPage >= this.maxPage);

        const prevBtn = new ButtonBuilder()
            .setCustomId("prev")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("◀️")
            .setDisabled(this.currentPage <= 1);
        
        return new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
    }

    private buildEmbed(): EmbedBuilder {
        const startIdx = (this.currentPage - 1) * this.listingConfig.pageSize;
        const endIdx = startIdx + this.listingConfig.pageSize;
        const pageData = this.data.slice(startIdx, endIdx);

        return new EmbedBuilder()
            .setColor(this.listingConfig.color)
            .setTitle(this.listingConfig.title)
            .setDescription(this.formatTabularData(this.listingConfig.header, pageData))
            .setFooter({ text: `Page: ${this.currentPage}/${this.maxPage}` })
            .setTimestamp();
    }

    private formatTabularData(header: string[], rows: any[][]): string {
        if (!header || header.length === 0) return "```No header```";
        if (!rows || rows.length === 0) return "```No data```";

        const allRows = [header, ...rows];
        const colWidths = header.map((_, colIndex) =>
            Math.max(...allRows.map(row => (row[colIndex] ? row[colIndex].toString().length : 0)))
        );

        const makeLine = (row: any[]) =>
            row
                .map((cell, colIndex) =>
                    (cell !== undefined && cell !== null ? cell.toString() : "").padEnd(colWidths[colIndex], " ")
                )
                .join(" | ");

        const headerLine = makeLine(header);
        const separator = colWidths.map((w) => "-".repeat(w)).join("-|-");
        const body = rows.map(makeLine);

        return "```" + [headerLine, separator, ...body].join("\n") + "```";
    }

    private setupCollector(): void {
        console.log(`[Paginator] Setting up collector for interaction ${this.interaction.id}`);
        
        const collector = this.interaction.channel?.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: this.timeout,
            filter: (i) => i.user.id === this.interaction.user.id
        });

        if (!collector) {
            console.error(`[Paginator] Failed to create collector - channel is likely not text-based or accessible.`);
            return;
        }

        collector.on('collect', async (componentInteraction: any) => {
            console.log(`[Paginator] Collected interaction: ${componentInteraction.customId} from user ${componentInteraction.user.tag}`);
            
            if (componentInteraction.customId === "next") {
                if (this.currentPage < this.maxPage) {
                    this.currentPage += 1;
                    console.log(`[Paginator] Moving to page ${this.currentPage}`);
                    await this.update();
                }
            } else if (componentInteraction.customId === "prev") {
                if (this.currentPage > 1) {
                    this.currentPage -= 1;
                    console.log(`[Paginator] Moving to page ${this.currentPage}`);
                    await this.update();
                }
            }
            
            try {
                await componentInteraction.deferUpdate();
            } catch (e) {
                console.error(`[Paginator] Error deferring update:`, e);
            }
        });

        collector.on('end', async (collected, reason) => {
            console.log(`[Paginator] Collector ended. Reason: ${reason}. Total collected: ${collected.size}`);
            try {
                const disabledButtons = this.buildButtons();
                disabledButtons.components.forEach(btn => btn.setDisabled(true));
                await this.interaction.editReply({ components: [disabledButtons] });
            } catch (e) {
                console.warn(`[Paginator] Could not disable buttons on end (interaction might have expired or been deleted).`);
            }
        });
    }

    private async update(): Promise<void> {
        try {
            const embed = this.buildEmbed();
            const buttons = this.buildButtons();
            await this.interaction.editReply({ embeds: [embed], components: [buttons] });
        } catch (e) {
            console.error(`[Paginator] Error updating interaction:`, e);
        }
    }
}
