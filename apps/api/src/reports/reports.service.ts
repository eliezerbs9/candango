import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string; won: number; lost: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleString('en-US', { month: 'short' }), won: 0, lost: 0 });
  }
  return out;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open-pipeline KPIs + value by stage (optionally for one pipeline). */
  async pipeline(orgId: string, pipelineId?: string) {
    const where = { orgId, ...(pipelineId ? { pipelineId } : {}) };
    const stages = await this.prisma.stage.findMany({
      where,
      orderBy: [{ pipelineId: 'asc' }, { position: 'asc' }],
    });
    const grouped = await this.prisma.deal.groupBy({
      by: ['stageId'],
      where: { ...where, status: 'open', deletedAt: null },
      _sum: { value: true },
      _count: { _all: true },
    });

    const byStage = stages.map((s) => {
      const g = grouped.find((x) => x.stageId === s.id);
      const totalValue = g?._sum.value ?? 0;
      const count = g?._count._all ?? 0;
      return {
        stageId: s.id,
        stageName: s.name,
        count,
        totalValue,
        weightedValue: Math.round((totalValue * s.probability) / 100),
      };
    });

    const kpis = byStage.reduce(
      (a, s) => ({
        openValue: a.openValue + s.totalValue,
        weightedValue: a.weightedValue + s.weightedValue,
        openDeals: a.openDeals + s.count,
      }),
      { openValue: 0, weightedValue: 0, openDeals: 0 },
    );

    return { kpis, byStage };
  }

  /** Open value + win/loss counts per sales rep (owner). */
  async byRep(orgId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { orgId, deletedAt: null },
      select: { ownerUserId: true, status: true, value: true },
    });
    const users = await this.prisma.user.findMany({
      where: { orgId },
      select: { id: true, name: true, email: true },
    });
    const nameOf = (id: string) => {
      const u = users.find((x) => x.id === id);
      return u?.name || u?.email || 'Unknown';
    };

    const map = new Map<string, { name: string; openValue: number; won: number; lost: number }>();
    for (const d of deals) {
      const cur = map.get(d.ownerUserId) ?? { name: nameOf(d.ownerUserId), openValue: 0, won: 0, lost: 0 };
      if (d.status === 'open') cur.openValue += d.value;
      else if (d.status === 'won') cur.won += 1;
      else if (d.status === 'lost') cur.lost += 1;
      map.set(d.ownerUserId, cur);
    }
    return Array.from(map.values());
  }

  /** Won/Lost value over the last 6 months (by updatedAt as close-date proxy). */
  async wonLost(orgId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { orgId, status: { in: ['won', 'lost'] }, deletedAt: null },
      select: { status: true, value: true, updatedAt: true },
    });
    const buckets = lastMonths(6);
    const idx = new Map(buckets.map((b) => [b.key, b]));
    for (const d of deals) {
      const b = idx.get(d.updatedAt.toISOString().slice(0, 7));
      if (b) {
        if (d.status === 'won') b.won += d.value;
        else b.lost += d.value;
      }
    }
    return buckets.map((b) => ({ period: b.label, won: b.won, lost: b.lost }));
  }
}
