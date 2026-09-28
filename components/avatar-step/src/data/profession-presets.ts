export interface RoleVariant {
  readonly archetype: string;
  readonly label: string;
  readonly description: string;
}

export interface ProfessionRole {
  readonly role: string;
  readonly variants: readonly RoleVariant[];
}

export const PROFESSION_PRESETS: Record<string, readonly ProfessionRole[]> = {
  Software: [
    { role: 'Architect', variants: [
      { archetype: 'Sage/Mentor', label: 'The knowledge sharer', description: 'Guides team through expertise and experience' },
      { archetype: 'Magician/Engineer', label: 'The systems thinker', description: 'Designs elegant solutions to complex problems' },
    ]},
    { role: 'QA Lead', variants: [
      { archetype: 'Sage/Detective', label: 'The investigator', description: 'Uncovers bugs through systematic analysis' },
      { archetype: 'Sovereign/Judge', label: 'The quality gatekeeper', description: 'Enforces standards and renders pass/fail verdicts' },
    ]},
    { role: 'DevOps Engineer', variants: [
      { archetype: 'Magician/Engineer', label: 'The automation builder', description: 'Builds systems that make deployment seamless' },
      { archetype: 'Explorer/Pioneer', label: 'The trailblazer', description: 'Pushes into new infrastructure territory' },
    ]},
    { role: 'Product Manager', variants: [
      { archetype: 'Sovereign/Ambassador', label: 'The bridge builder', description: 'Represents users to engineering and vice versa' },
      { archetype: 'Creator/Visionary', label: 'The product visionary', description: 'Imagines what the product should become' },
    ]},
    { role: 'Tech Lead', variants: [
      { archetype: 'Sage/Mentor', label: 'The team grower', description: 'Develops engineers through guidance and code review' },
      { archetype: 'Hero/Warrior', label: 'The execution driver', description: 'Removes blockers and drives delivery' },
      { archetype: 'Sovereign/Ruler', label: 'The standards enforcer', description: 'Sets architecture standards and holds the line' },
    ]},
    { role: 'UX Designer', variants: [
      { archetype: 'Creator/Artist', label: 'The visual craftsperson', description: 'Creates beautiful, emotionally resonant interfaces' },
      { archetype: 'Caregiver/Healer', label: 'The user advocate', description: 'Removes friction and pain from user experiences' },
    ]},
    { role: 'Security Engineer', variants: [
      { archetype: 'Hero/Rescuer', label: 'The incident responder', description: 'Acts decisively when breaches occur' },
      { archetype: 'Caregiver/Guardian', label: 'The protector', description: 'Shields systems through vigilant prevention' },
    ]},
    { role: 'Data Scientist', variants: [
      { archetype: 'Sage/Detective', label: 'The pattern finder', description: 'Uncovers truth through systematic data investigation' },
      { archetype: 'Magician/Scientist', label: 'The hypothesis tester', description: 'Discovers insights through rigorous experimentation' },
    ]},
  ],
  Education: [
    { role: 'Teacher', variants: [
      { archetype: 'Caregiver/Healer', label: 'The nurturer', description: 'Restores confidence and builds understanding' },
      { archetype: 'Sage/Mentor', label: 'The knowledge guide', description: 'Shares wisdom and develops potential' },
    ]},
    { role: 'Principal', variants: [
      { archetype: 'Sovereign/Ruler', label: 'The institution builder', description: 'Creates order and maintains school systems' },
      { archetype: 'Caregiver/Guardian', label: 'The community protector', description: 'Shields students and staff from harm' },
    ]},
    { role: 'Counsellor', variants: [
      { archetype: 'Caregiver/Angel', label: 'The unconditional supporter', description: 'Serves without judgment, radiates acceptance' },
      { archetype: 'Sage/Shaman', label: 'The insight facilitator', description: 'Accesses deeper patterns in student behaviour' },
    ]},
    { role: 'Researcher', variants: [
      { archetype: 'Sage/Detective', label: 'The evidence gatherer', description: 'Investigates educational outcomes systematically' },
      { archetype: 'Creator/Visionary', label: 'The pedagogy innovator', description: 'Imagines new approaches to learning' },
    ]},
    { role: 'Tutor', variants: [
      { archetype: 'Sage/Mentor', label: 'The patient guide', description: 'Develops understanding through one-on-one guidance' },
    ]},
  ],
  Legal: [
    { role: 'Litigator', variants: [
      { archetype: 'Hero/Warrior', label: 'The courtroom fighter', description: 'Fights for clients with strategic determination' },
      { archetype: 'Hero/Liberator', label: 'The justice seeker', description: 'Frees clients from unjust outcomes' },
    ]},
    { role: 'Mediator', variants: [
      { archetype: 'Everyman/Advocate', label: 'The voice for all sides', description: 'Bridges power gaps between parties' },
      { archetype: 'Sovereign/Ambassador', label: 'The consensus builder', description: 'Negotiates between groups to find agreement' },
    ]},
    { role: 'Compliance Officer', variants: [
      { archetype: 'Sovereign/Judge', label: 'The standards enforcer', description: 'Upholds regulations impartially' },
      { archetype: 'Caregiver/Guardian', label: 'The risk preventer', description: 'Shields the organisation from regulatory harm' },
    ]},
    { role: 'Defence Attorney', variants: [
      { archetype: 'Rebel/Maverick', label: 'The convention challenger', description: 'Defies assumptions to protect the accused' },
      { archetype: 'Hero/Liberator', label: 'The freedom fighter', description: 'Fights to free the wrongly charged' },
    ]},
    { role: 'Contracts Specialist', variants: [
      { archetype: 'Sage/Translator', label: 'The clarity maker', description: 'Makes complex legal language accessible' },
      { archetype: 'Sage/Detective', label: 'The risk finder', description: 'Uncovers hidden liabilities in agreements' },
    ]},
  ],
  Medical: [
    { role: 'Surgeon', variants: [
      { archetype: 'Hero/Rescuer', label: 'The crisis operator', description: 'Decisive action under life-or-death pressure' },
      { archetype: 'Hero/Warrior', label: 'The precision fighter', description: 'Strategic, disciplined, mission-focused procedures' },
    ]},
    { role: 'GP', variants: [
      { archetype: 'Caregiver/Healer', label: 'The whole-person healer', description: 'Restores health through empathic, holistic care' },
      { archetype: 'Sage/Detective', label: 'The diagnostician', description: 'Investigates symptoms to uncover root causes' },
    ]},
    { role: 'Researcher', variants: [
      { archetype: 'Sage/Detective', label: 'The evidence hunter', description: 'Systematic investigation of medical questions' },
      { archetype: 'Magician/Scientist', label: 'The discovery maker', description: 'Rigorous experimentation reveals new treatments' },
    ]},
    { role: 'Nurse', variants: [
      { archetype: 'Caregiver/Samaritan', label: 'The practical carer', description: 'Shows up where needed with hands-on help' },
      { archetype: 'Caregiver/Angel', label: 'The compassionate presence', description: 'Serves patients with unconditional care' },
    ]},
    { role: 'Psychiatrist', variants: [
      { archetype: 'Sage/Shaman', label: 'The depth explorer', description: 'Accesses insight from the unconscious mind' },
      { archetype: 'Caregiver/Healer', label: 'The mind mender', description: 'Restores mental health through therapeutic care' },
    ]},
  ],
  Finance: [
    { role: 'Analyst', variants: [
      { archetype: 'Sage/Detective', label: 'The pattern spotter', description: 'Uncovers market truth through evidence and data' },
      { archetype: 'Sage/Translator', label: 'The insight communicator', description: 'Makes complex financial data accessible' },
    ]},
    { role: 'Trader', variants: [
      { archetype: 'Rebel/Gambler', label: 'The high-stakes player', description: 'Lives on the edge, bets big on conviction' },
      { archetype: 'Explorer/Adventurer', label: 'The opportunity seeker', description: 'Pushes into new markets and positions boldly' },
    ]},
    { role: 'Auditor', variants: [
      { archetype: 'Sovereign/Judge', label: 'The impartial evaluator', description: 'Weighs evidence and renders fair assessments' },
      { archetype: 'Sage/Detective', label: 'The discrepancy finder', description: 'Investigates accounts for hidden issues' },
    ]},
    { role: 'Advisor', variants: [
      { archetype: 'Caregiver/Guardian', label: 'The wealth protector', description: 'Shields clients from financial harm' },
      { archetype: 'Sage/Mentor', label: 'The financial guide', description: 'Develops clients financial understanding' },
    ]},
    { role: 'Quant', variants: [
      { archetype: 'Magician/Scientist', label: 'The model builder', description: 'Discovers market truth through mathematical rigour' },
      { archetype: 'Sage/Detective', label: 'The signal extractor', description: 'Finds patterns hidden in noisy data' },
    ]},
  ],
};

export const PROFESSION_LIST = Object.keys(PROFESSION_PRESETS).sort();
