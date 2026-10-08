# Frontend guide

React 18, TypeScript, Vite 5, Tailwind CSS 3, Radix UI primitives, zustand, axios, TanStack Query and Table,
Recharts, CodeMirror 6 and lucide-react icons.

## Rules

These rules are enforced in review and are also in [CLAUDE.md](../CLAUDE.md):

1. **Every React component is reusable.** It takes its data and callbacks as props and does not reach into
   unrelated feature state. Feature wiring lives in hooks (`useXxx.ts`) and the feature's tab component.
2. **No component file is longer than 100 lines.** Split large components into smaller ones, and move logic into
   hooks or plain modules. Hooks and `.ts` modules are not bound by the limit but should stay focused.

## Layout

```
frontend/src/
├── main.tsx, App.tsx          app shell: sidebar, header, active tab, footer, AI settings panel
├── index.css                  Tailwind layers and theme variables (light/dark)
├── components/
│   ├── ui/                    thin wrappers of Radix primitives (button, card, select, tabs, ...)
│   ├── common/                reusable building blocks (Modal, EmptyState, ProgressBar, CircularProgress,
│   │                          CollapsibleSection, CodeEditor, LoadingButton, StatCard, Pager, ...)
│   ├── sidebar/               folder picker, directory tree, loaded datasets
│   ├── browse/                table, filters, search, record drawer/editor, pending changes, AI assistant
│   ├── analytics/             overview, column profiles, charts, correlations, AI insights
│   ├── history/               version list, preview, diff, settings, dialogs
│   ├── export/, combine/      export options; combine and separate
│   ├── settings/              AI providers, model, prompts, function library
│   ├── guide/                 in-app user guide (content in guideContent.ts)
│   ├── Header.tsx, AppFooter.tsx
├── hooks/                     cross-feature hooks (useSelectedDataset, useIndexingPoll, useBackendHealth)
├── lib/                       api.ts, editApi.ts, aiApi.ts, versionApi.ts, utils.ts, download.ts, reloadDataset.ts
├── stores/                    zustand stores
└── types/                     index.ts (core), ai.ts, version.ts
```

## Patterns

### A feature = tab + hook + small components

```
HistoryTab.tsx          composes the feature; little logic
useVersionHistory.ts    loads data, exposes actions, handles errors and toasts
CommitItem.tsx          presentational; props in, callbacks out
```

### State

| Store | Contents | Persisted |
|-------|----------|-----------|
| `useStore` | datasets, selected dataset, directory tree, current folder, sidebar state | partly (`data-expert-store`) |
| `useUIStore` (in `useStore.ts`) | theme, active tab | yes (`data-expert-ui`) |
| `useEditStore` | pending-change summaries per dataset | no |
| `useAIStore` | AI settings, settings panel visibility | no |
| `useIndexingStore` | search index builds in progress, for the sidebar rings | no |

Component-local state stays in components or feature hooks; only cross-feature state goes into stores.

### API calls

All HTTP goes through `src/lib/*Api.ts` (axios). Long-running calls (search, AI planning) pass `timeout: 0`.
Errors surface as toasts (`react-hot-toast`) with the backend's `detail` message.

Polling, rather than WebSockets, is used for progress:

- search index builds every 1.5 s (`useSearch`, `useIndexingPoll`);
- AI jobs (`useAITransform`);
- backend health every 15 s and on window focus (`useBackendHealth`).

### Styling

- Tailwind utility classes; `cn()` from `lib/utils.ts` merges them.
- Theme colors are CSS variables in `index.css` (`--primary`, `--card`, `--border`, ...), with a `.dark` variant.
- Icons come from `lucide-react` (version 0.303: some newer icon names such as `CircleHelp` do not exist; use
  `HelpCircle`).

### Adding a tab

1. Create `components/<feature>/<Feature>Tab.tsx` and its hook.
2. Render it in `App.tsx` under its `activeTab` key.
3. Add the tab button in `Header.tsx`.
4. Add a topic to `components/guide/guideContent.ts` with `tab: "<key>"`.

## Commands

```bash
npm run dev         # dev server on 127.0.0.1:5173
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production build to dist/
npm run preview     # serve the production build
```

On networks that intercept TLS, set `NODE_OPTIONS=--use-system-ca` before `npm install`.
