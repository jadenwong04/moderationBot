import { Client, REST, Routes, Collection } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ExtendedClient } from '../DiscordClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CommandManager {
    constructor(private client: ExtendedClient) {}

    public async loadCommands(): Promise<void> {
        this.client.base_command.clear();
        this.client.sub_command.clear();

        const base_command_path = path.join(__dirname, '..', 'command');
        const base_commands = fs.readdirSync(base_command_path).filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts'));
        
        for (const file of base_commands){
            const filePath = path.join(base_command_path, file);
            const fileUrl = pathToFileURL(filePath).href;
            const { default: CommandClass } = await import(`${fileUrl}?update=${Date.now()}`);
            const base_command_instance = await (new CommandClass()).async_init();
            this.client.base_command.set(base_command_instance.name, base_command_instance);
        };

        const sub_command_path = path.join(__dirname, '..', 'subcommand');
        const sub_commands = fs.readdirSync(sub_command_path).filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts'));
        
        for (const file of sub_commands){
            const filePath = path.join(sub_command_path, file);
            const fileUrl = pathToFileURL(filePath).href;
            const { default: SubCommandClass } = await import(`${fileUrl}?update=${Date.now()}`);
            const sub_command_instance = await (new SubCommandClass()).async_init();
            
            if (this.client.sub_command.get(sub_command_instance.base_command) == null){
                this.client.sub_command.set(sub_command_instance.base_command, new Collection());
            }
            this.client.sub_command.get(sub_command_instance.base_command)!.set(sub_command_instance.name, sub_command_instance);
        };
    }

    public async registerWithDiscord(guildId: string): Promise<void> {
        const commands_json = this.client.base_command.map((base_cmd: any) => {
            const base_cmd_data = base_cmd.getData();
            this.client.sub_command.get(base_cmd.name)?.forEach((sub_cmd: any) => {
                sub_cmd.addBaseCmd(base_cmd_data as any);
            });
            return base_cmd_data.toJSON();
        });

        const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

        try {
            console.log(`Begin registering commands for guild ${guildId}`);
            const data: any = await rest.put( 	
                Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID!, guildId),
                { body: commands_json },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
        } catch (error) {
            console.error(`Error registering commands for guild ${guildId}:`, error);
        }
    }
}
