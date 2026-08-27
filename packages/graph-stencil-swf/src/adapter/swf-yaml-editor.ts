import { parseDocument, type YAMLSeq } from 'yaml';

const SWF_TASK_DEFAULTS: Record<string, Record<string, unknown>> = {
  'swf-call': { call: 'http:get', with: {} },
  'swf-set': { set: {} },
  'swf-switch': { switch: [{ when: '.condition == true', then: 'continue' }] },
  'swf-raise': { raise: { error: { type: 'error', status: 500, title: 'Error' } } },
  'swf-try': { try: { call: 'http:get' }, catch: { as: 'error' } },
};

const TYPE_TO_NAME_PREFIX: Record<string, string> = {
  'swf-call': 'newCall',
  'swf-set': 'newSet',
  'swf-switch': 'newSwitch',
  'swf-raise': 'newRaise',
  'swf-try': 'newTry',
};

export function addSwfTask(yaml: string, taskType: string): string {
  const doc = parseDocument(yaml);
  const doSeq = doc.get('do') as YAMLSeq;
  if (!doSeq) throw new Error('No do: block found in workflow YAML');

  const existing = new Set<string>();
  for (const item of doSeq.items) {
    const map = (item as { items?: { key?: { value?: string } }[] }).items;
    if (map) {
      for (const pair of map) {
        if (pair.key?.value) existing.add(pair.key.value);
      }
    }
  }

  const prefix = TYPE_TO_NAME_PREFIX[taskType] ?? 'newStep';
  let counter = 1;
  while (existing.has(`${prefix}${counter}`)) counter++;
  const stepName = `${prefix}${counter}`;

  const defaults = SWF_TASK_DEFAULTS[taskType] ?? {};
  const entry = doc.createNode({ [stepName]: defaults });
  doSeq.add(entry);

  return doc.toString();
}

export function applySwfPropertyEdit(
  yaml: string,
  nodePath: readonly (string | number)[],
  field: (string | number)[],
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
