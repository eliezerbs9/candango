import { OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAutomationsExecutor } from './email-automations.executor';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Time-based automations (FR-16.3). A daily BullMQ job scans for deals matching each `follow_up`
 * automation ("deal sits in stage X for N days") and fires its action once per deal — claiming an
 * `AutomationRun` row BEFORE firing so it never repeats (at-most-once, even across API instances).
 * Runs with no tenant context, so Prisma bypasses RLS and sees every org; each query filters by the
 * automation's own `orgId`.
 */
@Processor('automation-scan')
export class AutomationScanProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AutomationScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: EmailAutomationsExecutor,
    @InjectQueue('automation-scan') private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    // One daily repeatable (BullMQ dedupes by key across instances).
    await this.queue.add('scan', {}, { repeat: { every: DAY_MS }, removeOnComplete: true, removeOnFail: true });
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'scan') return;
    await this.scanFollowUp();
  }

  private async scanFollowUp(): Promise<void> {
    const autos = await this.prisma.emailAutomation.findMany({
      where: { enabled: true, archivedAt: null, trigger: 'follow_up' },
      include: { template: { select: { subject: true, body: true } } },
    });

    for (const auto of autos) {
      const config = (auto.config ?? {}) as Record<string, unknown>;
      const afterDays = Number(config.afterDays);
      if (!Number.isFinite(afterDays) || afterDays < 0) continue;
      const cutoff = new Date(Date.now() - afterDays * DAY_MS);
      const stageId = typeof config.stageId === 'string' && config.stageId ? config.stageId : undefined;

      const deals = await this.prisma.deal.findMany({
        where: {
          orgId: auto.orgId,
          deletedAt: null,
          archivedAt: null,
          status: 'open',
          stageChangedAt: { lte: cutoff },
          ...(stageId ? { stageId } : {}),
        },
        select: { id: true },
      });

      for (const deal of deals) {
        // Claim first — the unique (automationId, dealId) index makes this at-most-once.
        try {
          await this.prisma.automationRun.create({
            data: { orgId: auto.orgId, automationId: auto.id, dealId: deal.id },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // already fired
          this.logger.warn(`claim failed for automation ${auto.id} deal ${deal.id}: ${e instanceof Error ? e.message : e}`);
          continue;
        }
        await this.executor
          .fireForDeal(auto.orgId, deal.id, auto)
          .catch((e) => this.logger.warn(`automation ${auto.id} failed: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }
}
