import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { RovingTabindexMixin } from './roving-tabindex.js';

@customElement('test-roving')
class TestRoving extends RovingTabindexMixin(LitElement) {
  override rovingSelector = '[role="option"]';

  override render() {
    return html`
      <div role="listbox">
        <div role="option" tabindex="-1">A</div>
        <div role="option" tabindex="-1">B</div>
        <div role="option" tabindex="-1">C</div>
      </div>
    `;
  }
}

describe('RovingTabindexMixin', () => {
  let el: TestRoving;

  beforeEach(async () => {
    el = document.createElement('test-roving') as TestRoving;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  it('sets first item tabindex to 0 on focus', () => {
    const items = el.shadowRoot!.querySelectorAll('[role="option"]');
    el.dispatchEvent(new FocusEvent('focusin'));
    expect(items[0]!.getAttribute('tabindex')).toBe('0');
  });

  it('moves focus on ArrowDown', () => {
    el.rovingIndex = 0; // Initialize to first item
    el.navigateRoving('next');
    expect(el.rovingIndex).toBe(1);
  });

  it('wraps around at end', () => {
    el.rovingIndex = 2;
    el.navigateRoving('next');
    expect(el.rovingIndex).toBe(0);
  });

  it('Home jumps to first, End to last', () => {
    el.rovingIndex = 1;
    el.navigateRoving('first');
    expect(el.rovingIndex).toBe(0);
    el.navigateRoving('last');
    expect(el.rovingIndex).toBe(2);
  });
});
