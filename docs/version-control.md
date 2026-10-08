# Version history

Data Expert has built-in, git-like version control for data files. Every save is a commit; any earlier version
can be viewed, compared, exported or restored.

Code: `backend/app/services/versioning/`. API: `/api/datasets/{id}/versions` (see the
[API reference](api-reference.md#version-history)).

## Why not DVC or git LFS?

Those tools version whole files. Every change to a 10 GB file stores another 10 GB, or uploads it to a remote.
Data Expert edits are usually a handful of rows, so it stores *what changed*: a few kilobytes per edit, whatever
the file size. Full copies are kept only when a change rewrites the data (a transform), and they are hardlinks of
the replaced file, so taking them copies nothing.

## Model

- **The data file is always the newest version.** History stores only what is needed to go backwards.
- **History is linear.** There are no branches; a restore adds a new commit on top.
- **Commit kinds:**

| Kind | Created when |
|------|--------------|
| `baseline` | Tracking starts (**Start tracking**, or the first save) |
| `edit` | Pending changes are saved |
| `restore` | An earlier version is restored |
| `external` | The file changed outside Data Expert (detected by size and modification time) |

- **Undo kinds**, which describe how the *parent* version is rebuilt from a commit:

| Undo | Used for | Stored |
|------|----------|--------|
| `delta` | Row edits (add, update, delete, replace) | Deleted rows and old values of changed cells, as Parquet |
| `snapshot` | Transforms, which can change every row | A full copy of the parent: a hardlink of the replaced file |
| `replay` | Restores where every later commit is an edit | Nothing extra; the forward operations are replayed |
| `none` | Baselines and external changes | Nothing; the previous content is gone |

## On-disk layout

History lives next to the data, like a `.git` folder:

```
<data folder>/
  reviews.parquet                      ← current version
  .data-expert-history/
    reviews.parquet/
      history.json                     ← commits (oldest first), head, tags, settings
      ops/<commit>.json                ← forward operations of the commit
      undo/<commit>/deleted.parquet    ← rows the commit deleted
      undo/<commit>/cells.parquet      ← old values of cells it changed
      snapshots/<commit>.parquet       ← full parent copy (hardlink), for transforms
```

Moving or copying the data folder keeps its history. Deleting `.data-expert-history/<file>/` (or **Delete
history** in the History settings) removes it.

`history.json` is plain JSON (`format: 1`) and can be inspected by hand. Each commit records its id, parent, kind,
message, author, time, row count, size, columns, change statistics, the first change labels, the file fingerprint
and its undo information.

## Rebuilding a version

`Rebuilder.frame(commit_id)` returns a lazy frame of any version:

1. Find the nearest version at or after the target whose data exists as a file: the live file or a snapshot.
2. Walk back one commit at a time, applying each commit's reverse delta (re-insert deleted rows at their positions,
   restore old cell values, drop added rows) or replaying its operations.
3. A commit with undo `none` stops the walk: versions before an external change cannot be rebuilt and are shown
   as unavailable.

Only the rows needed are read, so viewing a page of an old version of a large file stays fast.

## Operations

| Action | What happens |
|--------|--------------|
| **Commit** | See [Editing: saving](editing.md#saving-commit) |
| **View** | `GET /versions/{ref}/rows` pages through a rebuilt version, read-only |
| **Compare** | `GET /versions/diff?a=&b=` returns row-count change, schema changes and the commits in between. With `rows=true` it also counts rows only in one side (by row hash, over shared columns) and returns samples |
| **Restore** | Rebuilds the version, writes it as the new file and adds a `restore` commit. Refused while pending changes exist |
| **Tag** | Names a commit; tags work anywhere a version ref is accepted |
| **Save as** | Writes a version to a new file (Parquet, JSONL, CSV, JSON) and loads it |
| **Settings** | `keep_snapshots` (default 5, 0–100): older snapshots are pruned |

A *ref* is a commit id, a unique id prefix of at least 4 characters (like git), or a tag name.

## Storage and pruning

Row-edit commits cost kilobytes. Snapshots cost nothing extra while the data file and the snapshot share disk
blocks through the hardlink. They only take real space once the data file has been rewritten again. Only the most
recent `keep_snapshots` snapshots are kept; when an older one is pruned, versions that needed it become
unavailable. The History settings panel shows total and per-commit storage.

On file systems without hardlinks, snapshots fall back to a full copy.

## Limits

- One writer at a time: all version operations on a dataset are serialized with a lock.
- Changing the file outside the app is safe but cuts history at that point.
- History follows the file name. Renaming a file outside the app starts a new history.
