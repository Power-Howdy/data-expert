# Troubleshooting

## The footer shows the backend as offline

- Is the backend running? Start it from `backend/` with `python -m app.main`.
- Is port 8000 taken by another process (vLLM also defaults to 8000)? Free the port or change `server.port` in
  `config.yaml` and `VITE_API_URL` in `frontend/.env.development`.
- Browser console shows CORS errors: add the frontend's origin (exactly as in the address bar, including
  `localhost` vs `127.0.0.1`) to `server.cors_origins`.

## "Folder picker unavailable"

The folder dialog uses `tkinter` on the backend machine.

- Linux: install it (`sudo apt install python3-tk`).
- macOS with Homebrew Python: `brew install python-tk`.
- The dialog cannot open inside Docker or over SSH without a display; run the backend natively.

## `npm install` fails with certificate errors

Behind a TLS-inspecting proxy, use the system certificate store:

```bash
NODE_OPTIONS=--use-system-ca npm install          # bash
$env:NODE_OPTIONS="--use-system-ca"; npm install  # PowerShell
```

## Large responses hang in development

Vite 5's dev proxy can stall on large responses under Node 24. `frontend/.env.development` points the app directly
at `http://127.0.0.1:8000/api` to avoid it. Keep that file, and make sure `cors_origins` includes
`http://127.0.0.1:5173`.

## Search on a large file returns nothing at first

Files of 256 MB or more need an index. The first search starts building it; watch the ring next to the dataset in
the sidebar. Results appear automatically when it finishes. A multi-gigabyte file can take several minutes. If the
backend restarts during a build, the next search starts over.

"Large files are searched as saved on disk": a pending AI transform cannot be overlaid on index results. Save or
discard it, then search again.

## Saving fails with "file in use" (Windows)

Windows cannot replace a file that another program has open. Close viewers or editors holding the file (Excel is a
common one) and try again.

## A version is shown as unavailable

- The file was changed outside Data Expert after that version (an *external* commit), so earlier content is gone.
- Or a snapshot it needed was pruned. Increase **Snapshots to keep** in History settings to keep more in the
  future.

## The AI assistant fails

| Message | Fix |
|---------|-----|
| "AI is not configured" | Open AI settings, choose a provider and model, add an API key for cloud providers |
| "Could not reach …" | Check that the server is running and the base URL ends in `/v1` (or the provider's documented path) |
| "did not answer within N s" | Increase the timeout in AI settings, or use a smaller/faster model |
| "did not return valid JSON" | Use a stronger model, or turn on JSON mode if the server supports it |
| Very slow local reasoning model | Keep **Disable thinking** on |
| Plan check errors (unknown column, missing parameter) | Rephrase the request with exact column names |

## Edits disappeared after a restart

Pending changes are kept in memory until you click **Save to file**. Save before restarting the backend.

## Reset the app

Stop the backend and delete `backend/.data_expert/`. This resets loaded datasets, AI settings (including keys),
generated functions, caches and search indexes. Data files and their version history are not affected.
