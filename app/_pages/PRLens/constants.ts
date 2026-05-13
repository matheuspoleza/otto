import type { ComponentType } from 'react';
import { Bell, FileText, FlaskConical, MessageSquare } from 'lucide-react';
import type { ActionIconKind } from '@/app/_lib/types';

export const ACTION_ICON: Record<ActionIconKind, ComponentType<{ className?: string }>> = {
  doc: FileText,
  bell: Bell,
  flask: FlaskConical,
  chat: MessageSquare,
};
