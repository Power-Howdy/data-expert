# Getting started

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.14+ | With `tkinter`, used for the native folder picker (included in the python.org installers) |
| Node.js | 24+ | npm comes with it |
| OS | Windows, macOS or Linux | The app needs a desktop session for the folder picker |

An AI provider is optional. Everything except the AI assistant and AI insights works without one.

## Install and run

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

The API listens on `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

The backend must be started from the `backend/` directory, because it reads `config.yaml` and stores its state
in `backend/.data_expert/` relative to the working directory.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

> **Corporate networks:** if `npm install` fails with certificate errors, let Node use the system certificate
> store: `NODE_OPTIONS=--use-system-ca npm install` (PowerShell: `$env:NODE_OPTIONS="--use-system-ca"`).

### One-command start

`start.sh` (macOS/Linux) and `start.bat` (Windows) create the virtual environment, install dependencies and start
both servers.

### Docker

```bash
docker compose up --build
```

Put datasets in a `data/` folder next to `docker-compose.yml`; it is mounted at `/data` in the backend container.
The native folder picker cannot open inside a container, so Docker is mainly useful for API development. Running
natively is recommended.

## First steps

1. Click **Choose folder** in the sidebar and select a folder that contains data files.
2. The folder tree lists supported files: Parquet, CSV, TSV, JSON, JSON Lines, JSON.gz, Feather, Avro, ORC and
   Excel.
3. Click a file to load it. It appears under **Loaded**; select it to open it.
4. Use the tabs in the top bar:
   - **Browse**: rows, filters, search, editing and the AI assistant
   - **Stats**: profile, distributions, correlations and AI insights
   - **History**: versions of the file
   - **Export** and **Combine**
5. The **?** button in the top bar (or **User guide** in the footer) opens the in-app guide.

## Optional: connect an AI provider

Click the sparkle button in the top bar. Pick a local server (Ollama, LM Studio, llama.cpp, vLLM, Jan, LocalAI)
or a cloud provider (OpenAI, Anthropic, Gemini, OpenRouter and more), enter the model and an API key if needed,
and click **Test connection**. See [AI assistant](ai-assistant.md).

## Next

- [User guide](user-guide.md)
- [Configuration](configuration.md)
- [Troubleshooting](troubleshooting.md)
