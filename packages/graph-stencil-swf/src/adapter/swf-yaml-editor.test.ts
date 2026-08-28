import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { applySwfPropertyEdit, addSwfTask, removeSwfTask } from './swf-yaml-editor.js';

const SAMPLE_YAML = `document:
  dsl: "1.0.0"
  namespace: test
  name: sample
  version: "1.0.0"
do:
  - fetchData:
      call: http
      with:
        method: GET
`;

describe('applySwfPropertyEdit', () => {
  it('updates a property value', () => {
    const result = applySwfPropertyEdit(SAMPLE_YAML, ['do', 0, 'fetchData'], ['with', 'method'], 'POST');
    expect(result).toContain('method: POST');
  });
});

describe('addSwfTask', () => {
  it('appends a call task to the do block', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-call');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    expect(parsed.do).toHaveLength(2);
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toMatch(/^newCall/);
    const taskDef = (newStep as Record<string, Record<string, unknown>>)[stepName]!;
    expect(taskDef['call']).toBeDefined();
  });

  it('appends a set task', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-set');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toMatch(/^newSet/);
    const taskDef = (newStep as Record<string, Record<string, unknown>>)[stepName]!;
    expect(taskDef['set']).toBeDefined();
  });

  it('appends a switch task', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-switch');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toMatch(/^newSwitch/);
  });

  it('appends a raise task', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-raise');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toMatch(/^newRaise/);
    const taskDef = (newStep as Record<string, Record<string, unknown>>)[stepName]!;
    expect(taskDef['raise']).toBeDefined();
  });

  it('appends a try task', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-try');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toMatch(/^newTry/);
    const taskDef = (newStep as Record<string, Record<string, unknown>>)[stepName]!;
    expect(taskDef['try']).toBeDefined();
    expect(taskDef['catch']).toBeDefined();
  });

  it('generates unique step names when name already exists', () => {
    const yamlWithCall = `document:
  dsl: "1.0.0"
  namespace: test
  name: sample
  version: "1.0.0"
do:
  - newCall1:
      call: http
      with:
        method: GET
`;
    const result = addSwfTask(yamlWithCall, 'swf-call');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    const newStep = parsed.do[1]!;
    const stepName = Object.keys(newStep)[0]!;
    expect(stepName).toBe('newCall2');
  });

  it('preserves existing YAML content', () => {
    const result = addSwfTask(SAMPLE_YAML, 'swf-call');
    expect(result).toContain('fetchData:');
    expect(result).toContain('method: GET');
  });
});

const MULTI_STEP_YAML = `document:
  dsl: "1.0.0"
  namespace: test
  name: sample
  version: "1.0.0"
do:
  - step1:
      call: http:get
      with:
        endpoint: /api/one
  - step2:
      call: http:post
      with:
        endpoint: /api/two
  - step3:
      set:
        result: done
`;

describe('removeSwfTask', () => {
  it('removes a named task from the do block', () => {
    const result = removeSwfTask(MULTI_STEP_YAML, 'step2');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    expect(parsed.do).toHaveLength(2);
    expect(result).not.toContain('step2');
    expect(result).toContain('step1');
    expect(result).toContain('step3');
  });

  it('throws when task not found', () => {
    expect(() => removeSwfTask(MULTI_STEP_YAML, 'missing')).toThrow(/not found/i);
  });

  it('preserves other tasks when removing first', () => {
    const result = removeSwfTask(MULTI_STEP_YAML, 'step1');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    expect(parsed.do).toHaveLength(2);
    expect(result).toContain('step2');
    expect(result).toContain('step3');
  });

  it('preserves other tasks when removing last', () => {
    const result = removeSwfTask(MULTI_STEP_YAML, 'step3');
    const parsed = parseYaml(result) as { do: Record<string, unknown>[] };
    expect(parsed.do).toHaveLength(2);
    expect(result).toContain('step1');
    expect(result).toContain('step2');
  });
});
