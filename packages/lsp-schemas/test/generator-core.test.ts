import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { typeToZod, propToZodField } from '../scripts/generate-domain-schemas.js';

describe('typeToZod', () => {
  const project = new Project({ useInMemoryFileSystem: true });

  function zodForType(typeCode: string): string {
    const file = project.createSourceFile(
      'test.ts',
      `export type T = ${typeCode};`,
      { overwrite: true },
    );
    const typeAlias = file.getTypeAliasOrThrow('T');
    return typeToZod(typeAlias.getType(), 0, new Set());
  }

  it('maps string to z.string()', () => {
    expect(zodForType('string')).toBe('z.string()');
  });

  it('maps number to z.number()', () => {
    expect(zodForType('number')).toBe('z.number()');
  });

  it('maps boolean to z.boolean()', () => {
    expect(zodForType('boolean')).toBe('z.boolean()');
  });

  it('maps string literal union to z.enum()', () => {
    const result = zodForType("'a' | 'b' | 'c'");
    expect(result).toBe('z.enum(["a", "b", "c"])');
  });

  it('maps string array to z.array(z.string())', () => {
    expect(zodForType('string[]')).toBe('z.array(z.string())');
  });

  it('maps Record<string, number> to z.record(z.number())', () => {
    expect(zodForType('Record<string, number>')).toBe('z.record(z.number())');
  });

  it('maps unknown to z.unknown()', () => {
    expect(zodForType('unknown')).toBe('z.unknown()');
  });

  it('maps object type to z.object()', () => {
    const result = zodForType('{ name: string; age?: number }');
    expect(result).toContain('z.object(');
    expect(result).toContain('name: z.string()');
    expect(result).toContain('age: z.number().optional()');
  });
});

describe('propToZodField — index signature stripping', () => {
  const project = new Project({ useInMemoryFileSystem: true });

  it('strips index signature properties', () => {
    const file = project.createSourceFile(
      'idx.ts',
      `export interface Foo {
        name: string;
        [k: string]: unknown;
      }`,
      { overwrite: true },
    );
    const iface = file.getInterfaceOrThrow('Foo');
    const props = iface.getType().getProperties();
    const fields = props
      .map(p => propToZodField(p, 0, new Set()))
      .filter(Boolean);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain('name: z.string()');
  });

  it('skips function-typed properties', () => {
    const file = project.createSourceFile(
      'fn.ts',
      `export interface Bar {
        label: string;
        onClick: () => void;
      }`,
      { overwrite: true },
    );
    const iface = file.getInterfaceOrThrow('Bar');
    const props = iface.getType().getProperties();
    const fields = props
      .map(p => propToZodField(p, 0, new Set()))
      .filter(Boolean);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain('label: z.string()');
  });
});

describe('CaseDefinition generation', () => {
  it('generated schema parses a valid case definition', async () => {
    const { caseDefinitionDocumentSchema } = await import(
      '../src/schemas/case-definition.generated.js'
    );
    const result = caseDefinitionDocumentSchema.safeParse({
      dsl: '1.0',
      namespace: 'test',
      name: 'TestCase',
      version: '1.0.0',
      spec: {
        capabilities: [{ name: 'cap1' }],
        bindings: [{
          name: 'b1',
          on: { contextChange: { filter: '.status == "active"' } },
          capability: 'cap1',
        }],
        workers: [{
          name: 'w1',
          capabilities: ['cap1'],
        }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('generated schema validates binding trigger types', async () => {
    const { caseDefinitionDocumentSchema } = await import(
      '../src/schemas/case-definition.generated.js'
    );
    const result = caseDefinitionDocumentSchema.safeParse({
      dsl: '1.0',
      namespace: 'test',
      name: 'TestCase',
      version: '1.0.0',
      spec: {
        bindings: [{
          name: 'b1',
          on: { cloudEvent: 'my.event.type' },
          capability: 'cap1',
        }],
      },
    });
    expect(result.success).toBe(true);
  });
});
