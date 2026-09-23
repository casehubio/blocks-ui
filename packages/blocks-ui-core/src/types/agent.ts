export interface FullAgentDescriptor {
  readonly agentId: string;
  readonly name: string;
  readonly tenancyId: string;
  readonly archetypeFamily?: string;
  readonly subArchetype?: string;
  readonly archetypeAdjectives?: readonly string[];
  readonly avatar?: string;
}
