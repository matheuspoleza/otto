import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FullscreenImageModal } from './FullscreenImageModal';

const baseProps = {
  beforeUrl: 'https://example.com/before.png',
  afterUrl: 'https://example.com/after.png',
  routeName: 'Settings page',
  onSwitchSide: vi.fn(),
  onClose: vi.fn(),
};

describe('Feature: FullscreenImageModal', () => {
  describe('Given currentSide is "after"', () => {
    it('then renders the after image and the AFTER caption', () => {
      render(<FullscreenImageModal {...baseProps} currentSide="after" />);
      const img = screen.getByRole('img') as HTMLImageElement;
      expect(img.src).toBe('https://example.com/after.png');
      expect(screen.getByText(/Settings page — AFTER/)).toBeInTheDocument();
    });
  });

  describe('Given currentSide is "before"', () => {
    it('then renders the before image and the BEFORE caption', () => {
      render(<FullscreenImageModal {...baseProps} currentSide="before" />);
      const img = screen.getByRole('img') as HTMLImageElement;
      expect(img.src).toBe('https://example.com/before.png');
      expect(screen.getByText(/Settings page — BEFORE/)).toBeInTheDocument();
    });
  });

  describe('Given the modal is mounted', () => {
    it('then locks body scroll until unmount', () => {
      const { unmount } = render(<FullscreenImageModal {...baseProps} currentSide="after" />);
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('When the user presses Escape', () => {
    it('then calls onClose', () => {
      const onClose = vi.fn();
      render(<FullscreenImageModal {...baseProps} currentSide="after" onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the user clicks the close button', () => {
    it('then calls onClose exactly once', async () => {
      const onClose = vi.fn();
      render(<FullscreenImageModal {...baseProps} currentSide="after" onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the user clicks the backdrop', () => {
    it('then calls onClose', async () => {
      const onClose = vi.fn();
      render(<FullscreenImageModal {...baseProps} currentSide="after" onClose={onClose} />);
      await userEvent.click(screen.getByRole('dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the user clicks the image', () => {
    it('then onClose is NOT called', async () => {
      const onClose = vi.fn();
      render(<FullscreenImageModal {...baseProps} currentSide="after" onClose={onClose} />);
      await userEvent.click(screen.getByRole('img'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Given currentSide="before" and both URLs set', () => {
    describe('When ArrowRight is pressed', () => {
      it('then calls onSwitchSide("after")', () => {
        const onSwitchSide = vi.fn();
        render(
          <FullscreenImageModal {...baseProps} currentSide="before" onSwitchSide={onSwitchSide} />,
        );
        fireEvent.keyDown(document, { key: 'ArrowRight' });
        expect(onSwitchSide).toHaveBeenCalledWith('after');
      });
    });

    describe('When ArrowLeft is pressed', () => {
      it('then does NOT call onSwitchSide (already on before)', () => {
        const onSwitchSide = vi.fn();
        render(
          <FullscreenImageModal {...baseProps} currentSide="before" onSwitchSide={onSwitchSide} />,
        );
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
        expect(onSwitchSide).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given currentSide="after" and both URLs set', () => {
    describe('When ArrowLeft is pressed', () => {
      it('then calls onSwitchSide("before")', () => {
        const onSwitchSide = vi.fn();
        render(
          <FullscreenImageModal {...baseProps} currentSide="after" onSwitchSide={onSwitchSide} />,
        );
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
        expect(onSwitchSide).toHaveBeenCalledWith('before');
      });
    });
  });

  describe('Given currentSide="after" but beforeUrl is null (new route, no before)', () => {
    it('then ArrowLeft does NOT call onSwitchSide', () => {
      const onSwitchSide = vi.fn();
      render(
        <FullscreenImageModal
          {...baseProps}
          beforeUrl={null}
          currentSide="after"
          onSwitchSide={onSwitchSide}
        />,
      );
      fireEvent.keyDown(document, { key: 'ArrowLeft' });
      expect(onSwitchSide).not.toHaveBeenCalled();
    });
  });

  describe('Given a "previous" chevron is visible', () => {
    it('then clicking it switches to before', async () => {
      const onSwitchSide = vi.fn();
      render(
        <FullscreenImageModal {...baseProps} currentSide="after" onSwitchSide={onSwitchSide} />,
      );
      await userEvent.click(screen.getByRole('button', { name: /previous|before/i }));
      expect(onSwitchSide).toHaveBeenCalledWith('before');
    });
  });

  describe('Given a "next" chevron is visible', () => {
    it('then clicking it switches to after', async () => {
      const onSwitchSide = vi.fn();
      render(
        <FullscreenImageModal {...baseProps} currentSide="before" onSwitchSide={onSwitchSide} />,
      );
      await userEvent.click(screen.getByRole('button', { name: /next|after/i }));
      expect(onSwitchSide).toHaveBeenCalledWith('after');
    });
  });

  describe('Given currentSide="after" but beforeUrl is null', () => {
    it('then the "previous" chevron is not rendered', () => {
      render(
        <FullscreenImageModal {...baseProps} beforeUrl={null} currentSide="after" />,
      );
      expect(screen.queryByRole('button', { name: /previous|before/i })).toBeNull();
    });
  });
});
