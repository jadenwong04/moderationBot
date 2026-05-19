import prisma from '../PrismaClient.js';
import { BannedTerm } from '@prisma/client';

export class LookoutRepository {
    async getAllForGuild(guildId: string): Promise<BannedTerm[]> {
        return prisma.bannedTerm.findMany({
            where: { guildId }
        });
    }

    async getLookoutTermsFormatted(guildId: string): Promise<string[]> {
        const terms = await this.getAllForGuild(guildId);
        return terms.map(t => `${t.term}:${t.maxOffset}`);
    }

    async addTerm(guildId: string, term: string, offset: number): Promise<BannedTerm> {
        const result = await prisma.bannedTerm.create({
            data: {
                guildId,
                term,
                maxOffset: offset
            }
        });
        return result;
    }

    async updateTerm(guildId: string, term: string, offset: number): Promise<BannedTerm> {
        const result = await prisma.bannedTerm.update({
            where: {
                guildId_term: {
                    guildId,
                    term
                }
            },
            data: {
                maxOffset: offset
            }
        });
        return result;
    }

    async deleteTerm(guildId: string, term: string): Promise<BannedTerm> {
        const result = await prisma.bannedTerm.delete({
            where: {
                guildId_term: {
                    guildId,
                    term
                }
            }
        });
        return result;
    }
}

export const lookoutRepository = new LookoutRepository();
