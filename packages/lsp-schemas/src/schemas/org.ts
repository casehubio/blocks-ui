import { z } from 'zod';

const agentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const agentGoalSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priority: z.string().optional(),
  visibility: z.string().optional(),
});

const agentConstraintSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  severity: z.string().optional(),
  visibility: z.string().optional(),
});

const membershipSchema = z.object({
  agentId: z.string(),
  role: z.string().optional(),
  roleVocabulary: z.string().optional(),
});

const relationshipScopeSchema = z.object({
  capabilityName: z.string().optional(),
  domain: z.string().optional(),
  custom: z.string().optional(),
});

const attestationGrantSchema = z.object({
  dimensions: z.array(z.string()).min(1),
  capabilityScope: z.array(z.string()).optional(),
  signalTypes: z.array(z.enum(['DECLINE', 'SUCCESS', 'COMPLIANT', 'VIOLATED'])).optional(),
});

const relationshipKindSchema = z.enum([
  'SUPERVISES', 'DELEGATES_TO', 'ESCALATES_TO', 'REPORTS_TO', 'BACKS_UP', 'EXTENDED',
]);

const agentRelationshipSchema = z.object({
  sourceAgentId: z.string(),
  targetAgentId: z.string(),
  kind: relationshipKindSchema,
  extendedKind: z.string().optional(),
  kindVocabulary: z.string().optional(),
  scope: relationshipScopeSchema.optional(),
  attestation: attestationGrantSchema.optional(),
  tenancyId: z.string(),
});

const orgUnitSchema = z.object({
  unitId: z.string(),
  name: z.string(),
  kind: z.string().optional(),
  kindVocabulary: z.string().optional(),
  tenancyId: z.string(),
  parentUnitId: z.string().optional(),
  members: z.array(membershipSchema),
  capabilities: z.array(agentCapabilitySchema),
  goals: z.array(agentGoalSchema),
  constraints: z.array(agentConstraintSchema),
});

export const orgDocumentSchema = z.object({
  organization: z.object({
    units: z.array(orgUnitSchema),
    relationships: z.array(agentRelationshipSchema),
  }),
});
