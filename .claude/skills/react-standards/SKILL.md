---
name: react-standards
description: React code standards and architectural patterns for writing clean, maintainable React components. Use when creating new React components, pages, modals, or hooks, or when refactoring existing React code.
---

# React Code Standards

Follow these patterns when writing React code. When editing existing files, match the surrounding style but apply these patterns to all new code you add.

---

## 1. File Naming Conventions

| Type | Suffix | Example |
|:---|:---|:---|
| Component | `.tsx` | `SettingsItem.tsx` |
| Page | `.page.tsx` | `TeamSettings.page.tsx` |
| Route | `.route.tsx` | `TeamSettings.route.tsx` |
| Hook | `use[Name].ts` | `useRecordingUrlState.ts` |
| Styled (extracted) | `.css.tsx` | `SettingsItem.css.tsx` |
| Utils | `.utils.ts` | `recording.utils.ts` |
| Constants | `.constants.ts` | `recording.constants.ts` |

**Notes:**
- Components do NOT need a `.component` suffix — `.tsx` is sufficient.
- Use `.css.tsx` (not `.css.ts`) — allows JSX in styled components (e.g., providing a default `type` prop to a `styled.button`).
- Modals are just components — no special `.modal.tsx` suffix needed.

---

## 2. Feature-Based Folder Structure

Co-locate everything that belongs to a feature. Only truly shared/reusable code goes in global directories.

```
TeamSettingsRecordingLinks/
├── TeamSettingsRecordingLinks.page.tsx      # Page component (orchestrates data + layout)
├── TeamSettingsRecordingLinks.css.tsx       # Extracted styles (only if file grew large)
├── TeamSettingsRecordingLinks.route.tsx     # Route definition
├── components/
│   ├── SettingsItem.tsx                     # Feature-private component
│   ├── HighlightedCode.tsx
│   └── VerifySetupModal.tsx                 # Modal is just a component
├── hooks/                                   # Only if hooks outgrew their component files
│   ├── useRecordingUrlsState.ts
│   ├── useRecordingUrlCreate.ts
│   └── useRecordingUrlSubscription.ts
├── constants.ts
└── utils.ts
```

**Rule:** If a component/hook/util is only used within one feature, it stays in that feature's folder. If multiple features need it, move it to a shared location.

---

## 3. Component Declaration

Use arrow functions with explicit props typing:

```tsx
import React from "react";
import { observer } from "mobx-react-lite";
import styled from "@emotion/styled";

interface TeamMemberCardProps {
  member: TeamMember;
  onRemove?: (memberId: string) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = observer(({ member, onRemove }) => {
  return (
    <Container>
      <Name>{member.name}</Name>
      <RemoveButton onClick={() => onRemove?.(member.id)}>Remove</RemoveButton>
    </Container>
  );
});

// Styled components co-located below the component
const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
`;

const Name = styled.span`
  font-weight: 500;
`;

const RemoveButton = styled.button`
  margin-left: auto;
  color: var(--red-11);
`;
```

**Rules:**
- Always create a named `interface ComponentNameProps` — even for simple components. Components grow over time.
- Use `observer()` wrapper when the component reads MobX observables.
- Destructure props in the function signature for readability.

---

## 4. Styled Components — Co-locate by Default

**Default: styles live in the same file**, defined below the component code.

```tsx
// TeamMemberCard.tsx — small component, styles co-located

export const TeamMemberCard: React.FC<Props> = ({ member }) => {
  return (
    <Card>
      <Avatar src={member.avatar} />
      <Name>{member.name}</Name>
    </Card>
  );
};

const Card = styled.div`
  display: flex;
  gap: 8px;
`;

const Avatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
`;

const Name = styled.span`
  font-weight: 500;
`;
```

### When to extract to a `.css.tsx` file

Extract styled components to a separate file when:
- The component file grows beyond **~300 lines** — start considering extraction
- At **~500 lines** — prioritize splitting styles out
- Styles are **reused by multiple components**

When extracted, use the `import * as S` pattern:

```tsx
// TeamSettings.css.tsx
import styled from "@emotion/styled";

export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 640px;
`;

export const Header = styled.div`
  margin-bottom: 24px;
`;
```

```tsx
// TeamSettings.page.tsx
import * as S from "./TeamSettings.css";

export const TeamSettingsPage: React.FC<Props> = observer(({ team }) => {
  return (
    <S.PageContainer>
      <S.Header>...</S.Header>
    </S.PageContainer>
  );
});
```

**Important:** Prefer `@jam/ds/base` primitives (`Flex`, `Box`, `Text`) over creating styled wrappers for simple layout needs — only create styled components when you need custom or complex styling.

---

## 5. Hooks — Co-locate, Then Extract

### Start co-located

When a hook is small and only used by one component, define it in the same file:

```tsx
// TeamSettings.page.tsx

const useTeamSettingsState = ({ teamId }: { teamId: string }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // fetch logic
  }, [teamId]);

  return { settings, isLoading };
};

export const TeamSettingsPage: React.FC<Props> = observer(({ team }) => {
  const { settings, isLoading } = useTeamSettingsState({ teamId: team.id });
  // ...
});
```

### When to extract to separate files

- The component file grows large (~300+ lines)
- The hook is reused by other components
- There are multiple hooks and the file becomes hard to navigate

When extracting, ask: *"Where should this logic live? Can it move to a sibling module, or a shared ancestor? What other utilities does it resemble?"*

### Hook Naming Convention

| Purpose | Pattern | Example |
|:---|:---|:---|
| State management | `use[Entity]State` | `useRecordingUrlsState` |
| Actions/mutations | `use[Entity][Action]` | `useRecordingUrlCreate` |
| Subscriptions | `use[Entity]Subscription` | `useRecordingUrlSubscription` |

### Compose multiple hooks

Prefer composing multiple focused hooks over stuffing all state into one:

```tsx
// Good — multiple focused hooks
export const TeamSettingsPage: React.FC<Props> = observer(({ team }) => {
  const { settings, isLoading } = useTeamSettingsState({ teamId: team.id });
  const { handleUpdate } = useTeamSettingsUpdate({ teamId: team.id });
  const { members } = useTeamMembersState({ teamId: team.id });

  return (
    <PageContainer>
      <SettingsForm settings={settings} onUpdate={handleUpdate} />
      <MembersList members={members} />
    </PageContainer>
  );
});
```

---

## 6. Page vs Component

| Type | Suffix | Responsibility |
|:---|:---|:---|
| **Page** | `.page.tsx` | Route-level. Orchestrates data fetching (via hooks) and layout. Composes components. |
| **Component** | `.tsx` | Focused UI. Receives data via props. Handles presentation and local interactions. |
| **Route** | `.route.tsx` | Route definition and configuration (path, guards, lazy loading). |

---

## 7. Heuristics for Splitting Files

Rather than rigid rules, use these heuristics to decide when to split:

> **~300 lines**: Start exploring how the file might be split into 2–3 smaller files. Should the hooks live separately? The styled components?

> **~500 lines**: Prioritize splitting. Look for clear boundaries between logic, presentation, and styling.

> **When something gets reused**: Ask where the logic should live. Can it move to a sibling module or shared ancestor? How can we improve the design for composability?

The goal is a small, intentional set of shared hooks/components/utils — not a sprawling collection of one-off exports.
