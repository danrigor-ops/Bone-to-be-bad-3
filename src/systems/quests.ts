import { CONTENT, itemName } from '../core/content';
import type { GameState, JobProgress, Reward } from '../core/types';
import { addItems, claimKey } from './economy';

export function initialQuestState(): Record<string, JobProgress> {
  const q: Record<string, JobProgress> = {};
  for (const j of CONTENT.raw.jobs) q[j.id] = { status: j.requires.length ? 'locked' : 'available', done: [] };
  return q;
}

export function jobStatus(s: GameState, jobId: string) {
  return s.questState[jobId]?.status ?? 'locked';
}

export function currentObjective(s: GameState, jobId: string): string | null {
  const q = s.questState[jobId];
  if (!q || q.status !== 'active') return null;
  const job = CONTENT.jobs.get(jobId)!;
  return job.objectives.find((o) => !q.done.includes(o)) ?? null;
}

export function isCurrent(s: GameState, jobId: string, objective: string): boolean {
  return currentObjective(s, jobId) === objective;
}

export function objectiveDone(s: GameState, jobId: string, objective: string): boolean {
  return s.questState[jobId]?.done.includes(objective) ?? false;
}

/** Marks an objective done only if it is the current one (keeps order deterministic). */
export function completeObjective(s: GameState, jobId: string, objective: string): boolean {
  if (!isCurrent(s, jobId, objective)) return false;
  s.questState[jobId].done.push(objective);
  return true;
}

export function acceptJob(s: GameState, jobId: string): boolean {
  const q = s.questState[jobId];
  if (!q || q.status !== 'available') return false;
  q.status = 'active';
  q.done = ['accept'];
  return true;
}

export function activeJob(s: GameState): string | null {
  for (const j of CONTENT.raw.jobs) if (s.questState[j.id]?.status === 'active') return j.id;
  return null;
}

export function rewardText(r: Reward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${r.gold} gold`);
  for (const [k, v] of Object.entries(r.items)) parts.push(`${v}× ${itemName(k)}`);
  return parts.join(', ');
}

/**
 * Claims the job's guaranteed reward exactly once (key `job_id:completion`),
 * marks it complete and applies unlocks. Returns reward text or null if already claimed / not ready.
 */
export function claimJob(s: GameState, jobId: string): string | null {
  const job = CONTENT.jobs.get(jobId)!;
  const key = `${jobId}:completion`;
  if (s.claimedRewards.includes(key)) return null;
  if (!isCurrent(s, jobId, 'report_bureau')) return null;
  s.questState[jobId].done.push('report_bureau');
  s.questState[jobId].status = 'complete';
  claimKey(s, key);
  s.inventory.gold += job.reward.gold;
  addItems(s, job.reward.items);
  for (const u of job.unlocks) {
    if (u === 'workshop') s.flags.workshop_open = true;
    else if (u === 'salvage') s.flags.salvage_open = true;
    else if (u === 'cellar_key_flag') s.flags.cellar_key = true;
    else if (u === 'slice_complete') s.flags.slice_complete = true;
    else if (CONTENT.jobs.has(u)) {
      const target = CONTENT.jobs.get(u)!;
      if (target.requires.every((r) => s.questState[r]?.status === 'complete') && s.questState[u].status === 'locked') {
        s.questState[u].status = 'available';
      }
    }
  }
  return rewardText(job.reward);
}

export const OBJECTIVE_TEXT: Record<string, Record<string, string>> = {
  job001: {
    accept: 'Accept job 001 at the Bureau desk.',
    talk_mayor: 'Visit Mayor Pell in Dregswell village.',
    talk_foreman: 'Talk to foreman Ribbs in the Mill Yard (east of the village).',
    inspect_ledger: 'Inspect the wage ledger beside the winch.',
    win_enforcers: 'Confront the debt-collecting enforcers in the Mill Yard.',
    choose_resolution: 'Decide how the dispute is settled.',
    report_bureau: 'Report to the Bureau desk for payment.',
  },
  job002: {
    accept: 'Accept job 002 at the Bureau desk.',
    inspect_noticeboard: 'Inspect the noticeboard in Dregswell.',
    talk_foreman: 'Ask Ribbs about the invoices in the Mill Yard.',
    inspect_crate: 'Inspect the delivery crate in the Mill Yard.',
    win_invoices: 'Defeat the Invoice Harpies (inspect the crate again).',
    choose_evidence: 'Decide what to do with the forged invoices.',
    report_bureau: 'Report to the Bureau desk.',
  },
  job003: {
    accept: 'Accept job 003 at the Bureau desk.',
    enter_cellar: 'Unlock the Ledger Cellar door in the Mill Yard.',
    win_cellar_entry: 'Get past the Debt Minotaur in the cellar entry.',
    collect_correspondence: 'Search the archive desk for correspondence.',
    win_boss: 'Defeat the Foreclosure Hydra in the archive.',
    closing_response: 'Say your piece.',
    report_bureau: 'Return to the Bureau desk.',
  },
};

export function objectiveText(s: GameState): string {
  const j = activeJob(s);
  if (j) {
    const o = currentObjective(s, j);
    if (o) return `Job ${j.slice(3)}: ${OBJECTIVE_TEXT[j]?.[o] ?? o}`;
  }
  for (const job of CONTENT.raw.jobs) {
    if (s.questState[job.id]?.status === 'available') return `New job at the Bureau desk: ${job.name}.`;
  }
  if (s.flags.slice_complete) return 'End of prototype. Free roam, salvage and crafting remain open.';
  return 'Explore Grimwald.';
}
