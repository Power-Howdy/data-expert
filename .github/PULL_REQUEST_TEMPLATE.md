## What and why

<!-- What does this change, and why is it needed? Link the issue: Fixes #123 -->

## How it was tested

<!-- Commands run, manual steps, dataset sizes tried. Screenshots for UI changes. -->

## Checklist

- [ ] `cd backend && pytest` passes
- [ ] `cd frontend && npm run typecheck && npm run build` passes
- [ ] Tests added or updated for backend behavior changes
- [ ] React components are reusable and each component file has at most 100 lines
- [ ] No dataset rows are sent to AI providers (only schema, stats and truncated samples)
- [ ] Docs (`docs/`) and the in-app guide updated if behavior changed
- [ ] `CHANGELOG.md` updated under Unreleased
