import { parseDocument, isMap, type YAMLSeq } from 'yaml';
import { yamlSetOrDelete } from '@casehubio/pages-lsp';

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

export function removeSwfTask(yaml: string, taskName: string): string {
  const doc = parseDocument(yaml);
  const doSeq = doc.get('do') as YAMLSeq;
  if (!doSeq) throw new Error('No do: block found in workflow YAML');

  const idx = doSeq.items.findIndex((item: unknown) => {
    if (isMap(item)) {
      const firstKey = item.items[0]?.key;
      return firstKey && String(firstKey) === taskName;
    }
    return false;
  });

  if (idx === -1) throw new Error(`Task '${taskName}' not found in do: block`);
  doSeq.delete(idx);
  return doc.toString();
}

export function moveSwfTask(yaml: string, taskName: string, beforeTaskName: string | null, edgeSourceName?: string): string {
  const doc = parseDocument(yaml);
  const doSeq = doc.get('do') as YAMLSeq;
  if (!doSeq) throw new Error('No do: block found in workflow YAML');

  const srcIdx = doSeq.items.findIndex((item: unknown) => {
    if (isMap(item)) {
      const firstKey = item.items[0]?.key;
      return firstKey && String(firstKey) === taskName;
    }
    return false;
  });
  if (srcIdx === -1) throw new Error(`Task '${taskName}' not found in do: block`);

  const [removed] = doSeq.items.splice(srcIdx, 1);

  if (beforeTaskName === null) {
    doSeq.items.push(removed);
  } else {
    let dstIdx = doSeq.items.findIndex((item: unknown) => {
      if (isMap(item)) {
        const firstKey = item.items[0]?.key;
        return firstKey && String(firstKey) === beforeTaskName;
      }
      return false;
    });
    if (dstIdx === -1) dstIdx = doSeq.items.length;
    doSeq.items.splice(dstIdx, 0, removed);
  }

  if (beforeTaskName && edgeSourceName) {
    rewriteThenReferences(doSeq, edgeSourceName, beforeTaskName, taskName);
  }

  return doc.toString();
}

function rewriteThenReferences(doSeq: YAMLSeq, sourceTaskName: string, oldTarget: string, newTarget: string): void {
  for (const item of doSeq.items) {
    if (!isMap(item)) continue;
    const firstKey = item.items[0]?.key;
    if (!firstKey || String(firstKey) !== sourceTaskName) continue;
    const taskDef = item.items[0]?.value;
    if (!isMap(taskDef)) continue;
    const switchSeq = taskDef.get('switch') as YAMLSeq | undefined;
    if (switchSeq) {
      for (const caseItem of switchSeq.items) {
        if (!isMap(caseItem)) continue;
        for (const casePair of caseItem.items) {
          const caseBody = casePair.value;
          if (isMap(caseBody) && String(caseBody.get('then')) === oldTarget) {
            caseBody.set('then', newTarget);
          }
        }
      }
    }
    if (String(taskDef.get('then')) === oldTarget) {
      taskDef.set('then', newTarget);
    }
  }
}

export function applySwfPropertyEdit(
  yaml: string,
  nodePath: readonly (string | number)[],
  field: (string | number)[],
  value: unknown,
): string {
  return yamlSetOrDelete(yaml, nodePath, field, value);
}
