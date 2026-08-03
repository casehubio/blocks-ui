import { parseDocument, parse as parseYaml } from 'yaml';

export function applyPropertyEdit(
  yaml: string,
  nodePath: readonly (string | number)[],
  field: readonly (string | number)[],
  value: unknown,
): string {
  const doc = parseDocument(yaml);
  const fullPath = [...nodePath, ...field];

  if (value === undefined) {
    doc.deleteIn(fullPath);
  } else {
    doc.setIn(fullPath, value);
  }

  return doc.toString();
}

const ELEMENT_PATHS: Record<string, string> = {
  binding: 'bindings',
  worker: 'workers',
  milestone: 'milestones',
  goal: 'goals',
};

const ELEMENT_DEFAULTS: Record<string, (n: number) => Record<string, unknown>> = {
  binding: (n) => ({ name: `binding-${n}`, capability: '' }),
  worker: (n) => ({ name: `worker-${n}`, capabilities: [] }),
  milestone: (n) => ({ name: `milestone-${n}` }),
  goal: (n) => ({ name: `goal-${n}`, kind: 'success' }),
};

export function addElement(
  yaml: string,
  elementType: 'binding' | 'worker' | 'milestone' | 'goal',
  defaults?: Record<string, unknown>,
): string {
  const doc = parseDocument(yaml);
  const arrayKey = ELEMENT_PATHS[elementType];
  const specPath = ['spec', arrayKey];

  const parsed = parseYaml(yaml) as { spec: Record<string, Array<{ name?: string }>> };
  const existing = parsed.spec?.[arrayKey] ?? [];
  const existingNames = new Set(existing.map(e => String(e.name ?? '')));

  let n = 1;
  while (existingNames.has(`${elementType}-${n}`)) n++;

  const generated = ELEMENT_DEFAULTS[elementType](n);
  const merged = defaults ? { ...generated, ...defaults } : generated;

  const seq = doc.getIn(specPath);
  if (!seq) {
    doc.setIn(specPath, [merged]);
  } else {
    doc.addIn(specPath, merged);
  }
  return doc.toString();
}

export function removeElement(
  yaml: string,
  nodePath: readonly (string | number)[],
): string {
  const doc = parseDocument(yaml);
  doc.deleteIn([...nodePath]);
  return doc.toString();
}

const TARGET_DEFAULTS: Record<string, unknown> = {
  capability: '',
  subCase: { namespace: '', name: '' },
  humanTask: { title: '' },
};

export function switchBindingTarget(
  yaml: string,
  bindingPath: readonly (string | number)[],
  targetType: 'capability' | 'subCase' | 'humanTask',
): string {
  const doc = parseDocument(yaml);
  for (const key of ['capability', 'subCase', 'humanTask']) {
    doc.deleteIn([...bindingPath, key]);
  }
  doc.setIn([...bindingPath, targetType], TARGET_DEFAULTS[targetType]);
  return doc.toString();
}
