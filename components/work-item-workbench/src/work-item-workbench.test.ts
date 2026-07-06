import { describe, it, expect, beforeEach, vi } from 'vitest';
import './work-item-workbench';
import type { WorkItemWorkbench } from './work-item-workbench';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock EventSource
class EventSourceMock {
  url: string;
  withCredentials = false;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string, _config?: EventSourceInit) {
    this.url = url;
  }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event): boolean { return true; }
  close() {}
}
Object.defineProperty(global, 'EventSource', { value: EventSourceMock });

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(global, 'IntersectionObserver', { value: IntersectionObserverMock });

describe('WorkItemWorkbench', () => {
  let element: WorkItemWorkbench;
  const mockIdentity: WorkIdentity = {
    userId: 'user-1',
    displayName: 'Test User',
    groups: ['group-1', 'group-2'],
  };

  beforeEach(() => {
    element = document.createElement('work-item-workbench') as WorkItemWorkbench;
    element.endpoint = 'http://localhost:8080/api';
    element.identity = mockIdentity;
  });

  describe('rendering', () => {
    it('should render', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      expect(element.shadowRoot).toBeTruthy();
      document.body.removeChild(element);
    });

    it('inherits theme from document-level CSS custom properties', async () => {
      const style = document.createElement('style');
      style.textContent = ':root { --blocks-neutral-1: rgb(10, 10, 10); }';
      document.head.appendChild(style);
      document.body.appendChild(element);
      await element.updateComplete;
      const workbench = element.shadowRoot!.querySelector('.workbench')!;
      expect(workbench.classList.contains('theme-light')).toBe(false);
      expect(workbench.classList.contains('theme-dark')).toBe(false);
      document.body.removeChild(element);
      style.remove();
    });

    it('does not define its own theme or density CSS classes', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const styles = element.shadowRoot!.querySelector('style')!.textContent!;
      expect(styles).not.toContain('.theme-light');
      expect(styles).not.toContain('.theme-dark');
      expect(styles).not.toContain('.density-comfortable');
      expect(styles).not.toContain('.density-compact');
      document.body.removeChild(element);
    });
  });

  describe('desktop layout (>1024px)', () => {
    beforeEach(() => {
      Object.defineProperty(element, 'clientWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });
    });

    it('should render split pane layout', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;
      expect(root.querySelector('.split-pane')).toBeTruthy();
      expect(root.querySelector('.left-panel')).toBeTruthy();
      expect(root.querySelector('.right-panel')).toBeTruthy();
      expect(root.querySelector('.divider')).toBeTruthy();
      document.body.removeChild(element);
    });

    it('should not render tabs in left panel', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;
      const tabs = root.querySelectorAll('.left-panel .tab');
      expect(tabs.length).toBe(0);
      document.body.removeChild(element);
    });

    it('should render work-item-inbox by default', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;
      expect(root.querySelector('work-item-inbox')).toBeTruthy();
      document.body.removeChild(element);
    });

    it('should render work-item-detail in right panel', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;
      expect(root.querySelector('.right-panel work-item-detail')).toBeTruthy();
      document.body.removeChild(element);
    });

    it('should render keyboard hint bar at bottom', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;
      expect(root.querySelector('.keyboard-hints')).toBeTruthy();
      document.body.removeChild(element);
    });
  });


  describe('work item selection', () => {
    it('should pass selected work item ID to detail panel', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;

      const event = new CustomEvent('pages-event', {
        bubbles: true,
        composed: true,
        detail: {
          topic: 'work-item.selected',
          payload: { workItemId: 'work-123' },
        },
      });
      document.dispatchEvent(event);

      await element.updateComplete;
      const detailPanel = root.querySelector('work-item-detail') as any;
      expect(detailPanel.workItemId).toBe('work-123');
      document.body.removeChild(element);
    });

    it('should clear detail panel on deselection', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const root = element.shadowRoot!;

      const selectEvent = new CustomEvent('pages-event', {
        bubbles: true,
        composed: true,
        detail: {
          topic: 'work-item.selected',
          payload: { workItemId: 'work-123' },
        },
      });
      document.dispatchEvent(selectEvent);
      await element.updateComplete;

      const deselectEvent = new CustomEvent('pages-event', {
        bubbles: true,
        composed: true,
        detail: {
          topic: 'work-item.deselected',
          payload: {},
        },
      });
      document.dispatchEvent(deselectEvent);
      await element.updateComplete;

      const detailPanel = root.querySelector('work-item-detail') as any;
      expect(detailPanel.workItemId).toBe('');
      document.body.removeChild(element);
    });
  });

  describe('localStorage persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should persist divider ratio to localStorage', async () => {
      document.body.appendChild(element);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(localStorage.getItem('casehub-workbench-divider')).toBeDefined();
      document.body.removeChild(element);
    });
  });

  describe('configure() lifecycle', () => {
    it('should accept configure() before connectedCallback', () => {
      element.configure({
        endpoint: 'http://test-api.com',
        identity: mockIdentity,
      });
      expect(element.endpoint).toBe('http://test-api.com');
    });

    it('should support reconfigure after initial render', async () => {
      document.body.appendChild(element);
      element.configure({
        endpoint: 'http://new-api.com',
        identity: { ...mockIdentity, userId: 'user-2' },
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(element.endpoint).toBe('http://new-api.com');
      expect(element.identity.userId).toBe('user-2');
      document.body.removeChild(element);
    });
  });

  describe('Task 8: Queue tab removal', () => {
    it('does not render Queues tab', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const tabs = element.shadowRoot!.querySelectorAll('.tab');
      const queueTab = Array.from(tabs).find(tab => tab.textContent?.includes('Queues'));
      expect(queueTab).toBeUndefined();
      document.body.removeChild(element);
    });

    it('does not render queue-board', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const queueBoard = element.shadowRoot!.querySelector('queue-board');
      expect(queueBoard).toBeNull();
      document.body.removeChild(element);
    });

    it('always renders work-item-inbox in left panel', async () => {
      document.body.appendChild(element);
      await element.updateComplete;
      const inbox = element.shadowRoot!.querySelector('work-item-inbox');
      expect(inbox).not.toBeNull();
      document.body.removeChild(element);
    });
  });
});
