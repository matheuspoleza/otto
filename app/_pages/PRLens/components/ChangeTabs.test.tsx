import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChangeTabs } from './ChangeTabs';
import type { TabId } from './ChangeTabs';

const allZero = { ui: 0, api: 0, data: 0, business: 0 } as const;

describe('Feature: ChangeTabs', () => {
  describe('Given all tabs have changes', () => {
    describe('When rendered with activeTab="ui"', () => {
      it('then renders all four tab labels', () => {
        render(<ChangeTabs activeTab="ui" counts={{ ui: 2, api: 1, data: 3, business: 1 }} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /UI/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /API/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Data/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Business/ })).toBeInTheDocument();
      });

      it('then shows each tab\'s count', () => {
        render(<ChangeTabs activeTab="ui" counts={{ ui: 2, api: 1, data: 3, business: 1 }} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /UI/ })).toHaveTextContent('2');
        expect(screen.getByRole('button', { name: /API/ })).toHaveTextContent('1');
        expect(screen.getByRole('button', { name: /Data/ })).toHaveTextContent('3');
        expect(screen.getByRole('button', { name: /Business/ })).toHaveTextContent('1');
      });

      it('then no tab is disabled', () => {
        render(<ChangeTabs activeTab="ui" counts={{ ui: 2, api: 1, data: 3, business: 1 }} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /UI/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /API/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Data/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Business/ })).toBeEnabled();
      });
    });

    describe('When user clicks the "API" tab', () => {
      it('then onChange is called with "api"', async () => {
        const onChange = vi.fn();
        render(<ChangeTabs activeTab="ui" counts={{ ui: 2, api: 1, data: 3, business: 1 }} onChange={onChange} />);

        await userEvent.click(screen.getByRole('button', { name: /API/ }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith<['api']>('api');
      });
    });
  });

  describe('Given a tab has zero changes', () => {
    describe('When rendered', () => {
      it('then that tab is disabled', () => {
        render(<ChangeTabs activeTab="ui" counts={{ ...allZero, ui: 2 }} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /API/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Data/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Business/ })).toBeDisabled();
      });
    });

    describe('When the user clicks the disabled tab', () => {
      it('then onChange is NOT called', async () => {
        const onChange = vi.fn();
        render(<ChangeTabs activeTab="ui" counts={{ ...allZero, ui: 2 }} onChange={onChange} />);

        await userEvent.click(screen.getByRole('button', { name: /API/ }));

        expect(onChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given the active tab is clicked again', () => {
    it('then onChange is still called with the same tab', async () => {
      const onChange = vi.fn();
      render(<ChangeTabs activeTab="ui" counts={{ ui: 2, api: 1, data: 3, business: 1 }} onChange={onChange} />);

      await userEvent.click(screen.getByRole('button', { name: /UI/ }));

      expect(onChange).toHaveBeenCalledWith<[TabId]>('ui');
    });
  });

  describe('Given all counts are zero', () => {
    it('then every tab is disabled', () => {
      render(<ChangeTabs activeTab="ui" counts={allZero} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: /UI/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /API/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Data/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Business/ })).toBeDisabled();
    });
  });
});
