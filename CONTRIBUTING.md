# Contributing to Data Expert

Thanks for your interest in improving Data Expert! Bug reports, feature ideas, documentation fixes and code are all
welcome.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug:** open an issue with the bug report template. Include steps to reproduce, the dataset format
  and approximate size, your OS, and the backend log or browser console output. Please do not attach private data.
- **Suggest a feature:** open an issue with the feature request template and describe the problem you want
  solved.
- **Improve docs:** everything under [`docs/`](docs/README.md), plus the in-app guide in
  `frontend/src/components/guide/guideContent.ts`.
- **Write code:** pick an open issue (look for `good first issue` or `help wanted`), or open an issue first for
  larger changes so the approach can be agreed before you invest time.

Security problems should be reported privately; see [SECURITY.md](SECURITY.md).

## Development setup

See [docs/development.md](docs/development.md). In short:

```bash
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python -m app.main
cd frontend && npm install && npm run dev
```

## Before you open a pull request

1. Create a branch from `main`.
2. Make focused changes. One logical change per pull request is easiest to review.
3. Run the checks:

   ```bash
   cd backend && pytest
   cd frontend && npm run typecheck && npm run build
   ```

4. Add or update tests for backend behavior changes.
5. Update the documentation and the in-app guide if user-visible behavior changes.
6. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
7. Fill in the pull request template, with screenshots for UI changes.

## Project rules

These keep the codebase consistent; reviewers will ask for them.

**Frontend**

- All React components are reusable: data and callbacks come in through props, feature logic lives in hooks.
- No React component file is longer than 100 lines. Split components and move logic into hooks.
- All HTTP calls go through `frontend/src/lib/*Api.ts`.

**Backend**

- Keep data lazy (Polars `LazyFrame`); never collect a full dataset in a request path.
- Pydantic models for every request and response; thin routes, logic in services.
- Write files atomically (temporary file, then `os.replace`).
- **Never send dataset rows to AI providers.** Only schema, statistics and the configured, truncated samples. Any
  change to prompts or context building needs a test.

More detail: [docs/development.md](docs/development.md) and [docs/frontend.md](docs/frontend.md).

## Commit messages

Write a short imperative subject (`Fix restore of empty files`), and explain *why* in the body when it is not
obvious. Conventional prefixes (`feat:`, `fix:`, `docs:`) are welcome but optional.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
