import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/note.dto';

const withAuthor = { author: { select: { id: true, name: true, email: true } } } satisfies Prisma.NoteInclude;
type NoteRow = Prisma.NoteGetPayload<{ include: typeof withAuthor }>;

const shape = (n: NoteRow) => ({
  id: n.id,
  body: n.body,
  dealId: n.dealId,
  personId: n.personId,
  authorUserId: n.authorUserId,
  authorName: n.author.name || n.author.email,
  createdAt: n.createdAt,
});

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, filters: { dealId?: string; personId?: string }) {
    const rows = await this.prisma.note.findMany({
      where: { orgId, dealId: filters.dealId, personId: filters.personId },
      orderBy: { createdAt: 'desc' },
      include: withAuthor,
    });
    return rows.map(shape);
  }

  async create(orgId: string, authorUserId: string, dto: CreateNoteDto) {
    const row = await this.prisma.note.create({
      data: {
        orgId,
        authorUserId,
        body: dto.body,
        dealId: dto.dealId ?? null,
        personId: dto.personId ?? null,
      },
      include: withAuthor,
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    const note = await this.prisma.note.findFirst({ where: { id, orgId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.note.delete({ where: { id } });
  }
}
