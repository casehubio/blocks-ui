export type BehavioralSignal = 'DECLINE' | 'SUCCESS' | 'COMPLIANT' | 'VIOLATED';

export interface AgentCapability {
  name: string;
  description?: string;
}

export interface AgentGoal {
  name: string;
  description?: string;
  priority?: string;
  visibility?: string;
}

export interface AgentConstraint {
  name: string;
  description?: string;
  severity?: string;
  visibility?: string;
}

export interface Membership {
  agentId: string;
  role?: string;
  roleVocabulary?: string;
}

export interface RelationshipScope {
  capabilityName?: string;
  domain?: string;
  custom?: string;
}

export interface AttestationGrant {
  dimensions: [string, ...string[]];
  capabilityScope?: string[];
  signalTypes?: BehavioralSignal[];
}

export type RelationshipKind =
  | 'SUPERVISES'
  | 'DELEGATES_TO'
  | 'ESCALATES_TO'
  | 'REPORTS_TO'
  | 'BACKS_UP'
  | 'EXTENDED';

export interface AgentRelationship {
  sourceAgentId: string;
  targetAgentId: string;
  kind: RelationshipKind;
  extendedKind?: string;
  kindVocabulary?: string;
  scope?: RelationshipScope;
  attestation?: AttestationGrant;
  tenancyId: string;
}

export interface OrgUnit {
  unitId: string;
  name: string;
  kind?: string;
  kindVocabulary?: string;
  tenancyId: string;
  parentUnitId?: string;
  members: Membership[];
  capabilities: AgentCapability[];
  goals: AgentGoal[];
  constraints: AgentConstraint[];
}

export interface OrgStructureYaml {
  organization: {
    units: OrgUnit[];
    relationships: AgentRelationship[];
  };
}
