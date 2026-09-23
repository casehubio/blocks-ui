import { describe, it, expect } from 'vitest';
import type { FullAgentDescriptor } from './agent.js';

describe('FullAgentDescriptor', () => {
  it('supports required fields', () => {
    const descriptor: FullAgentDescriptor = {
      agentId: 'test-1',
      name: 'Inspector',
      tenancyId: 'tenant-1',
    };
    expect(descriptor.agentId).toBe('test-1');
  });

  it('supports archetype fields', () => {
    const descriptor: FullAgentDescriptor = {
      agentId: 'test-1',
      name: 'Inspector',
      tenancyId: 'tenant-1',
      archetypeFamily: 'Sage',
      subArchetype: 'Detective',
      archetypeAdjectives: ['meticulous', 'persistent'],
      avatar: 'mythic:P1B',
    };
    expect(descriptor.archetypeFamily).toBe('Sage');
    expect(descriptor.subArchetype).toBe('Detective');
    expect(descriptor.archetypeAdjectives).toEqual(['meticulous', 'persistent']);
    expect(descriptor.avatar).toBe('mythic:P1B');
  });

  it('archetype fields are optional', () => {
    const descriptor: FullAgentDescriptor = {
      agentId: 'test-2',
      name: 'Worker',
      tenancyId: 'tenant-1',
    };
    expect(descriptor.archetypeFamily).toBeUndefined();
    expect(descriptor.avatar).toBeUndefined();
  });
});
