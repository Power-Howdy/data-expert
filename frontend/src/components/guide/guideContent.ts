import {
  BarChart3, Combine, Download, FolderOpen, GitBranch, PenLine, Search, ShieldCheck, Sparkles, Table2, Wrench, type LucideIcon,
} from "lucide-react"

export interface GuideTopic {
  id: string
  title: string
  icon: LucideIcon
  intro: string
  /** Steps or tips, shown as a list. */
  points: string[]
  /** Tab that the "Open" button switches to. */
  tab?: string
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "start", title: "Getting started", icon: FolderOpen,
    intro: "Data Expert works on files in folders on this computer. Nothing is uploaded.",
    points: [
      "Click Choose folder in the sidebar and pick the folder that holds your data.",
      "The folder tree lists supported files: Parquet, CSV, TSV, JSON, JSON Lines, JSON.gz, Feather, Avro, ORC and Excel.",
      "Click a file to load it. Loaded datasets appear under Loaded; click one to work with it.",
      "Fold the Data folder section with its header to give the Loaded list more room.",
      "Large datasets under Loaded show two small icons: a magnifier when the file is indexed for searching and a lightning bolt when it is optimized for browsing. Faded means not yet; hover an icon for details. Small files don't need either, so they show none.",
      "Files are read lazily, so even multi-gigabyte files open quickly.",
    ],
  },
  {
    id: "browse", title: "Browsing rows", icon: Table2, tab: "browse",
    intro: "The Browse tab shows the rows of the selected dataset, page by page.",
    points: [
      "Click a row to open it in a side panel with every field, including nested lists and objects.",
      "Use Filters to keep only rows that match conditions on columns (equals, contains, greater than, empty, ...).",
      "Change the page size or move between pages at the bottom of the table.",
      "If pages deep in a large file load slowly, click Optimize for browsing. A copy with small blocks is built in the background (it needs up to the file's size on disk), and then every page loads instantly. Remove it any time.",
    ],
  },
  {
    id: "search", title: "Searching", icon: Search, tab: "browse",
    intro: "Click Search on the Browse tab to show the search box, type words and press Enter. Rows containing all the words are shown.",
    points: [
      "Search looks in every column, including text inside nested values, and ignores upper/lower case.",
      "Small files are searched directly and include your unsaved edits.",
      "Large files (over 256 MB) need a small search index (under 1/100 of the file), built once in the background on the first search. A ring next to the dataset in the sidebar shows its progress, and results appear automatically.",
      "On large files, a count like “1,234+” means counting stopped early to keep search fast; there are at least that many matches.",
      "The time in brackets after the count is how long the search took.",
      "For the fastest searches in a large file, also click Optimize for browsing: with it, even rare word combinations in millions of rows come back in about two seconds.",
      "Click Clear search to go back to all rows.",
    ],
  },
  {
    id: "edit", title: "Editing data", icon: PenLine, tab: "browse",
    intro: "Edits are kept as pending changes and shown everywhere, but the file on disk only changes when you save.",
    points: [
      "Open a row and click Edit to change fields, either one by one or as JSON in the editor. Delete removes the row.",
      "Add row creates a new row; Find & replace changes matching values in a column (contains, exact or regular expression).",
      "The bar above the table counts unsaved changes. Undo reverts the last one, Discard drops them all.",
      "Save to file writes the changes and records them as a new version (see Version history).",
    ],
  },
  {
    id: "ai", title: "AI assistant", icon: Sparkles, tab: "browse",
    intro: "Describe a change in plain words (\"keep rows from 2024, sorted by price\") and the assistant builds a plan of steps.",
    points: [
      "Review the plan, then run it to get a preview view of the result. Refine it with more instructions if needed.",
      "Apply turns the result into pending changes on the dataset; Save as dataset writes it to a new file instead.",
      "Configure the AI provider and model with the sparkle button in the top bar. Local servers (such as llama.cpp) and cloud providers are supported.",
      "The function library in AI settings lists every step the assistant can use, including ones it generated.",
    ],
  },
  {
    id: "tools", title: "Data tools", icon: Wrench, tab: "browse",
    intro: "Click Tools on the Browse tab to build the same kind of pipeline yourself, without AI.",
    points: [
      "Pick a category and a tool, fill in its settings and click Add step. Steps run in order; reorder or remove them with the buttons next to each step.",
      "Column settings list the columns as they will be at that step, so later steps can use columns that earlier steps create.",
      "A preview on the first 200 rows updates as you add steps and shows any problem, such as a missing setting.",
      "Run applies the steps to the whole dataset and opens the result as a view: apply it, save it as a dataset, or refine it with more steps or an AI prompt.",
    ],
  },
  {
    id: "stats", title: "Statistics", icon: BarChart3, tab: "analytics",
    intro: "The Stats tab profiles the selected dataset.",
    points: [
      "Overview: counts and memory use, donuts for column types, completeness and duplicates, and a quality map of every column (missing % against unique %).",
      "Column profiles pick a chart per column: a curve and box plot for numbers, a donut for few categories, a bar chart of top values otherwise.",
      "Click a column for details: histogram, cumulative share and box plot for numbers, with outliers plotted against their fences; ranked values and their share for text.",
      "Correlations rank the strongest column pairs and show a heatmap; Missing Values ranks columns by gaps and maps where they are.",
      "AI insights summarise the profile in plain language.",
    ],
  },
  {
    id: "history", title: "Version history", icon: GitBranch, tab: "history",
    intro: "Every Save to file becomes a version, similar to commits in git, so you can always go back.",
    points: [
      "The History tab lists versions with their message, author, row count and what changed.",
      "View opens a read-only copy of any version. Compare two versions to see row, column and value differences.",
      "Restore makes an earlier version current again; it is added as a new version, so nothing is lost.",
      "Tag versions you want to remember (for example the one used to train a model), or Save as to write a version to a new file.",
      "Row edits are stored as small differences, so history stays tiny even for huge files. Settings shows storage use and how many full snapshots to keep.",
      "Changing the file outside Data Expert is detected; versions before that change can no longer be rebuilt.",
    ],
  },
  {
    id: "export", title: "Exporting", icon: Download, tab: "export",
    intro: "The Export tab writes the selected dataset to another format.",
    points: [
      "Pick a format, the columns to include, compression and, for Parquet, partition columns.",
      "Export to file writes to the output path you enter (by default the backend's data_expert_exports folder); Stream download sends it straight to your browser.",
    ],
  },
  {
    id: "combine", title: "Combining datasets", icon: Combine, tab: "combine",
    intro: "The Combine tab merges several datasets into one, or splits one into several.",
    points: [
      "Concatenate stacks datasets on top of each other, matching columns by name.",
      "Join and Merge put datasets side by side using key columns (inner, left, right or full outer).",
      "Separate splits a dataset into files by the values of a column.",
    ],
  },
  {
    id: "privacy", title: "Privacy", icon: ShieldCheck,
    intro: "Your data stays on this computer.",
    points: [
      "Rows are never sent to AI providers. The assistant only receives column names, types, statistics and a few sample values, and its plans run locally.",
      "Use a local AI server to keep even that information on this computer.",
    ],
  },
]
