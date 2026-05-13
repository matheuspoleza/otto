import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionableItemsList } from './ActionableItemsList';
import type { ActionItem } from '@/app/_lib/types';

describe('Feature: ActionableItemsList', () => {
  describe('Given an empty action list', () => {
    it('then no urgency section headers are rendered', () => {
      render(<ActionableItemsList actions={[]} />);
      expect(screen.queryByText('Before merge')).toBeNull();
      expect(screen.queryByText('After merge')).toBeNull();
    });
  });

  describe('Given only "Before merge" actions', () => {
    const actions: ActionItem[] = [
      { iconKind: 'doc', text: 'Update API docs', urgency: 'Before merge' },
      { iconKind: 'flask', text: 'Add boundary tests', urgency: 'Before merge' },
    ];

    it('then renders the "Before merge" section with all items', () => {
      render(<ActionableItemsList actions={actions} />);
      expect(screen.getByText('Before merge')).toBeInTheDocument();
      expect(screen.getByText('Update API docs')).toBeInTheDocument();
      expect(screen.getByText('Add boundary tests')).toBeInTheDocument();
    });

    it('then does NOT render an "After merge" section', () => {
      render(<ActionableItemsList actions={actions} />);
      expect(screen.queryByText('After merge')).toBeNull();
    });
  });

  describe('Given a mix of "Before merge" and "After merge" actions', () => {
    const actions: ActionItem[] = [
      { iconKind: 'doc', text: 'Update API docs', urgency: 'Before merge' },
      { iconKind: 'chat', text: 'Draft changelog', urgency: 'After merge' },
      { iconKind: 'bell', text: 'Notify support', urgency: 'After merge' },
    ];

    it('then renders both section headers', () => {
      render(<ActionableItemsList actions={actions} />);
      expect(screen.getByText('Before merge')).toBeInTheDocument();
      expect(screen.getByText('After merge')).toBeInTheDocument();
    });

    it('then "Before merge" section appears before "After merge" in the DOM', () => {
      render(<ActionableItemsList actions={actions} />);
      const before = screen.getByText('Before merge');
      const after = screen.getByText('After merge');
      expect(before.compareDocumentPosition(after)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('then per-item urgency labels are no longer rendered (grouping replaces them)', () => {
      render(<ActionableItemsList actions={actions} />);
      // Per-item urgency text would duplicate the section header — count occurrences
      const beforeMatches = screen.getAllByText('Before merge');
      const afterMatches = screen.getAllByText('After merge');
      expect(beforeMatches).toHaveLength(1);
      expect(afterMatches).toHaveLength(1);
    });
  });
});
