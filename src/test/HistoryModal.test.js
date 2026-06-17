import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import HistoryModal from '../lib/HistoryModal.svelte';

afterEach(cleanup);

describe('HistoryModal', () => {
  it('focuses the first focusable element (close button) on mount', async () => {
    const { getByLabelText } = render(HistoryModal, {
      props: { history: [], onclose: () => {} },
    });
    const closeBtn = getByLabelText('Close history modal');
    expect(document.activeElement).toBe(closeBtn);
  });

  it('calls onclose when Escape is pressed', () => {
    let closed = false;
    render(HistoryModal, { props: { history: [], onclose: () => { closed = true; } } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(true);
  });

  it('returns focus to the opener button when unmounted', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(HistoryModal, {
      props: { history: [], onclose: () => {} },
    });

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
