import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockSSESource } from './mock-sse.js';

describe('MockSSESource', () => {
  beforeEach(() => MockSSESource.resetAll());
  afterEach(() => MockSSESource.resetAll());

  it('sets readyState to OPEN immediately', () => {
    const source = new MockSSESource('/events');
    expect(source.readyState).toBe(1);
  });

  it('delivers events to all instances with matching URL', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const s1 = new MockSSESource('/events');
    const s2 = new MockSSESource('/events');
    s1.onmessage = h1;
    s2.onmessage = h2;

    MockSSESource.pushEvent('/events', { type: 'ASSIGNED', workItemId: 'wi-1' });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not deliver to closed instances', () => {
    const handler = vi.fn();
    const source = new MockSSESource('/events');
    source.onmessage = handler;
    source.close();

    MockSSESource.pushEvent('/events', { type: 'ASSIGNED', workItemId: 'wi-1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not cross-deliver between URLs', () => {
    const handler = vi.fn();
    const source = new MockSSESource('/events');
    source.onmessage = handler;

    MockSSESource.pushEvent('/other', { type: 'ASSIGNED', workItemId: 'wi-1' });
    expect(handler).not.toHaveBeenCalled();
  });
});
