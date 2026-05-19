import packageInfo from "../../package.json" with { type: 'json' };
import SubCommand from '../util/SubCommand.js';
import { 
    ActionRowBuilder,
    TextInputBuilder,
    ModalBuilder,
    MessageFlags,
    TextInputStyle,
    ChatInputCommandInteraction,
    SlashCommandBuilder
} from "discord.js";
import { 
    Paginator,
    ListingConfig
} from "../util/Paginator.js";
import ModalHandler from "../util/ModalHandler.js";
import { lookoutRepository } from '../repositories/Index.js';
import { moderationRuleCache } from '../moderation/ModerationRuleCache.js';
import config from "../../config.json" with { type: 'json' };
import { RuleBasedModerator } from "../moderation/RuleBasedModerator.js";

const { name } = packageInfo;

export default class LookoutTerm extends SubCommand {
    interact_input_interval = config.ui.interaction.defaultInterval;
    max_lookout_term_length = config.moderation.lookout.maxTermLength;
    listing_config: ListingConfig = {
        "title": "Lookout Terms",
        "header": ["Term", "Offset"],
        "color": config.ui.embedColor,
        "pageSize": config.ui.pagination.defaultPageSize
    };
    modal_handler: ModalHandler;

    private readonly handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
        show: this.handleShow,
        add: this.handleAdd,
        delete: this.handleDelete,
        update: this.handleUpdate
    };

    constructor(){
        super('setting', 'lookout_term', `Terms that ${name} should be looking out for.`)
        this.modal_handler = ModalHandler.get_instance()
        this.modal_handler.register("add_term", this, "add_term")
        this.modal_handler.register("delete_term", this, "delete_term")
        this.modal_handler.register("update_term", this, "update_term")
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
        const lookout_terms = await lookoutRepository.getAllForGuild(interaction.guildId!)
        const lookout_term_embed_data = lookout_terms.map(t => [t.term, String(t.maxOffset)])

        const paginator = new Paginator(
            interaction,
            lookout_term_embed_data,
            this.listing_config,
            this.interact_input_interval
        )

        await paginator.send()
    }

    private async handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const write_input_modal = new ModalBuilder()
            .setCustomId("add_term")
            .setTitle("Add Lookout Term")

        const term_input = new TextInputBuilder()
            .setCustomId("term")
            .setLabel("term")
            .setStyle(TextInputStyle.Short)       
        
        const offset_input = new TextInputBuilder()
            .setCustomId("offset")
            .setLabel("offset")
            .setStyle(TextInputStyle.Short)

        write_input_modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(term_input),
            new ActionRowBuilder<TextInputBuilder>().addComponents(offset_input)
        )
        await interaction.showModal(write_input_modal)
    }

    private async handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
        const write_input_modal = new ModalBuilder()
            .setCustomId("delete_term")
            .setTitle("Delete Lookout Term")

        const term_input = new TextInputBuilder()
            .setCustomId("term")
            .setLabel("term")
            .setStyle(TextInputStyle.Short)       

        write_input_modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(term_input)
        )
        await interaction.showModal(write_input_modal)
    }

    private async handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {
        const write_input_modal = new ModalBuilder()
            .setCustomId("update_term")
            .setTitle("Update Lookout Term")

        const term_input = new TextInputBuilder()
            .setCustomId("term")
            .setLabel("term")
            .setStyle(TextInputStyle.Short)       
        
        const offset_input = new TextInputBuilder()
            .setCustomId("offset")
            .setLabel("offset")
            .setStyle(TextInputStyle.Short)

        write_input_modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(term_input),
            new ActionRowBuilder<TextInputBuilder>().addComponents(offset_input)
        )
        await interaction.showModal(write_input_modal)
    }

    async add_term({ guild_id, submission_field }: { guild_id: string, submission_field: Map<string, any> }) {
        await lookoutRepository.addTerm(
            guild_id,
            RuleBasedModerator.normalize(submission_field.get('term').value),
            Number(submission_field.get('offset').value)
        )
        moderationRuleCache.invalidateCache(guild_id);
    }
    
    async update_term({ guild_id, submission_field }: { guild_id: string, submission_field: Map<string, any> }) {
        await lookoutRepository.updateTerm(
            guild_id,
            RuleBasedModerator.normalize(submission_field.get('term').value),
            Number(submission_field.get('offset').value)
        )
        moderationRuleCache.invalidateCache(guild_id);
    }

    async delete_term({ guild_id, submission_field }: { guild_id: string, submission_field: Map<string, any> }) {
        await lookoutRepository.deleteTerm(
            guild_id,
            RuleBasedModerator.normalize(submission_field.get('term').value)
        )
        moderationRuleCache.invalidateCache(guild_id);
    }

    validate_offset(term: string, offset: number){
        return offset <= Math.ceil(term.length / 2)
    }

    addBaseCmd(base_cmd_ref: SlashCommandBuilder): void {
        base_cmd_ref.addSubcommand(subcommand => 
            subcommand.setName(this.name)
                .setDescription(this.description)
                .addStringOption(option => option
                    .setName('action')
                    .setDescription('choose an action')
                    .addChoices(
                        { name: 'show-terms', value: 'show' },
                        { name: 'add-term', value: 'add' },
                        { name: 'delete-term', value: 'delete' },
                        { name: 'update-term', value: 'update' }
                    )
                    .setRequired(true)
                )
        )
    }
}
