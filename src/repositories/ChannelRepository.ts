import prisma from '../PrismaClient.js';
import { IgnoredChannel } from '@prisma/client';

export class ChannelRepository {
    async getAllForGuild(guildId: string): Promise<IgnoredChannel[]> {
        return prisma.ignoredChannel.findMany({
            where: { guildId }
        });
    }

    async getIgnoredChannelIds(guildId: string): Promise<string[]> {
        const channels = await this.getAllForGuild(guildId);
        return channels.map(c => c.id);
    }

    async addIgnoredChannel(guildId: string, channelId: string): Promise<IgnoredChannel> {
        return prisma.ignoredChannel.create({
            data: {
                guildId,
                id: channelId
            }
        });
    }

    async removeIgnoredChannel(guildId: string, channelId: string): Promise<IgnoredChannel> {
        return prisma.ignoredChannel.delete({
            where: {
                id_guildId: {
                    guildId,
                    id: channelId
                }
            }
        });
    }

    async isIgnored(guildId: string, channelId: string): Promise<boolean> {
        const count = await prisma.ignoredChannel.count({
            where: {
                guildId,
                id: channelId
            }
        });
        return count > 0;
    }
}

export const channelRepository = new ChannelRepository();
