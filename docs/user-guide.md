# User guide

This guide walks through every part of the app. A shorter version is built into the app: click **?** in the top
bar or **User guide** in the footer.

- [Layout](#layout)
- [Opening data](#opening-data)
- [Browsing rows](#browsing-rows)
- [Searching](#searching)
- [Editing data](#editing-data)
- [AI assistant](#ai-assistant)
- [Statistics](#statistics)
- [Version history](#version-history)
- [Exporting](#exporting)
- [Combining and separating](#combining-and-separating)
- [Privacy](#privacy)

## Layout

- **Sidebar (left):**
  - The **Data folder** section holds the folder picker and the file tree. Click its header to fold it.
  - The **Loaded** section lists open datasets. While a search index is being built for a large file, a ring
    with a percentage appears next to it.
- **Top bar:** tabs (Browse, Stats, History, Export, Combine), AI settings (sparkle icon), the user guide (**?**)
  and the theme switch.
- **Footer:** app version, a privacy reminder, backend status (green dot when the API is reachable), the user
  guide and a link to the API docs.

## Opening data

1. Click **Choose folder** and select a folder. A native folder dialog opens on the machine that runs the
   backend.
2. The tree shows supported files with their size. Click a file to load it.
3. Loaded datasets are remembered across restarts of the backend.

Files are read lazily: opening a multi-gigabyte Parquet file reads only its metadata, and each page reads only the
rows it shows.

Supported formats:

| Format | Extensions | Read | Write |
|--------|------------|------|-------|
| Parquet | `.parquet` | ✓ | ✓ |
| CSV / TSV | `.csv`, `.tsv` | ✓ | ✓ |
| JSON | `.json` | ✓ | ✓ |
| JSON Lines | `.jsonl`, `.json.gz` | ✓ | ✓ |
| Feather / Arrow IPC | `.feather` | ✓ | ✓ |
| Avro | `.avro` | ✓ | ✓ |
| ORC | `.orc` | ✓ | ✓ |
| Excel | `.xlsx`, `.xls` | ✓ | ✓ |

## Browsing rows

The **Browse** tab shows rows page by page.

- **Open a row:** click it to see every field in a side panel, including nested lists and objects.
- **Filters:** click **Filters** and add conditions. Operators: equals, not equals, greater/less than (or equal),
  contains, starts with, ends with, in list, is null and is not null. All conditions must match.
- **Paging:** change the page size and move between pages at the bottom.
- **Optimize for browsing:** some large files load deep pages slowly: Parquet files written as one huge block of
  rows, and big CSV or JSON files. For these, the Browse tab offers **Optimize for browsing**. It builds a copy of
  the file with small blocks in the background (about a minute for 3 GB; it needs up to the file's size on disk,
  in `backend/.data_expert/browse_copies/`). After that, every page loads in a fraction of a second. The copy is
  rebuilt when you save changes and deleted when you unload the dataset or click **Remove**. Click **Not now** to
  hide the offer for that file.

## Searching

Click **Search** on the Browse tab to show the search box (click it again to hide it), type words and press
**Enter**. Rows that contain *all* the words, in any column, are shown. Hiding the box keeps the current results;
use **Clear search** to return to all rows.

- Search ignores upper and lower case and looks inside nested values.
- Files under 256 MB are scanned directly, and the results include your unsaved edits.
- Larger files are searched through an index that is built once, in the background, on the first search. The
  ring in the sidebar shows progress, and results appear automatically when the index is ready.
- If nothing matches exactly, close spellings (one typo) are tried.
- Click **Clear search** to return to all rows.

How this works: [Search](search.md).

## Editing data

Edits are *pending*: they show up everywhere in the app immediately, but the file on disk changes only when you
save.

- **Edit a row:** open it and click **Edit**. Change fields one by one or edit the whole row as JSON in the code
  editor.
- **Delete a row:** open it and click **Delete**.
- **Add row:** creates a new row at the end.
- **Find & replace:** replaces values in one column. Modes are *exact*, *contains* and *regex*, with an option for
  case sensitivity. **Preview** shows how many rows would change.
- **Pending changes bar:** appears above the table with a count of unsaved changes.
  - **Undo** reverts the last change.
  - **Discard** drops them all.
  - **Save to file** asks for a message, writes the file, and records a new version.

Saving writes to a temporary file first and swaps it in, so an interrupted save never leaves a half-written file.

## AI assistant

Open the assistant from the Browse tab and describe what you want in plain words, for example *"keep rows from
2024, sorted by price"* or *"add a column with the number of words in the review"*.

1. The assistant builds a **plan**: a list of steps from the function library, each with its parameters. If no
   existing function fits, it can write a new one; generated functions are checked before they are used.
2. Review the plan and click **Run**. The plan runs locally on the full dataset, with a progress bar, and opens
   as a preview **view**. The original file is not changed.
3. Refine the view with more instructions, or:
   - **Apply** turns the result into pending changes on the dataset, which you then save like any other edit.
   - **Save as dataset** writes the view to a new file.

Configure providers, the model and prompts with the sparkle button. The **Function library** panel lists every
step the assistant can use; generated functions can be deleted there.

Details: [AI assistant](ai-assistant.md).

## Statistics

The **Stats** tab profiles the selected dataset.

- **Overview:** rows, columns, memory, missing values and duplicates.
- **Columns:** type, null and unique counts, min/max/mean/median, top values and a distribution chart. Click a
  column for details and outliers.
- **Correlations:** a heatmap of numeric columns.
- **Missing values:** a matrix of gaps across columns.
- **AI insights:** a written summary of the profile, optionally focused on a topic.

Profiles of very large datasets are computed on a sample of 100,000 rows. Profiles and insights are cached and
reused until the file changes.

## Version history

Every **Save to file** becomes a version, like a commit in git.

- **Start tracking** on the History tab records the current file as the first version. Saving an edit also
  starts tracking automatically.
- The list shows each version's message, author, time, row count and what changed. The current version is marked.
- **View** opens a read-only copy of any version.
- **Compare** two versions to see row-count change, schema changes, the versions in between and, optionally, which
  rows were added and removed.
- **Restore** makes an earlier version current. It is added as a new version, so nothing is lost. Save or discard
  pending changes first.
- **Tag** versions you want to find later, for example the one used to train a model.
- **Save as** writes any version to a new file.
- **Settings** shows how much space history uses and how many full snapshots to keep.

If the file is changed outside Data Expert, the change is detected and recorded as an *external* version.
Versions before it can no longer be rebuilt, because the previous content is gone.

Design and storage format: [Version history](version-control.md).

## Exporting

The **Export** tab writes the selected dataset in another format.

1. Pick a format.
2. Choose the columns to include.
3. Set compression and, for Parquet, a partition column.
4. **Export to file** writes the file on the backend machine: to the output path you enter, or by default to
   `backend/data_expert_exports/`. **Stream download** sends it to your browser instead.

Recent exports are listed under **Export history**.

## Combining and separating

The **Combine** tab works with several loaded datasets.

- **Concatenate** stacks datasets on top of each other, matching columns by name.
- **Join** puts two datasets side by side on key columns (inner, left, right or full outer join).
- **Merge** outer-joins all selected datasets on common keys and fills gaps from whichever side has a value.
- **Preview** shows the first rows of the result before writing it.
- **Separate** splits one dataset into several files by the values of a column.

Results are written as new files and loaded automatically. Combined datasets go to `backend/data_expert_outputs/`;
separated files go to the output folder you choose.

## Privacy

Your data stays on your machine.

- Rows are never sent to AI providers in bulk. The assistant receives column names, types, summary statistics and
  a few truncated sample rows. The number of sample rows for plans is configurable and can be zero. Plans run
  locally.
- With a local AI server, even that information stays on your machine.
- AI settings, including API keys, are stored in `backend/.data_expert/ai_settings.json` and are never returned to
  the browser.

See [AI assistant: privacy](ai-assistant.md#privacy).
