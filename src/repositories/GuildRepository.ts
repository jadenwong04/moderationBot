import prisma from '../PrismaClient.js';
import { Guild } from '@prisma/client';

export class GuildRepository {
    async findById(id: string): Promise<Guild | null> {
        return prisma.guild.findUnique({
            where: { id }
        });
    }

    async upsert(id: string): Promise<Guild> {
        return prisma.guild.upsert({
            where: { id },
            update: {},
            create: { id }
        });
    }

    async getAllIds(): Promise<string[]> {
        const guilds = await prisma.guild.findMany({
            select: { id: true }
        });
        return guilds.map(g => g.id);
    }
}

export const guildRepository = new GuildRepository();
