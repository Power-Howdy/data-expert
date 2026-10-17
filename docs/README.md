# Data Expert documentation

Data Expert is a local-first workbench for exploring, editing, versioning and transforming datasets of any size,
from a few kilobytes to many gigabytes. It runs entirely on your machine: a Python backend reads your files with
Polars and a React frontend shows them in the browser.

## For users

| Guide | What it covers |
|-------|----------------|
| [Getting started](getting-started.md) | Install, run, and open your first dataset |
| [User guide](user-guide.md) | Every tab and feature, step by step |
| [AI assistant](ai-assistant.md) | Providers, plans, generated functions, insights, privacy |
| [Version history](version-control.md) | Commits, compare, restore, tags, storage |
| [Search](search.md) | How search works on small and very large files |
| [Configuration](configuration.md) | `config.yaml`, environment variables, where state is stored |
| [Troubleshooting](troubleshooting.md) | Common problems and fixes |

## For developers

| Guide | What it covers |
|-------|----------------|
| [Architecture](architecture.md) | Components, data flow, design principles |
| [Editing and pending changes](editing.md) | How edits stay lazy and are written safely |
| [API reference](api-reference.md) | Every REST endpoint |
| [Frontend guide](frontend.md) | Structure, state, component rules |
| [Development](development.md) | Local setup, tests, code style, adding features |
| [Libraries](libraries.md) | Notable libraries, versions, licenses and what each is used for |

## Project

- [Contributing](../CONTRIBUTING.md)
- [Code of conduct](../CODE_OF_CONDUCT.md)
- [Security policy](../SECURITY.md)
- [Changelog](../CHANGELOG.md)
- [Original design spec (archived)](archive/original-spec.md)
