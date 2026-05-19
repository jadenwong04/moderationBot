import { 
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType,
    AnyComponentBuilder,
    InteractionResponse,
    ChatInputCommandInteraction,
    ColorResolvable
} from "discord.js"

export interface ListingConfig {
    page_size: number;
    color: ColorResolvable;
    title: string;
    header: string[];
}

export function build_paging_component(): ActionRowBuilder<ButtonBuilder> {
    const next_btn = new ButtonBuilder()
        .setCustomId("next")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("▶️")

    const prev_btn = new ButtonBuilder()
        .setCustomId("prev")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("◀️")
    
    const paging_components = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(prev_btn, next_btn)
    
    return paging_components
}

export function format_tabular_data(header: string[], rows: any[][]): string {
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

export function build_listing_embed(
    listing_config: ListingConfig,
    paging_data: any[][],
    current_page: number
): EmbedBuilder {
    const start_paging_idx = (current_page-1) * listing_config.page_size
    const end_paging_idx = start_paging_idx + listing_config.page_size 
    const current_page_data = paging_data.slice(start_paging_idx, end_paging_idx)

    const embedded_page = new EmbedBuilder()
        .setColor(listing_config.color)
        .setTitle(listing_config.title)
        .setDescription(format_tabular_data(listing_config.header, current_page_data))
        .setFooter({ text: `Page: ${current_page}/${Math.ceil(paging_data.length / listing_config.page_size)}`})
        .setTimestamp()
    
    return embedded_page
}

export function setup_paging_collector(
    interaction_to_update: ChatInputCommandInteraction,
    paging_component_response: any,
    interaction_interval: number,
    paging_data: any[][],
    listing_config: ListingConfig
): void {
    const max_page = Math.ceil(paging_data.length / listing_config.page_size)
    let current_page = 1

    const paging_collector = paging_component_response.resource?.message?.createMessageComponentCollector(
        { 
            componentType: ComponentType.Button,
            time: interaction_interval 
        }
    )

    if (!paging_collector) return;

    const interaction_update = () => {
        const updated_listing_embed = build_listing_embed(
            listing_config,
            paging_data,
            current_page
        )

        interaction_to_update.editReply({ embeds: [updated_listing_embed] });
    }

    paging_collector.on('collect', async (component_interaction: any) => {
        if (component_interaction.customId == "next") {
            if (current_page < max_page) {
                current_page += 1
                interaction_update()
            }
        } else if (component_interaction.customId == "prev") {
            if (current_page > 1) {
                current_page -= 1
                interaction_update()
            }
        }
        component_interaction.deferUpdate();
    })
}
