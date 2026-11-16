// Authored dialogue graph, interaction routing and encounter hooks.
import type { GameState } from '../core/types';
import { currentObjective, isCurrent, jobStatus, objectiveDone } from '../systems/quests';

export type Speaker =
  | '' | '#404' | 'Grib' | 'Brugg' | 'Hexa' | 'Pell' | 'Ribbs' | 'Marn' | 'Mott'
  | 'Worker' | 'Villager' | 'Debt Collector' | 'Engine' | 'Clerk';

export interface Line { s: Speaker | string; t: string }

export type Effect =
  | { objective: string } // "job001:talk_mayor"
  | { accept: string }
  | { flag: string; value: string | boolean }
  | { battle: string }
  | { claim: string }
  | { rest: true }
  | { panel: 'shop' | 'workshop'; shop?: string }
  | { startSalvage: true }
  | { chest: true }
  | { summary: string }
  | { journal: string };

export interface Choice {
  label: string;
  preview?: string;
  confirm?: boolean;
  effects?: Effect[];
  next?: string;
}

export interface DialogueNode {
  id: string;
  lines: Line[];
  choices?: Choice[];
  effects?: Effect[];
  next?: string;
}

const N: DialogueNode[] = [
  // ---------- Opening ----------
  {
    id: 'intro',
    lines: [
      { s: '', t: 'The Unfinished Business Bureau. Day one. The rent notice on the desk is already printed in red.' },
      { s: 'Hexa', t: 'Our first client has described this as a minor labour disagreement.' },
      { s: '#404', t: 'Excellent. Nothing terrible has ever followed those words.' },
      { s: 'Grib', t: 'Did they pay the consultation fee?' },
      { s: 'Brugg', t: 'Maybe we should hear them first.' },
      { s: 'Hexa', t: 'The job is pinned to the desk. Procedure dictates that we read it before we panic.' },
      { s: '#404', t: 'I have never once panicked in the correct order.' },
    ],
    effects: [{ summary: 'The Bureau has opened. Read the first job at the desk.' }],
  },

  // ---------- Bureau desk ----------
  {
    id: 'desk_job001_offer',
    lines: [
      { s: '', t: 'JOB 001 — The Dead Refuse to Work. Client: Mayor Pell of Dregswell. “The skeleton workers at the mill have stopped. Please make them start again. Payment on completion.”' },
      { s: 'Hexa', t: '“Payment on completion.” I’ve underlined it twice.' },
      { s: '#404', t: 'Skeletons refusing to work. I can’t imagine where they got the idea.' },
    ],
    choices: [
      { label: 'Accept job 001', effects: [{ accept: 'job001' }, { summary: 'Accepted job 001. Visit Mayor Pell in Dregswell.' }], next: 'desk_job001_accepted' },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'desk_job001_accepted',
    lines: [
      { s: 'Hexa', t: 'Mayor Pell is in Dregswell, just outside the door. Try to look employable.' },
      { s: 'Grib', t: 'I always look employable. It’s a gift.' },
    ],
  },
  {
    id: 'desk_busy',
    lines: [{ s: 'Hexa', t: 'We have an open job: {objective} I wrote it in the journal, in case anyone forgot. Someone always forgets.' }],
  },
  {
    id: 'desk_job001_report',
    lines: [
      { s: 'Hexa', t: 'Mayor Pell has paid. In full. I counted twice.' },
      { s: '{branch001}', t: '{branch001_line}' },
      { s: 'Grib', t: 'Seventy gold! And a crate of… what is this, a rusted blade?' },
      { s: 'Brugg', t: 'The workers sent things for the workshop. They said thank you.' },
      { s: '#404', t: 'Nobody’s thanked me since… ever, actually. I’m going to need a minute.' },
      { s: 'Hexa', t: 'You may have thirty seconds. Marn is opening the workshop.' },
      { s: 'Hexa', t: 'One more thing. Those debt deductions were forged. Someone wanted that dispute to happen. I’ve opened a file.' },
    ],
    effects: [{ claim: 'job001' }, { summary: 'Job 001 complete. The workshop is open, and salvage runs are available in the Mill Yard.' }, { journal: 'Job 001 complete: {resolution_name}. The forged debt suggests someone engineered the strike.' }],
    next: 'reward_job001',
  },
  {
    id: 'reward_job001',
    lines: [{ s: '', t: 'JOB 001 COMPLETE. Reward: 70 gold, 6 Scrap Iron, 3 Bone Chip, Rusted Blade, 2 Haunted Paperwork, Foreman’s Badge, 2 Bone Poultice. Workshop unlocked. Repeat Salvage unlocked in the Mill Yard.' }],
  },
  {
    id: 'desk_job002_offer',
    lines: [
      { s: '', t: 'JOB 002 — A Receipt for Disaster. Client: Ribbs, Foreman. “We’re being billed for work we never ordered. Twice.”' },
      { s: 'Grib', t: 'Duplicate invoices. Professionally, I’m impressed.' },
      { s: 'Hexa', t: 'Start at the Dregswell noticeboard. The village posts its paid invoices there.' },
    ],
    choices: [
      { label: 'Accept job 002', effects: [{ accept: 'job002' }, { summary: 'Accepted job 002. Check the Dregswell noticeboard.' }] },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'desk_job002_report',
    lines: [
      { s: 'Hexa', t: 'Every forged invoice carries the same cracked-ring seal. And this was taped to the last one.' },
      { s: '', t: 'A heavy iron key, labelled “LEDGER CELLAR — DO NOT”. The rest of the label has been torn off.' },
      { s: '#404', t: 'Someone mailed us the key to their own basement. That’s either a trap or terrible admin.' },
      { s: 'Grib', t: 'Why not both?' },
      { s: 'Brugg', t: '{evidence_line}' },
    ],
    effects: [{ claim: 'job002' }, { summary: 'Job 002 complete. The Cellar Key opens the door in the Mill Yard.' }, { journal: 'Job 002 complete: evidence {evidence_name}. Cellar Key obtained.' }],
    next: 'reward_job002',
  },
  {
    id: 'reward_job002',
    lines: [{ s: '', t: 'JOB 002 COMPLETE. Reward: 60 gold, 4 Ghost Thread, Worn Ceremonial Cloth, 2 Haunted Paperwork, 2 Small Ether. Cellar Key obtained (key item). New workshop recipes unlocked.' }],
  },
  {
    id: 'desk_job003_offer',
    lines: [
      { s: '', t: 'JOB 003 — Terms and Conditions Apply. Client: the Bureau. (Hexa has signed the client box and the contractor box.)' },
      { s: 'Hexa', t: 'I’ve hired us. Pro bono. We find whoever is manufacturing these crises.' },
      { s: 'Brugg', t: 'Cellars are dark. I’ll go first.' },
      { s: '#404', t: 'Fine. But if it turns out to be a dungeon, I’m billing someone.' },
    ],
    choices: [
      { label: 'Accept job 003', effects: [{ accept: 'job003' }, { summary: 'Accepted job 003. Unlock the Ledger Cellar in the Mill Yard.' }] },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'desk_job003_report',
    lines: [
      { s: 'Hexa', t: 'The Foreclosure Engine is scrap. The letters are filed. The seal is… still unexplained.' },
      { s: 'Grib', t: 'Ninety gold, though. Somebody’s been paying the Engine’s maintenance fund and it’s ours now.' },
      { s: 'Brugg', t: 'Dregswell gets to keep its choices. That’s the real pay.' },
      { s: '#404', t: 'Someone out there is paying people to be afraid of being free. I’d like to meet them. Briefly. Professionally.' },
      { s: 'Hexa', t: 'Then we keep the Bureau open. Procedure.' },
    ],
    effects: [{ claim: 'job003' }, { summary: 'Slice complete. Free roam, crafting and salvage remain open.' }, { journal: 'Job 003 complete. The broker’s cracked-ring seal remains unresolved. END OF PROTOTYPE.' }],
    next: 'recap',
  },
  {
    id: 'recap',
    lines: [
      { s: '', t: 'RECAP — Dregswell: {resolution_name}. Evidence: {evidence_name}. New recipe: Questionable Warranty Ring. An unresolved cracked-ring seal points to someone paying for crises.' },
      { s: '', t: 'END OF PROTOTYPE. This is the end of the Bone to Be Bad III vertical slice. The village keeps your changes; you can keep exploring, crafting and running salvage. The wider campaign is not in this build.' },
    ],
  },
  {
    id: 'desk_done',
    lines: [
      { s: 'Hexa', t: 'No open jobs. The cracked-ring seal is still on my desk, though. Looking at me.' },
      { s: '', t: 'End of prototype: free roam, crafting and repeat salvage are still available.' },
    ],
  },
  {
    id: 'rent_notice',
    lines: [{ s: '', t: 'RENT NOTICE: “Payment due on the first of the month. Late fees compound hourly. — Grimwald Lettings (formerly The Dark Lord’s Property Division).”' }],
  },

  // ---------- Workshop / bench / misc bureau ----------
  {
    id: 'marn_closed',
    lines: [
      { s: 'Marn', t: 'Workshop’s not open yet. I’ve got rivets and opinions, but no materials.' },
      { s: 'Marn', t: 'Bring me something from a real job and I’ll make you something worth wearing.' },
    ],
  },
  {
    id: 'marn_intro',
    lines: [
      { s: 'Marn', t: 'Forge is hot. That rusted blade from the mill? Give me some paperwork and twenty gold and I’ll make #404 a Grievance Cleaver.' },
      { s: 'Marn', t: 'It bites harder on cursed targets. Suggestion only. Starter kit will do the job if you’re careful.' },
    ],
    effects: [{ flag: 'marn_intro', value: true }, { panel: 'workshop' }],
  },
  { id: 'marn_open', lines: [{ s: 'Marn', t: 'What are we making?' }], effects: [{ panel: 'workshop' }] },
  { id: 'anvil', lines: [{ s: '', t: 'An anvil with “MARN’S. ASK FIRST.” chalked on it.' }] },
  {
    id: 'bench',
    lines: [{ s: '', t: 'A lumpy bench. Resting here restores everyone’s HP and MP. It costs nothing.' }],
    choices: [
      { label: 'Rest', effects: [{ rest: true }], next: 'bench_rested' },
      { label: 'Not now' },
    ],
  },
  { id: 'bench_rested', lines: [{ s: 'Brugg', t: 'That was a good sit.' }, { s: '', t: 'HP and MP fully restored.' }] },
  { id: 'plant', lines: [{ s: '#404', t: 'The only employee who has never complained. Also the only one who isn’t paid.' }] },
  {
    id: 'sealed_letters',
    lines: [
      { s: '', t: 'Copies of every forged invoice, pinned with red string to a map of Grimwald. The cracked-ring seal sits in the middle of it all.' },
      { s: 'Hexa', t: 'The string is procedurally correct. That’s all I’ll say.' },
    ],
  },

  // ---------- Village ----------
  {
    id: 'pell_idle0',
    lines: [{ s: 'Pell', t: 'Oh! Are you the Bureau? The mill’s stopped and the village is panicking. Politely. Please read my job at your desk.' }],
  },
  {
    id: 'pell_job001',
    lines: [
      { s: 'Pell', t: 'Thank you for coming. The skeleton workers have downed tools. Forty years without a complaint, and now this.' },
      { s: '#404', t: 'Forty years. Without a break, I assume?' },
      { s: 'Pell', t: 'Breaks were never… scheduled. They were labelled “workers”. Workers work. That was how it went.' },
      { s: 'Brugg', t: 'And now the labels are gone.' },
      { s: 'Pell', t: 'Exactly! And I can’t afford for the mill to stop. The whole village lives on that flour. Please talk to Ribbs, the foreman, in the Mill Yard. It’s east of here.' },
    ],
    effects: [{ objective: 'job001:talk_mayor' }, { summary: 'Pell asked you to talk to foreman Ribbs in the Mill Yard.' }],
  },
  { id: 'pell_wait', lines: [{ s: 'Pell', t: 'Ribbs is in the Mill Yard, east of here. Please be quick. And kind, if you can manage both.' }] },
  {
    id: 'pell_charter',
    lines: [
      { s: 'Pell', t: 'The workers run their own salvage counter now. Shorter shifts. I’m told it’s “sustainable”.' },
      { s: 'Pell', t: 'My supply stall stays shut. We can’t afford both, and honestly, they earned the counter.' },
    ],
    next: 'pell_tail',
  },
  {
    id: 'pell_compact',
    lines: [
      { s: 'Pell', t: 'We paid the settlement, hired relief workers, and I’ve reopened my supply stall. Healing is cheaper for everyone.' },
      { s: 'Pell', t: 'The village budget is crying. Quietly. With dignity.' },
    ],
    next: 'pell_tail',
  },
  { id: 'pell_unresolved', lines: [{ s: 'Pell', t: 'Have you spoken to Ribbs? Whatever you decide, please let the workers rest. I’m embarrassed it took this long.' }] },
  { id: 'pell_tail', lines: [{ s: 'Pell', t: '{pell_tail}' }] },
  {
    id: 'notice_idle',
    lines: [{ s: '', t: 'LOST CAT: answers to “Labels Were A Construct”. CHOIR PRACTICE: cancelled. UNFINISHED BUSINESS BUREAU: now open. (We put that one up.)' }],
  },
  {
    id: 'notice_job002',
    lines: [
      { s: '', t: 'Pinned over the lost-cat posters: three invoices for “Mill Disruption Services Rendered”. All identical. All paid.' },
      { s: 'Hexa', t: 'Paid by the village. Charged again to the mill. Every one of them twice.' },
      { s: 'Grib', t: 'Someone’s billing both sides of a fight they started. That’s… honestly, that’s genius.' },
      { s: 'Brugg', t: 'It’s mean, Grib.' },
      { s: 'Grib', t: 'It’s mean genius.' },
    ],
    effects: [{ objective: 'job002:inspect_noticeboard' }, { summary: 'Duplicate invoices found. Ask Ribbs about them in the Mill Yard.' }],
  },
  { id: 'stall_closed', lines: [{ s: '', t: 'A shuttered stall. The sign reads: “Closed until the mill situation is resolved.”' }] },
  { id: 'stall_closed_charter', lines: [{ s: '', t: 'Still shuttered. A newer sign: “Closed. Budget went to the Rest Charter. Cheerfully, mostly.”' }] },
  { id: 'stall_open', lines: [{ s: 'Clerk', t: 'Supply stall’s open again! Healing supplies twenty percent off, courtesy of the Village Compact.' }], effects: [{ panel: 'shop', shop: 'stall' }] },
  { id: 'mott', lines: [{ s: 'Mott', t: 'Mott’s Barrow! Full price, full honesty. No refunds, no selling, no exceptions.' }], effects: [{ panel: 'shop', shop: 'mott' }] },
  { id: 'counter', lines: [{ s: 'Worker', t: 'Worker-run salvage counter. Materials twenty percent off. Our prices, our hours.' }], effects: [{ panel: 'shop', shop: 'counter' }] },
  { id: 'relief', lines: [{ s: 'Worker', t: 'Relief crew. We take the night shift so the old crew can sleep. Well. Lie still with intent.' }] },
  { id: 'resting', lines: [{ s: 'Worker', t: 'Sitting down on purpose. Still getting used to it. My spine keeps asking what it did wrong.' }] },
  {
    id: 'crowd',
    lines: [
      { s: 'Villager', t: 'Forty years of invoices! Who’s been charging us?' },
      { s: 'Villager', t: 'The mill! No — someone pretending to be the mill!' },
      { s: '#404', t: 'Democracy. Loud, but it’s a start.' },
    ],
  },
  { id: 'crowd_after', lines: [{ s: 'Villager', t: 'We’ve formed a committee. It has a sub-committee about the committee. We are thriving.' }] },
  { id: 'well', lines: [{ s: '', t: 'A village well. Someone has dropped a “WORKER OF THE MONTH” badge down it.' }] },

  // ---------- Mill Yard ----------
  { id: 'ribbs_idle0', lines: [{ s: 'Ribbs', t: 'We’re on strike. Politely. If the mayor sent for someone, then send them.' }] },
  {
    id: 'ribbs_job001',
    lines: [
      { s: 'Ribbs', t: 'You’re the Bureau? Good. I’m Ribbs. Foreman. Forty years in this yard.' },
      { s: '#404', t: 'Fellow skeleton. What happened?' },
      { s: 'Ribbs', t: 'No rest. Ever. Not scheduled, not allowed. We used not to mind. We used not to mind anything.' },
      { s: 'Ribbs', t: 'Then the labels came off, and one morning old Doll from the sack line just… sat down. Then all of us did.' },
      { s: 'Brugg', t: 'That sounds like being tired for a very long time.' },
      { s: 'Ribbs', t: 'Now men in grey coats keep coming with an order saying we owe the mill our wages. Look at the ledger by the winch if you don’t believe me.' },
    ],
    effects: [{ objective: 'job001:talk_foreman' }, { summary: 'Ribbs says the workers never had rest. Inspect the ledger by the winch.' }],
  },
  { id: 'ribbs_wait', lines: [{ s: 'Ribbs', t: 'The ledger’s by the winch. Mind the enforcers. They bite. Metaphorically. Mostly.' }] },
  { id: 'ribbs_after_fight', lines: [{ s: 'Ribbs', t: 'They’re gone for now. Talk it through with your Bureau and tell me what we’re doing.' }] },
  { id: 'ribbs_charter', lines: [{ s: 'Ribbs', t: 'Shifts end at sundown now. We run the salvage counter in the village. Materials at a fair price. Come by.' }] },
  { id: 'ribbs_compact', lines: [{ s: 'Ribbs', t: 'The relief crew takes nights. I sat on a bench yesterday for a whole hour. Didn’t know what to do with my hands.' }] },
  {
    id: 'ribbs_job002',
    lines: [
      { s: 'Ribbs', t: 'Invoices. For “Mill Disruption Services”. Delivered here, addressed to us, payable to someone else.' },
      { s: 'Hexa', t: 'Who is the payee?' },
      { s: 'Ribbs', t: 'Just a seal. A ring with a crack through it. They come in the morning delivery. Check the crate by the east wall.' },
    ],
    effects: [{ objective: 'job002:talk_foreman' }, { summary: 'Ribbs pointed you to the sealed delivery crate by the east wall.' }],
  },
  { id: 'ribbs_job002_wait', lines: [{ s: 'Ribbs', t: 'The delivery crate’s by the east wall. It rustles. I don’t like it.' }] },
  { id: 'ribbs_job003', lines: [{ s: 'Ribbs', t: 'Whoever stirred us up, they didn’t count on us deciding things for ourselves.' }] },
  {
    id: 'ledger_early',
    lines: [{ s: '', t: 'A thick wage ledger, chained to the winch. You should hear the workers’ side before reading the mill’s.' }],
  },
  {
    id: 'ledger_job001',
    lines: [
      { s: '', t: 'The wage ledger. Column after column: “Debt deduction — rest owed to the mill.”' },
      { s: 'Hexa', t: 'These deductions are dated last month. In ink that is still wet.' },
      { s: 'Grib', t: 'And the handwriting changes halfway down. Amateur.' },
      { s: '#404', t: 'So somebody invented a debt to keep them working. Or to make sure they’d stop.' },
      { s: 'Hexa', t: 'Either way, the shortage is engineered. Someone wanted this fight.' },
      { s: '', t: 'The grey-coated enforcers have noticed you. (Their patrol is marked in the yard.)' },
    ],
    effects: [{ objective: 'job001:inspect_ledger' }, { summary: 'You found forged debts. Confront the enforcers in the yard.' }],
  },
  { id: 'ledger_after', lines: [{ s: '', t: 'The forged deductions are circled in Hexa’s red pencil.' }] },
  {
    id: 'enforcer_early',
    lines: [
      { s: 'Debt Collector', t: 'Move along. This is a lawful debt collection.' },
      { s: '#404', t: 'We’ll be back once we know what that means.' },
    ],
  },
  {
    id: 'enforcer_fight',
    lines: [
      { s: 'Debt Collector', t: 'By order of the attached document, these workers owe forty years of rest to the mill.' },
      { s: 'Hexa', t: 'That document is forged. I can see the eraser marks from here.' },
      { s: 'Debt Collector', t: 'Then we’ll collect from you instead.' },
      { s: 'Brugg', t: 'Leave the workers out of it.' },
    ],
    choices: [
      { label: 'Fight the enforcers', effects: [{ battle: 'yard_enforcers' }] },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'job001_choice',
    lines: [
      { s: 'Ribbs', t: 'They’re gone. For now. Bureau… what do we do? The mayor can’t pay for us to stop, and we can’t go back to never stopping.' },
      { s: 'Hexa', t: 'There are two workable settlements. I’ve drafted both. Please note the costs.' },
    ],
    choices: [
      {
        label: 'Rest Charter', confirm: true,
        preview: 'Workers get shorter shifts and run a salvage counter in Dregswell, with crafting materials 20% off. Cost: the mayor’s supply stall stays closed.',
        effects: [{ flag: 'labor_resolution', value: 'charter' }, { objective: 'job001:choose_resolution' }, { summary: 'Rest Charter signed. Report to the Bureau desk.' }],
        next: 'job001_chose_charter',
      },
      {
        label: 'Village Compact', confirm: true,
        preview: 'The village pays a settlement and hires relief workers, and the supply stall reopens with healing items 20% off. Workers still get scheduled rest. Cost: no salvage counter.',
        effects: [{ flag: 'labor_resolution', value: 'compact' }, { objective: 'job001:choose_resolution' }, { summary: 'Village Compact agreed. Report to the Bureau desk.' }],
        next: 'job001_chose_compact',
      },
    ],
  },
  {
    id: 'job001_chose_charter',
    lines: [
      { s: 'Ribbs', t: 'A charter. Our own hours. Our own counter.' },
      { s: '#404', t: 'Congratulations. You’ve invented weekends.' },
      { s: 'Brugg', t: 'They’re sitting down. Look. On purpose.' },
    ],
  },
  {
    id: 'job001_chose_compact',
    lines: [
      { s: 'Pell', t: '(Arriving, out of breath.) The village will pay. We should have paid a long time ago.' },
      { s: 'Ribbs', t: 'Relief workers and scheduled rest. I’ll take it.' },
      { s: 'Grib', t: 'And the stall reopens! Commerce lives!' },
    ],
  },
  { id: 'winch', lines: [{ s: '', t: 'The great winch, jammed with a cracked gear. Nobody’s been allowed to fix it. Fixing it isn’t anyone’s job.' }] },
  { id: 'signs', lines: [{ s: '', t: 'Painted signs: “REST IS NOT A DEBT”. “WE ARE NOT LAZY, WE ARE DEAD AND TIRED.”' }] },
  { id: 'strikers', lines: [{ s: 'Worker', t: 'We’re not lazy. We’re just… done. For a bit. Is that allowed now?' }] },
  { id: 'crate_idle', lines: [{ s: '', t: 'A delivery crate stamped with a cracked-ring seal. Flour sacks, aggressively ordinary. For now.' }] },
  {
    id: 'crate_job002',
    lines: [
      { s: '', t: 'You pry the crate open. Inside: more invoices, all with the cracked-ring seal. They rustle. Then they rise.' },
      { s: '#404', t: 'Ah. The paperwork is alive. Of course it is.' },
    ],
    effects: [{ objective: 'job002:inspect_crate' }],
    choices: [
      { label: 'Fight the Invoice Swarm', effects: [{ battle: 'invoice_swarm' }] },
      { label: 'Back away (fight later)' },
    ],
  },
  {
    id: 'crate_fight',
    lines: [{ s: '', t: 'The Invoice Swarm hovers over the crate, stamping the air.' }],
    choices: [
      { label: 'Fight the Invoice Swarm', effects: [{ battle: 'invoice_swarm' }] },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'job002_choice',
    lines: [
      { s: 'Hexa', t: 'We have the forged invoices. Two procedures are available.' },
      { s: 'Grib', t: 'Option three: sell them. No? Fine.' },
    ],
    choices: [
      {
        label: 'Make them public', confirm: true,
        preview: 'Post the forgeries in Dregswell. An angry crowd gathers in the village, and whoever is in the cellar will know you’re coming. No stat bonus either way.',
        effects: [{ flag: 'evidence_handling', value: 'public' }, { objective: 'job002:choose_evidence' }, { summary: 'You made the forgeries public. Report to the Bureau.' }],
        next: 'job002_chose_public',
      },
      {
        label: 'Trace the sender', confirm: true,
        preview: 'Keep copies and follow the seal quietly. Sealed correspondence goes up at the Bureau, and the cellar won’t expect you. No stat bonus either way.',
        effects: [{ flag: 'evidence_handling', value: 'trace' }, { objective: 'job002:choose_evidence' }, { summary: 'You kept the evidence to trace the sender. Report to the Bureau.' }],
        next: 'job002_chose_trace',
      },
    ],
  },
  { id: 'job002_chose_public', lines: [{ s: 'Brugg', t: 'People deserve to know who’s been charging them.' }, { s: '#404', t: 'And now they’ll shout about it. Healthy.' }] },
  { id: 'job002_chose_trace', lines: [{ s: 'Hexa', t: 'I’ll need red string. A great deal of red string.' }, { s: 'Grib', t: 'I know a guy.' }] },
  {
    id: 'salvage_locked',
    lines: [{ s: '', t: 'A heap of rusted machine parts. Rust Mites nest in it. (Repeat Salvage opens after job 001.)' }],
  },
  {
    id: 'salvage_pile',
    lines: [{ s: '', t: 'REPEAT SALVAGE (optional, repeatable): stir the pile to lure out one Rust Mite. Reward: 2 Scrap Iron and 1 Bone Chip. No gold or XP.' }],
    choices: [
      { label: 'Repeat salvage', effects: [{ startSalvage: true }] },
      { label: 'Leave it' },
    ],
  },
  { id: 'salvage_busy', lines: [{ s: '', t: 'A Rust Mite is already out of the pile, right next to it. Deal with that one first.' }] },
  {
    id: 'salvage_mite',
    lines: [{ s: '', t: 'A Rust Mite clicks at you, offended by your iron content.' }],
    choices: [
      { label: 'Fight (salvage run)', effects: [{ battle: 'salvage' }] },
      { label: 'Not yet' },
    ],
  },

  // ---------- Cellar ----------
  {
    id: 'cellar_enter',
    lines: [
      { s: '', t: 'The Ledger Cellar. Shelves of paperwork breathe softly in the dark.' },
      { s: 'Brugg', t: 'I said I’d go first. I’m going first.' },
    ],
    effects: [{ objective: 'job003:enter_cellar' }, { summary: 'You entered the Ledger Cellar. Get past the Debt Collector.' }],
  },
  {
    id: 'cellar_collector',
    lines: [
      { s: 'Debt Collector', t: 'Restricted archive. Debts beyond this point.' },
      { s: 'Brugg', t: 'We’re just going to look.' },
      { s: 'Debt Collector', t: 'Looking is billable.' },
    ],
    choices: [
      { label: 'Fight', effects: [{ battle: 'cellar_entry' }] },
      { label: 'Not yet' },
    ],
  },
  { id: 'cellar_sign', lines: [{ s: '', t: 'A signpost: → STORE (optional, smells of rust). ↓ ARCHIVE (mandatory, smells of trouble).' }] },
  {
    id: 'store_mite',
    lines: [{ s: '', t: 'A Rust Mite is gnawing on an old chest’s lock. Optional. It looks smug.' }],
    choices: [
      { label: 'Fight the Rust Mite', effects: [{ battle: 'cellar_optional' }] },
      { label: 'Leave it' },
    ],
  },
  { id: 'chest_guarded', lines: [{ s: '', t: 'The Rust Mite is in the way of the chest.' }] },
  {
    id: 'chest',
    lines: [{ s: '', t: 'The chest creaks open. Inside: 3 Scrap Iron, 1 Ghost Thread, 1 Bone Poultice.' }],
    effects: [{ chest: true }],
  },
  { id: 'chest_empty', lines: [{ s: '', t: 'An empty chest. Grib checks it twice anyway.' }] },
  {
    id: 'archive_desk',
    lines: [
      { s: '', t: 'A desk buried in letters. One is still warm.' },
      { s: 'Hexa', t: '“Payment received for Dregswell disruption. Phase two: the Mill Yard. Phase three: make them ask for the old roles back.” Signed with the cracked-ring seal.' },
      { s: '#404', t: 'Someone’s paying to make people miserable enough to want their labels back.' },
      { s: 'Brugg', t: '…That’s the saddest thing I’ve ever read.' },
      { s: 'Grib', t: 'And they didn’t even itemise.' },
      { s: '', t: 'Obtained: Brokered Correspondence (key item, cannot be sold).' },
    ],
    effects: [{ flag: 'correspondence', value: true }, { objective: 'job003:collect_correspondence' }, { summary: 'You found the broker’s correspondence. The Foreclosure Engine stirs.' }],
  },
  { id: 'archive_desk_after', lines: [{ s: '', t: 'The rest of the letters are invoices for fear, itemised at last.' }] },
  { id: 'archive_desk_early', lines: [{ s: '', t: 'A desk buried in letters. You’ll need to be on the job to make sense of them.' }] },
  { id: 'seal_mark', lines: [{ s: '', t: 'A cracked-ring seal, pressed into the wall wax. Whoever owns it is not here.' }] },
  {
    id: 'engine_idle',
    lines: [{ s: '', t: 'A huge machine of ledgers and pistons, idling. It hasn’t noticed you yet. The desk nearby rustles with letters.' }],
  },
  {
    id: 'engine_intro_public',
    lines: [
      { s: 'Engine', t: 'PUBLIC DISCLOSURE DETECTED. REPUTATIONAL DAMAGE ASSESSED. FORECLOSING ON ALL PARTIES.' },
      { s: 'Hexa', t: 'It heard about the crowd.' },
    ],
    next: 'engine_intro_common',
  },
  {
    id: 'engine_intro_trace',
    lines: [
      { s: 'Engine', t: 'UNSCHEDULED VISITORS. NO NOTICE RECEIVED. …WHO SENT YOU?' },
      { s: '#404', t: 'Your employer’s handwriting, mostly.' },
    ],
    next: 'engine_intro_common',
  },
  {
    id: 'engine_intro_common',
    lines: [
      { s: 'Hexa', t: 'Watch its pattern: Audit, Red Stamp, then Repossession, which hits everyone hard. Guard or heal before step three.' },
      { s: 'Brugg', t: 'Everyone behind me.' },
    ],
    choices: [
      { label: 'Fight the Foreclosure Engine', effects: [{ battle: 'foreclosure_boss' }] },
      { label: 'Not yet (prepare first)' },
    ],
  },
  { id: 'engine_wreck', lines: [{ s: '', t: 'The Foreclosure Engine, silent. A stamp still twitches.' }] },
  {
    id: 'job003_closing',
    lines: [
      { s: '', t: 'The Engine shudders and stops. Somewhere a bell rings for a debt that will never be collected.' },
      { s: 'Hexa', t: '#404. Anything to say for the record?' },
    ],
    choices: [
      { label: '“Tell your employer the Bureau is open.”', preview: 'Flavour only. No mechanical effect.', effects: [{ flag: 'closing', value: 'open' }, { objective: 'job003:closing_response' }, { summary: 'Return to the Bureau desk to close job 003.' }], next: 'closing_a' },
      { label: '“Nobody owes anyone their whole life.”', preview: 'Flavour only. No mechanical effect.', effects: [{ flag: 'closing', value: 'owe' }, { objective: 'job003:closing_response' }, { summary: 'Return to the Bureau desk to close job 003.' }], next: 'closing_b' },
    ],
  },
  { id: 'closing_a', lines: [{ s: '#404', t: 'Tell your employer the Bureau is open. Consultation fee applies.' }, { s: 'Grib', t: 'That’s my line!' }] },
  { id: 'closing_b', lines: [{ s: '#404', t: 'Nobody owes anyone their whole life. Not even me.' }, { s: 'Brugg', t: '(quietly) Especially not you.' }] },
];

export const DIALOGUE: Record<string, DialogueNode> = Object.fromEntries(N.map((n) => [n.id, n]));

const resName = (s: GameState) =>
  s.flags.labor_resolution === 'charter' ? 'Rest Charter' : s.flags.labor_resolution === 'compact' ? 'Village Compact' : 'unresolved';
const evName = (s: GameState) =>
  s.flags.evidence_handling === 'public' ? 'made public' : s.flags.evidence_handling === 'trace' ? 'kept to trace the sender' : 'undecided';

export const TOKENS: Record<string, (s: GameState, objectiveText: string) => string> = {
  objective: (_s, o) => o,
  resolution_name: resName,
  evidence_name: evName,
  branch001: (s) => (s.flags.labor_resolution === 'compact' ? 'Grib' : 'Brugg'),
  branch001_line: (s) =>
    s.flags.labor_resolution === 'compact'
      ? 'The stall’s open again. Healing at a discount. I may cry.'
      : 'The workers set up their own salvage counter. They looked proud.',
  evidence_line: (s) =>
    s.flags.evidence_handling === 'public'
      ? 'Dregswell knows now. They’re angry. I think that’s fair.'
      : 'We kept it quiet. I hope whoever it is doesn’t see us coming.',
  pell_tail: (s) => {
    if (s.flags.slice_complete) return 'The Bureau did right by us. Whatever that seal is, Dregswell will decide its own future.';
    if (s.flags.evidence_handling === 'public') return 'And now everyone knows about the forged invoices. There’s been shouting. Healthy shouting, I’m told.';
    if (s.flags.evidence_handling === 'trace') return 'Hexa asked me not to mention the invoices to anyone. So I’m not mentioning them. Very loudly.';
    return 'Thank you, Bureau. Truly.';
  },
};

export function fillTokens(text: string, s: GameState, objectiveText: string): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (TOKENS[k] ? TOKENS[k](s, objectiveText) : m));
}

/** Choose which dialogue node an interaction opens, based on state. */
export function routeInteraction(s: GameState, objectId: string): string | null {
  const r = s.flags.labor_resolution;
  switch (objectId) {
    case 'desk': {
      for (const j of ['job001', 'job002', 'job003'] as const) {
        if (isCurrent(s, j, 'report_bureau')) return `desk_${j}_report`;
      }
      for (const j of ['job001', 'job002', 'job003'] as const) {
        if (jobStatus(s, j) === 'active') return 'desk_busy';
      }
      for (const j of ['job001', 'job002', 'job003'] as const) {
        if (jobStatus(s, j) === 'available') return `desk_${j}_offer`;
      }
      return 'desk_done';
    }
    case 'desk_side': return 'rent_notice';
    case 'marn':
      if (!s.flags.workshop_open) return 'marn_closed';
      return s.flags.marn_intro ? 'marn_open' : 'marn_intro';
    case 'anvil': return s.flags.workshop_open ? 'marn_open' : 'anvil';
    case 'bench': return 'bench';
    case 'plant': return 'plant';
    case 'sealed_letters': return 'sealed_letters';
    case 'pell':
      if (isCurrent(s, 'job001', 'talk_mayor')) return 'pell_job001';
      if (r === 'charter') return 'pell_charter';
      if (r === 'compact') return 'pell_compact';
      if (jobStatus(s, 'job001') === 'active') return objectiveDone(s, 'job001', 'win_enforcers') ? 'pell_unresolved' : 'pell_wait';
      return 'pell_idle0';
    case 'noticeboard':
      return isCurrent(s, 'job002', 'inspect_noticeboard') ? 'notice_job002' : 'notice_idle';
    case 'stall': return r === 'charter' ? 'stall_closed_charter' : 'stall_closed';
    case 'stall_open': return 'stall_open';
    case 'mott': return 'mott';
    case 'counter': return 'counter';
    case 'relief': case 'yard_relief': return 'relief';
    case 'village_bench': case 'yard_bench': case 'yard_bench2': case 'yard_resting': return 'resting';
    case 'crowd': case 'crowd2': return s.flags.slice_complete ? 'crowd_after' : 'crowd';
    case 'well': return 'well';
    case 'ribbs':
      if (isCurrent(s, 'job001', 'talk_foreman')) return 'ribbs_job001';
      if (isCurrent(s, 'job002', 'talk_foreman')) return 'ribbs_job002';
      if (jobStatus(s, 'job002') === 'active' && objectiveDone(s, 'job002', 'talk_foreman') && !objectiveDone(s, 'job002', 'win_invoices')) return 'ribbs_job002_wait';
      if (jobStatus(s, 'job003') !== 'locked' && jobStatus(s, 'job003') !== 'available') return 'ribbs_job003';
      if (r === 'charter') return 'ribbs_charter';
      if (r === 'compact') return 'ribbs_compact';
      if (objectiveDone(s, 'job001', 'win_enforcers')) return 'ribbs_after_fight';
      if (objectiveDone(s, 'job001', 'talk_foreman')) return 'ribbs_wait';
      return 'ribbs_idle0';
    case 'ledger':
      if (isCurrent(s, 'job001', 'inspect_ledger')) return 'ledger_job001';
      if (objectiveDone(s, 'job001', 'inspect_ledger')) return 'ledger_after';
      return 'ledger_early';
    case 'enforcers':
      return isCurrent(s, 'job001', 'win_enforcers') ? 'enforcer_fight' : 'enforcer_early';
    case 'winch': return 'winch';
    case 'signs': return 'signs';
    case 'strikers': case 'strikers2': return 'strikers';
    case 'crate':
      if (isCurrent(s, 'job002', 'inspect_crate')) return 'crate_job002';
      if (isCurrent(s, 'job002', 'win_invoices')) return 'crate_fight';
      return 'crate_idle';
    case 'invoice_marker': return 'crate_fight';
    case 'salvage_pile':
      if (!s.flags.salvage_open) return 'salvage_locked';
      return s.salvageActive ? 'salvage_busy' : 'salvage_pile';
    case 'salvage_mite': return 'salvage_mite';
    case 'cellar_collector': return 'cellar_collector';
    case 'cellar_sign': return 'cellar_sign';
    case 'store_mite': return 'store_mite';
    case 'chest': return s.claimedRewards.includes('encounter:cellar_optional') ? 'chest' : 'chest_guarded';
    case 'chest_open': return 'chest_empty';
    case 'archive_desk':
      if (isCurrent(s, 'job003', 'collect_correspondence')) return 'archive_desk';
      if (s.flags.correspondence) return 'archive_desk_after';
      return 'archive_desk_early';
    case 'seal_mark': return 'seal_mark';
    case 'engine':
      if (!isCurrent(s, 'job003', 'win_boss')) return 'engine_idle';
      return s.flags.evidence_handling === 'public' ? 'engine_intro_public' : 'engine_intro_trace';
    case 'engine_wreck': return 'engine_wreck';
  }
  return null;
}

/** Dialogue started automatically when arriving on a map. */
export function arrivalDialogue(s: GameState, mapId: string): string | null {
  if (mapId === 'cellar_entry' && currentObjective(s, 'job003') === 'enter_cellar') return 'cellar_enter';
  return null;
}

/** After a battle victory is acknowledged. */
export const ENCOUNTER_HOOKS: Record<string, { objective?: string; dialogue?: string }> = {
  yard_enforcers: { objective: 'job001:win_enforcers', dialogue: 'job001_choice' },
  invoice_swarm: { objective: 'job002:win_invoices', dialogue: 'job002_choice' },
  cellar_entry: { objective: 'job003:win_cellar_entry' },
  foreclosure_boss: { objective: 'job003:win_boss', dialogue: 'job003_closing' },
  cellar_optional: {},
  salvage: {},
};
