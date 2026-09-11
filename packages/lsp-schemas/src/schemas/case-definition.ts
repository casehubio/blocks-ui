import { z } from 'zod';

const capabilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trustDimensions: z.array(z.string()).optional(),
}).passthrough();

const subCaseRefSchema = z.object({
  namespace: z.string(),
  name: z.string(),
}).passthrough();

const humanTaskRefSchema = z.object({
  title: z.string(),
}).passthrough();

const triggerOnSchema = z.object({
  contextChange: z.unknown().optional(),
  cloudEvent: z.unknown().optional(),
  schedule: z.unknown().optional(),
  scopeActivated: z.unknown().optional(),
}).passthrough();

const triggerSchema = z.object({
  name: z.string().optional(),
  on: triggerOnSchema.optional(),
}).passthrough();

const bindingSchema = z.object({
  name: z.string(),
  capability: z.string().optional(),
  subCase: subCaseRefSchema.optional(),
  humanTask: humanTaskRefSchema.optional(),
  trigger: triggerSchema.optional(),
  guard: z.string().optional(),
}).passthrough();

const mcpTransportSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().optional(),
  auth: z.unknown().optional(),
}).passthrough();

const workerFunctionSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  agent: z.unknown().optional(),
  flow: z.unknown().optional(),
  a2a: z.unknown().optional(),
  mcp: mcpTransportSchema.optional(),
  sequence: z.unknown().optional(),
}).passthrough();

const workerSchema = z.object({
  name: z.string(),
  capabilities: z.array(z.string()).optional(),
  functions: z.array(workerFunctionSchema).optional(),
}).passthrough();

const milestoneSchema = z.object({
  name: z.string(),
  condition: z.string().optional(),
}).passthrough();

const goalSchema = z.object({
  name: z.string(),
  kind: z.string().optional(),
}).passthrough();

export const caseDefinitionDocumentSchema = z.object({
  dsl: z.string().optional(),
  namespace: z.string().optional(),
  name: z.string().optional(),
  spec: z.object({
    capabilities: z.array(capabilitySchema).optional(),
    bindings: z.array(bindingSchema).optional(),
    workers: z.array(workerSchema).optional(),
    milestones: z.array(milestoneSchema).optional(),
    goals: z.array(goalSchema).optional(),
  }).passthrough(),
}).passthrough();
