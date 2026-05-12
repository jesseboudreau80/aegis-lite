# Issue: Improve mobile responsiveness of app navigation

**Labels:** `good-first-issue` · `frontend` · `enhancement`

## Description

The `AppNav` component renders a horizontal list of nav links that overflows on mobile screens. On small viewports (< 640px), the navigation is cramped and some labels are invisible or clipped. Several pages also need better mobile layout handling.

## Current problems

1. `AppNav` wraps awkwardly on screens < 640px — labels are hidden with `hidden sm:block` but the icons still crowd together
2. The chat page sidebar is hidden on mobile but has no accessible way to open it on small screens
3. The dashboard metric cards are 3-column on all sizes — should stack to 1 column on mobile
4. The governance dashboard 5-column layout breaks on tablet

## Acceptance criteria

- [ ] On mobile (< 640px): AppNav shows only icons, no labels — tap icon to navigate
- [ ] On mobile: active route icon has a visible indicator (dot or highlight)
- [ ] Chat page: sidebar has a working mobile drawer triggered by a hamburger button
- [ ] Dashboard: metric cards are `grid-cols-1 sm:grid-cols-3`
- [ ] Governance: two-column layout stacks to single column on < 768px
- [ ] Audit explorer: table has horizontal scroll on mobile, detail panel is full-screen
- [ ] All changes verified at 375px, 768px, and 1280px viewport widths

## Implementation notes

The `compact` prop already exists on `AppNav` but is unused. Wire it up:

```tsx
// AppNav: when compact=true, render only icons
{!compact && <span>{label}</span>}

// Page headers: pass compact on mobile
<AppNav compact={isMobile} currentPage="/dashboard" />
```

Use `useEffect` + `window.innerWidth` or a Tailwind responsive breakpoint utility to detect mobile.

For the chat sidebar: a slide-over using CSS transform + transition, toggled by a hamburger button. No animation library needed.

## Suggested files to modify

- `frontend/components/AppNav.tsx`
- `frontend/app/chat/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/governance/page.tsx`
- `frontend/app/governance/audit/page.tsx`

## Testing

Chrome DevTools → Device toolbar. Test at:
- iPhone SE (375×667)
- iPad (768×1024)
- Desktop (1440×900)
