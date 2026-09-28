export interface ProfessionRole {
  readonly role: string;
  readonly archetype: string;
}

export const PROFESSION_PRESETS: Record<string, readonly ProfessionRole[]> = {
  Software: [
    { role: 'Architect', archetype: 'Sage/Mentor' },
    { role: 'QA Lead', archetype: 'Sovereign/Judge' },
    { role: 'DevOps Engineer', archetype: 'Explorer/Pioneer' },
    { role: 'Product Manager', archetype: 'Sovereign/Ambassador' },
    { role: 'Tech Lead', archetype: 'Hero/Warrior' },
    { role: 'UX Designer', archetype: 'Creator/Artist' },
    { role: 'Security Engineer', archetype: 'Hero/Rescuer' },
    { role: 'Data Scientist', archetype: 'Sage/Detective' },
  ],
  Education: [
    { role: 'Teacher', archetype: 'Caregiver/Healer' },
    { role: 'Principal', archetype: 'Sovereign/Ruler' },
    { role: 'Counsellor', archetype: 'Caregiver/Angel' },
    { role: 'Researcher', archetype: 'Sage/Detective' },
    { role: 'Tutor', archetype: 'Sage/Mentor' },
  ],
  Legal: [
    { role: 'Litigator', archetype: 'Hero/Liberator' },
    { role: 'Mediator', archetype: 'Everyman/Advocate' },
    { role: 'Compliance Officer', archetype: 'Sovereign/Judge' },
    { role: 'Defence Attorney', archetype: 'Rebel/Maverick' },
    { role: 'Contracts Specialist', archetype: 'Sage/Translator' },
  ],
  Medical: [
    { role: 'Surgeon', archetype: 'Hero/Rescuer' },
    { role: 'GP', archetype: 'Caregiver/Healer' },
    { role: 'Researcher', archetype: 'Sage/Detective' },
    { role: 'Nurse', archetype: 'Caregiver/Samaritan' },
    { role: 'Psychiatrist', archetype: 'Sage/Shaman' },
  ],
  Finance: [
    { role: 'Analyst', archetype: 'Sage/Detective' },
    { role: 'Trader', archetype: 'Explorer/Adventurer' },
    { role: 'Auditor', archetype: 'Sovereign/Judge' },
    { role: 'Advisor', archetype: 'Caregiver/Guardian' },
    { role: 'Quant', archetype: 'Magician/Scientist' },
  ],
};

export const PROFESSION_LIST = Object.keys(PROFESSION_PRESETS).sort();
