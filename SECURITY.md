# Security policy

## Supported versions

Security fixes are made on the latest release and the `main` branch.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on the repository page (private
vulnerability reporting). Include:

- a description of the issue and its impact;
- steps to reproduce or a proof of concept;
- affected version or commit.

You should receive an acknowledgement within a few days. We will keep you informed while a fix is prepared, and
credit you in the release notes unless you prefer otherwise.

## Security model

Data Expert is a **local, single-user tool**. Please read this before deploying it anywhere else.

### The API is unauthenticated and has file-system access

The backend can list folders and read, write and replace any file the backend process can access. It has no
authentication or authorization.

- Run it on your own machine and bind it to localhost: set `server.host: "127.0.0.1"` in `backend/config.yaml`.
  The shipped default `0.0.0.0` listens on all network interfaces.
- Do not expose port 8000 to the internet or to untrusted networks.
- Keep `server.cors_origins` limited to the frontend's origin.
- Run the backend as a regular user, not as root or Administrator.

### Generated code sandbox

The AI assistant can write new data functions. They are AST-checked (no imports, no I/O, no dunder access,
restricted builtins) and tested on a sample before use. This guards against model mistakes. **It is not a hardened
sandbox** against a deliberately malicious author. Only use AI providers you trust, and review generated
functions in the Function library panel.

### API keys

AI provider keys are stored in plain text in `backend/.data_expert/ai_settings.json` and are never returned to the
browser. Protect the file with OS permissions. It is in `.gitignore`; never commit it. Alternatively, supply keys
through environment variables (see [docs/configuration.md](docs/configuration.md)).

### Data sent to AI providers

Dataset rows are never sent in bulk. Prompts contain the schema, summary statistics and a few truncated sample
rows. For sensitive data, use a local model server, or set **Sample rows** to 0 in AI settings. Details:
[docs/ai-assistant.md](docs/ai-assistant.md#privacy).
