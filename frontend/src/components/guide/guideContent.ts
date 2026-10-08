import {
  BarChart3, Combine, Download, FolderOpen, GitBranch, PenLine, Search, ShieldCheck, Sparkles, Table2, type LucideIcon,
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
    ],
  },
  {
    id: "search", title: "Searching", icon: Search, tab: "browse",
    intro: "Type words in the search box on the Browse tab and press Enter. Rows containing all the words are shown.",
    points: [
      "Search looks in every column, including text inside nested values, and ignores upper/lower case.",
      "Small files are searched directly and include your unsaved edits.",
      "Large files (over 256 MB) need a search index, built once in the background on the first search. A ring next to the dataset in the sidebar shows its progress, and results appear automatically.",
      "If nothing matches exactly, close spellings are tried (for example a single typo).",
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
    id: "stats", title: "Statistics", icon: BarChart3, tab: "analytics",
    intro: "The Stats tab profiles the selected dataset.",
    points: [
      "See row and column counts, memory use and missing values at a glance.",
      "Each column shows its type, distinct values, top values and a distribution chart; click a column for details and outliers.",
      "The correlation heatmap and missing-value matrix show relationships and gaps across columns.",
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
      "Export to file writes next to the data; Stream download sends it straight to your browser.",
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
