# Editing and pending changes

Data Expert edits files that can be far larger than memory. It never loads a whole file to show or save an edit.
Instead, edits are recorded as operations and applied lazily on top of the dataset's Polars `LazyFrame`.

Code: `backend/app/services/changes.py` and `backend/app/services/manipulation.py`.

## Row identity

Every row gets a hidden id column, `__dx_row`:

- Rows of the source file are numbered by their position in the file.
- Added rows get ids starting at `2^40`, so they never collide with file rows.
- A transform can reorder, drop or aggregate rows, so it renumbers them. Edits recorded after a transform refer to
  the new numbering.

The API exposes this id as `RowData.id`.

## Operations

Pending edits are a list of operations per dataset, kept in memory by `ManipulationEngine`:

| Type | Fields | Recorded by |
|------|--------|-------------|
| `add` | `id`, `values` | `POST /rows` |
| `update` | `id`, `values` (changed fields only) | `PUT /rows/{row_id}` |
| `delete` | `id` | `DELETE /rows/{row_id}` |
| `replace` | `column`, `find`, `replace`, `mode` (`exact`, `contains`, `regex`), `case_sensitive` | `POST /replace` |
| `transform` | `steps` (function-library calls), `functions` (embedded generated specs), `description` | `POST /transform`, `POST /views/{id}/apply` |

Edited values are converted to the column type (`coerce`); a value that does not fit, for example `"abc"` in an
integer column, is rejected with a readable error.

A transform embeds the full specs of any generated functions it uses. The step therefore replays the same way even
if the function is later changed or deleted from the library.

## Applying operations lazily

`apply_changes(lf, ops)` builds a lazy query:

1. Add the `__dx_row` column.
2. Collect consecutive updates and deletes in dictionaries. Several edits to the same row merge into one, and a
   delete cancels earlier updates of that row.
3. Flush them as one filter (deletes) plus one left join against a small frame of new values (updates). A
   per-column "was set" flag lets an update set a value to null.
4. `add`, `replace` and `transform` flush pending updates first, then apply their own expression.

Because the result is still a `LazyFrame`, paging, filtering, search (for small files), profiles and exports all
see pending edits, and Polars only reads what each query needs.

## Undo and discard

- `POST /changes/undo` removes the last operation.
- `POST /discard` clears all of them.
- `GET /changes` summarizes counts by type and lists recent changes with labels.

Pending edits live in memory; they are lost if the backend restarts.

## Saving (commit)

`POST /api/datasets/{id}/commit` with an optional `{"message": "..."}`:

1. Drops the dataset's search index (Windows cannot replace files that are open).
2. Calls `VersionControl.commit_edits`, which:
   - creates a baseline version if the file is not tracked yet, or records an external version if the file
     changed on disk since the last known version;
   - computes the reverse delta (deleted rows and old values of changed cells) for row edits, or marks the commit
     as needing a snapshot for transforms;
   - streams the edited data to a hidden temporary file next to the original (`.<name>.dx-tmp<suffix>`), using
     Polars sinks where the format supports them;
   - hardlinks the current file into the history folder as a snapshot when needed;
   - replaces the original with `os.replace` (atomic on the same file system);
   - records the commit and prunes old snapshots.
3. Clears pending edits, drops AI views of the dataset and reloads it.

If anything fails before the rename, the original file is untouched and the temporary file is removed.

See [Version history](version-control.md) for the history format.

## Save as a new file

`POST /api/datasets/{id}/save-as` writes the dataset (or an AI view, optionally filtered) to a new file in
Parquet, JSONL, CSV or JSON, then loads it. It refuses to overwrite an existing file unless `overwrite` is true.
