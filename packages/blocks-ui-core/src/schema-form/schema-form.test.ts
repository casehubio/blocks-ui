import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import './schema-form.js';

describe('schema-form', () => {
  let el: HTMLElement & { schema: unknown; data: unknown; mode: string };

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      count: { type: 'number' },
      active: { type: 'boolean' },
      status: { type: 'string', enum: ['open', 'closed'] },
    },
    required: ['title'],
  };

  const data = { title: 'Test Item', count: 42, active: true, status: 'open' };

  beforeEach(async () => {
    el = document.createElement('schema-form') as any;
    el.schema = schema;
    el.data = data;
    el.mode = 'display';
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders in display mode with labels and values', () => {
    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('title');
    expect(shadow.textContent).toContain('Test Item');
    expect(shadow.textContent).toContain('42');
  });

  it('renders boolean as Yes/No', () => {
    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('Yes');
  });

  it('shows dash for null values', async () => {
    el.data = { title: 'Test', count: null, active: false, status: null };
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).toContain('—');
  });
});
