/**
 * Demo data seeder — populates an isolated "demo" organization with realistic
 * companies, contacts, deals, activities and notes so the app screens (dashboard,
 * pipeline, contacts, calendar) look full for marketing screenshots.
 *
 * Run:  cd apps/api && node --env-file=.env prisma/seed-demo.mjs
 * Idempotent: re-running wipes and rebuilds the demo org's CRM data only.
 * Connects via DIRECT_URL (owner) so it bypasses RLS to write across tables.
 *
 * Login after seeding:  demo@candango.app  /  demo1234   (at the web app /login)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const DEMO_EMAIL = 'demo@candango.app';
const DEMO_PASSWORD = 'demo1234';
const usd = (dollars) => Math.round(dollars * 100); // → cents
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
const at = (dayOffset, hour, min = 0) => {
  const x = new Date();
  x.setDate(x.getDate() + dayOffset);
  x.setHours(hour, min, 0, 0);
  return x;
};

async function main() {
  // 1) Organization (active subscription so no trial banner shows in shots)
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-candango' },
    update: { plan: 'standard' },
    create: { name: 'Candango Demo Co.', slug: 'demo-candango', plan: 'standard' },
  });

  const admin = await prisma.role.findFirst({ where: { orgId: org.id, name: 'Admin' } })
    ?? await prisma.role.create({ data: { orgId: org.id, name: 'Admin', isSystem: true, permissions: ['*'], visibility: 'org' } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: DEMO_EMAIL } },
    update: { passwordHash, status: 'active', emailVerifiedAt: new Date(), roleId: admin.id },
    create: { orgId: org.id, email: DEMO_EMAIL, name: 'Alex Morgan', passwordHash, status: 'active', emailVerifiedAt: new Date(), roleId: admin.id },
  });

  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: { status: 'active' },
    create: {
      orgId: org.id, stripeCustomerId: `cus_demo_${org.id.slice(-8)}`, status: 'active',
      seats: 1, pricePerSeat: 3000, currency: 'USD', currentPeriodEnd: daysFromNow(30),
    },
  });

  // 2) Pipeline + stages (idempotent)
  let pipeline = await prisma.pipeline.findFirst({ where: { orgId: org.id, name: 'Sales Pipeline' } });
  if (!pipeline) pipeline = await prisma.pipeline.create({ data: { orgId: org.id, name: 'Sales Pipeline', isDefault: true, position: 0 } });
  const stageDefs = [
    { name: 'Lead', probability: 10 },
    { name: 'Qualified', probability: 25 },
    { name: 'Proposal', probability: 50 },
    { name: 'Negotiation', probability: 75 },
  ];
  const stages = {};
  for (let i = 0; i < stageDefs.length; i++) {
    const existing = await prisma.stage.findFirst({ where: { orgId: org.id, pipelineId: pipeline.id, name: stageDefs[i].name } });
    stages[stageDefs[i].name] = existing
      ?? await prisma.stage.create({ data: { orgId: org.id, pipelineId: pipeline.id, name: stageDefs[i].name, position: i, probability: stageDefs[i].probability } });
  }

  // 3) Wipe previous demo CRM data (children → parents)
  const oldDeals = await prisma.deal.findMany({ where: { orgId: org.id }, select: { id: true } });
  await prisma.message.deleteMany({ where: { orgId: org.id } });
  await prisma.note.deleteMany({ where: { orgId: org.id } });
  await prisma.calendarEvent.deleteMany({ where: { orgId: org.id } }); // FK before activities
  await prisma.activity.deleteMany({ where: { orgId: org.id } }); // cascades activity participants
  await prisma.dealStageEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.dealInvoice.deleteMany({ where: { orgId: org.id } }); // cascades invoice lines
  await prisma.dealEstimate.deleteMany({ where: { orgId: org.id } }); // cascades estimate lines
  await prisma.dealParticipant.deleteMany({ where: { dealId: { in: oldDeals.map((d) => d.id) } } });
  await prisma.deal.deleteMany({ where: { orgId: org.id } });
  await prisma.person.deleteMany({ where: { orgId: org.id } }); // cascades company contacts
  await prisma.company.deleteMany({ where: { orgId: org.id } });

  // 4) Companies + contacts
  const companyData = [
    { name: 'Northwind Trading', domain: 'northwind.co', phone: '+1 415-555-0142', city: 'San Francisco', state: 'CA', line1: '500 Market St', postalCode: '94105',
      contacts: [{ name: 'Jane Whitfield', title: 'VP Operations' }, { name: 'Marcus Lee', title: 'Procurement Lead' }] },
    { name: 'Acme Robotics', domain: 'acmerobotics.io', phone: '+1 512-555-0119', city: 'Austin', state: 'TX', line1: '2200 Guadalupe St', postalCode: '78705',
      contacts: [{ name: 'Priya Nair', title: 'Head of Sales' }] },
    { name: 'Brightwave Media', domain: 'brightwave.media', phone: '+1 212-555-0188', city: 'New York', state: 'NY', line1: '88 Greenwich St', postalCode: '10006',
      contacts: [{ name: 'Daniel Costa', title: 'Founder' }, { name: 'Sofia Almeida', title: 'COO' }] },
    { name: 'Cedar & Co.', domain: 'cedarandco.com', phone: '+1 312-555-0173', city: 'Chicago', state: 'IL', line1: '120 N Wacker Dr', postalCode: '60606',
      contacts: [{ name: 'Thomas Reed', title: 'Director of IT' }] },
    { name: 'Helio Systems', domain: 'heliosystems.dev', phone: '+1 206-555-0164', city: 'Seattle', state: 'WA', line1: '400 Pine St', postalCode: '98101',
      contacts: [{ name: 'Grace Kim', title: 'CTO' }, { name: 'Oliver Brandt', title: 'Eng Manager' }] },
    { name: 'Vantage Logistics', domain: 'vantagelogistics.com', phone: '+1 720-555-0151', city: 'Denver', state: 'CO', line1: '1700 Lincoln St', postalCode: '80203',
      contacts: [{ name: 'Hannah Schultz', title: 'Operations Director' }] },
  ];

  const companies = [];
  for (const c of companyData) {
    const company = await prisma.company.create({
      data: {
        orgId: org.id, name: c.name, domain: c.domain, phone: c.phone, ownerUserId: user.id,
        address: { line1: c.line1, city: c.city, state: c.state, postalCode: c.postalCode, country: 'US' },
      },
    });
    const people = [];
    for (const ct of c.contacts) {
      const handle = ct.name.toLowerCase().split(' ')[0];
      const person = await prisma.person.create({
        data: {
          orgId: org.id, name: ct.name, ownerUserId: user.id,
          // The app stores emails/phones as plain string arrays (shape() returns emails[0]).
          emails: [`${handle}@${c.domain}`],
          phones: [c.phone],
          address: { line1: c.line1, city: c.city, state: c.state, postalCode: c.postalCode, country: 'US' },
          customFields: { title: ct.title },
        },
      });
      await prisma.companyContact.create({ data: { companyId: company.id, personId: person.id } });
      people.push(person);
    }
    companies.push({ company, people });
  }

  // 5) Deals — spread across stages + a few won/lost (won = recent so the dashboard "won this month" fills)
  const C = (i) => companies[i].company;
  const P = (i, j = 0) => companies[i].people[j];
  const dealDefs = [
    { co: 0, title: 'Annual platform license', value: 48000, stage: 'Negotiation', status: 'open', close: 12 },
    { co: 0, title: 'Onboarding & training package', value: 9500, stage: 'Proposal', status: 'open', close: 20 },
    { co: 1, title: 'Fleet automation rollout', value: 72000, stage: 'Qualified', status: 'open', close: 35 },
    { co: 2, title: 'Content workflow subscription', value: 18000, stage: 'Proposal', status: 'open', close: 9 },
    { co: 2, title: 'Premium support tier', value: 6000, stage: 'Lead', status: 'open', close: 40 },
    { co: 3, title: 'Data migration project', value: 24500, stage: 'Negotiation', status: 'open', close: 6 },
    { co: 4, title: 'Enterprise rollout (50 seats)', value: 90000, stage: 'Qualified', status: 'open', close: 30 },
    { co: 4, title: 'API integration add-on', value: 13500, stage: 'Lead', status: 'open', close: 28 },
    { co: 5, title: 'Logistics dashboard pilot', value: 15000, stage: 'Proposal', status: 'open', close: 15 },
    { co: 1, title: 'Renewal — robotics suite', value: 52000, stage: 'Lead', status: 'open', close: 45 },
    // Won this month
    { co: 3, title: 'Security & compliance package', value: 31000, stage: 'Negotiation', status: 'won', close: -3 },
    { co: 0, title: 'Q1 expansion deal', value: 27000, stage: 'Negotiation', status: 'won', close: -8 },
    { co: 5, title: 'Warehouse analytics seats', value: 16500, stage: 'Negotiation', status: 'won', close: -14 },
    // Lost
    { co: 2, title: 'Legacy system replacement', value: 40000, stage: 'Proposal', status: 'lost', close: -10 },
  ];

  let seq = 0;
  const deals = [];
  for (const d of dealDefs) {
    seq += 1;
    const deal = await prisma.deal.create({
      data: {
        orgId: org.id, refNumber: seq, title: `${C(d.co).name} — ${d.title}`,
        value: usd(d.value), currency: 'USD',
        pipelineId: pipeline.id, stageId: stages[d.stage].id, ownerUserId: user.id,
        primaryPersonId: P(d.co).id, companyId: C(d.co).id,
        status: d.status, lostReason: d.status === 'lost' ? 'Went with a competitor' : null,
        expectedCloseDate: daysFromNow(d.close), stageChangedAt: daysFromNow(Math.min(d.close, 0)),
      },
    });
    deals.push(deal);
  }
  await prisma.organization.update({ where: { id: org.id }, data: { dealSeq: seq } });

  // 6) Activities (calendar + timeline) — this week, assigned to the demo user
  const meet = (subj, dayOffset, hour, dur, dealIdx) => ({
    orgId: org.id, type: 'meeting', subject: subj, assignedUserId: user.id, dealId: deals[dealIdx].id,
    personId: deals[dealIdx].primaryPersonId, startAt: at(dayOffset, hour), endAt: at(dayOffset, hour, dur),
    locationType: 'video', conferenceUrl: 'https://meet.google.com/demo-candango',
  });
  const task = (subj, dayOffset, dealIdx) => ({
    orgId: org.id, type: 'task', subject: subj, assignedUserId: user.id, dealId: deals[dealIdx].id,
    personId: deals[dealIdx].primaryPersonId, dueAt: at(dayOffset, 17),
  });
  const call = (subj, dayOffset, hour, dealIdx) => ({
    orgId: org.id, type: 'call', subject: subj, assignedUserId: user.id, dealId: deals[dealIdx].id,
    personId: deals[dealIdx].primaryPersonId, startAt: at(dayOffset, hour), endAt: at(dayOffset, hour, 30), locationType: 'phone',
  });
  const activities = [
    meet('Contract review — Northwind', 1, 10, 45, 0),
    meet('Discovery call — Acme Robotics', 2, 14, 30, 2),
    meet('Proposal walkthrough — Helio', 3, 11, 60, 6),
    call('Follow-up on pricing — Brightwave', 0, 16, 3),
    call('Check-in — Vantage pilot', 4, 9, 8),
    task('Send updated quote to Cedar & Co.', 1, 5),
    task('Prepare onboarding plan — Northwind', 2, 1),
    task('Draft renewal terms — Acme', 5, 9),
    // Earlier in the month — fills the calendar (offsets are days before "today")
    call('Intro call — Acme Robotics', -25, 10, 2),
    meet('Kickoff — Northwind', -24, 14, 45, 0),
    task('Research Brightwave stack', -22, 3),
    meet('Demo — Helio Systems', -21, 11, 60, 6),
    call('Qualification — Vantage', -18, 15, 8),
    task('Send NDA to Cedar & Co.', -17, 5),
    meet('Requirements — Acme renewal', -15, 9, 30, 9),
    call('Pricing discussion — Northwind', -14, 16, 1),
    meet('Stakeholder review — Helio', -11, 13, 45, 7),
    task('Prepare proposal — Brightwave', -10, 3),
    call('Follow-up — Vantage pilot', -8, 10, 8),
    meet('Negotiation — Cedar migration', -7, 14, 60, 5),
    task('Update CRM notes — Acme', -4, 2),
    meet('Check-in — Northwind expansion', -3, 11, 30, 11),
  ];
  for (const a of activities) await prisma.activity.create({ data: a });

  // 7) Notes on a few deals (deal timeline)
  const notes = [
    { dealIdx: 0, body: 'Legal reviewing the MSA. Decision expected by end of week — Jane is championing internally.' },
    { dealIdx: 2, body: 'Budget approved for Q2. Need to confirm seat count before sending the proposal.' },
    { dealIdx: 6, body: 'Grace wants an integration demo with their data warehouse. Scheduling for next week.' },
    { dealIdx: 5, body: 'Migration window is tight — they want to go live before their fiscal close.' },
  ];
  for (const n of notes) await prisma.note.create({ data: { orgId: org.id, dealId: deals[n.dealIdx].id, authorUserId: user.id, body: n.body } });

  // 8) Synced emails (fictional — for the /emails screen, so no real Gmail data is shown)
  const PERSON = (co, p = 0) => companies[co].people[p];
  const emailDefs = [
    { co: 0, p: 0, deal: 0, dir: 'in',  thread: 't1', subj: 'Re: Annual platform license', snip: 'Thanks for the proposal — legal is reviewing the MSA and we should have feedback by Friday.', d: -1 },
    { co: 0, p: 0, deal: 0, dir: 'out', thread: 't1', subj: 'Re: Annual platform license', snip: 'Perfect. Happy to jump on a quick call if any clauses need clarifying — just say the word.', d: -1 },
    { co: 1, p: 0, deal: 2, dir: 'in',  thread: 't2', subj: 'Fleet automation rollout — next steps', snip: 'Budget got approved for Q2. Could you send over the seat-count options so we can plan?', d: -2 },
    { co: 2, p: 0, deal: 3, dir: 'in',  thread: 't3', subj: 'Content workflow subscription', snip: 'The team loved the demo. What does onboarding look like for 15 users?', d: -3 },
    { co: 4, p: 0, deal: 6, dir: 'in',  thread: 't4', subj: 'Re: Enterprise rollout (50 seats)', snip: 'Grace here — we’d love an integration demo with our data warehouse next week. Tuesday?', d: -4 },
    { co: 5, p: 0, deal: 8, dir: 'out', thread: 't5', subj: 'Logistics dashboard pilot — plan', snip: 'Sharing the pilot plan and timeline. Let me know if the milestones work on your end.', d: -5 },
    { co: 3, p: 0, deal: 10, dir: 'in', thread: 't6', subj: 'Security & compliance package', snip: 'Signed and sent! Looking forward to getting started — who will be our point of contact?', d: -6 },
    { co: 0, p: 1, deal: 1, dir: 'in',  thread: 't7', subj: 'Onboarding & training package', snip: 'Marcus from procurement — could you send the W-9 and a formal order form?', d: -8 },
    { co: 1, p: 0, deal: 9, dir: 'out', thread: 't8', subj: 'Renewal — robotics suite', snip: 'Here are the renewal terms for next year. Want to find 20 minutes to review together?', d: -10 },
  ];
  let mi = 0;
  for (const e of emailDefs) {
    mi += 1;
    const person = PERSON(e.co, e.p);
    const contactEmail = person.emails[0];
    await prisma.message.create({
      data: {
        orgId: org.id, userId: user.id, direction: e.dir,
        providerMessageId: `demo-msg-${mi}`, threadId: e.thread,
        fromAddress: e.dir === 'in' ? contactEmail : DEMO_EMAIL,
        toAddresses: e.dir === 'in' ? [DEMO_EMAIL] : [contactEmail],
        subject: e.subj, snippet: e.snip,
        folder: e.dir === 'in' ? 'inbox' : 'sent',
        labels: e.dir === 'in' ? ['INBOX'] : ['SENT'],
        personId: person.id, dealId: deals[e.deal].id,
        sentAt: at(e.d, 9 + (mi % 7)),
      },
    });
  }

  const open = deals.filter((d) => d.status === 'open').length;
  const won = deals.filter((d) => d.status === 'won').length;
  console.log(`✅ Demo org seeded: ${companies.length} companies, ${companies.reduce((s, c) => s + c.people.length, 0)} people, ${deals.length} deals (${open} open / ${won} won), ${activities.length} activities, ${notes.length} notes, ${emailDefs.length} emails.`);
  console.log(`   Login:  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
