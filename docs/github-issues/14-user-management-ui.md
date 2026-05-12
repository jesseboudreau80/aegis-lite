# Issue: Add user management UI for admins

**Labels:** `enhancement` · `frontend` · `backend` · `dashboard`

## Background

Admins can currently manage users via the API (`GET /users`, `PATCH /users/{id}/budget`, `POST /users/{id}/reset-usage`, `PATCH /users/{id}/training`), but there's no UI for these operations. Creating new users, adjusting budgets, and marking training as complete all require direct API calls — which is a barrier for non-technical administrators.

## Acceptance criteria

- [ ] New page at `/admin/users` (admin-only route)
- [ ] Table showing all users: name, email, role, budget, current usage, training status
- [ ] Inline budget editing: click a budget value → editable input → save on blur or Enter
- [ ] "Reset usage" button per user (with confirmation dialog)
- [ ] "Mark training complete" action per user
- [ ] "Invite user" flow: email input → calls `POST /auth/magic-link` to send a login link → shows the link in dev mode
- [ ] Pagination (25 users per page)
- [ ] Search/filter by email or role
- [ ] Route added to AppNav under admin section as "Users"

## Backend changes required

None — all required endpoints already exist:

- `GET /users` — list all users
- `PATCH /users/{id}/budget` — update monthly budget
- `POST /users/{id}/reset-usage` — reset spend to $0
- `PATCH /users/{id}/training` — mark training complete
- `POST /auth/magic-link` — send invite link

May need a `POST /users` endpoint for admin-created users with a specified role and budget.

## Design notes

Match the existing dark-theme design system. Use `card`, `badge`, `stat-label`, `input-base` CSS classes from `globals.css`. The budget inline-edit should feel like a spreadsheet cell — click to activate, typed value, keyboard confirm.

Confirmation dialogs for destructive actions (reset-usage) should be a simple inline confirmation ("Are you sure? This cannot be undone" + Confirm / Cancel buttons) — not a modal.

## Suggested files to create/modify

- `frontend/app/admin/users/page.tsx` (create)
- `frontend/lib/api.ts` — verify all user management methods are present
- `frontend/components/AppNav.tsx` — add "Users" link to admin nav
- `backend/routes/users.py` — add `POST /users` if missing
