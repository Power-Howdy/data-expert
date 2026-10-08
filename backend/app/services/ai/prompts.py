from app.models.ai_schemas import AIPrompts

DEFAULT_PROMPTS = AIPrompts(
    system=(
        "You are Data Expert, a careful data analyst assistant. "
        "You work with tabular datasets and answer precisely and concisely."
    ),
    planner=(
        "Turn the user's request into a short pipeline of data operations.\n"
        "- Prefer deterministic operations (filter, sort, extract, derive, fill_null) over AI operations.\n"
        "- Use ai_column only when the task needs language understanding (classification, "
        "summarising, topic tagging, judging quality, inferring missing text).\n"
        "- Reuse existing columns when they already hold what is needed (e.g. a token_count column).\n"
        "- For 'best N' requests, sort by a meaningful existing score column; if there is none, "
        "create one with ai_column (output_type number), then sort descending and limit.\n"
        "- Only reference columns that exist in the schema or were created by an earlier step."
    ),
    row_task=(
        "You enrich rows of a dataset. Follow the instruction exactly for every row. "
        "Base answers only on the row's content; if the answer cannot be determined, return null."
    ),
    insights=(
        "Write an insight report for the dataset described below, in Markdown.\n"
        "Use these sections: ## Overview, ## Key findings, ## Data quality, ## Suggested next steps.\n"
        "Be specific: cite column names and numbers from the profile. Keep it under 400 words."
    ),
)

OPERATIONS_REFERENCE = """
Respond with ONLY a JSON object, no prose and no code fences:
{"explanation": "<one or two sentences>", "steps": [{"op": "...", "description": "<short human summary>", "params": {...}}]}

Available operations (params):
- filter: {"column", "operator", "value"}
  operators: eq, ne, gt, gte, lt, lte, contains, not_contains, startswith, endswith, regex,
             is_null, is_not_null, in, not_in,
             length_gt, length_gte, length_lt, length_lte  (characters of text, or items of a list),
             words_gt, words_gte, words_lt, words_lte      (whitespace-separated words)
- sort: {"column", "descending": bool}
- limit: {"n"}
- sample: {"n", "seed"?}
- select: {"columns": [..]}
- drop: {"columns": [..]}
- rename: {"mapping": {"old": "new"}}
- dedupe: {"columns"?: [..]}
- extract: {"column", "new_column", "preset"?: "email"|"phone"|"url"|"number"|"hashtag"|"mention",
            "pattern"?: "<regex>", "all"?: bool (default true, returns a list)}
- derive: {"column", "new_column", "function": "length"|"word_count"|"lowercase"|"uppercase"|"strip"}
- fill_null: {"column", "value"? , "strategy"?: "forward"|"backward"|"mean"|"median"|"min"|"max"|"zero"}
- ai_column: {"new_column", "columns": [..source columns..], "instruction": "<what to produce per row>",
              "output_type": "string"|"number"|"boolean"|"list", "only_missing"?: bool}
  Runs the language model on each row (capped). To fill missing values of an existing column,
  set new_column to that column and only_missing to true.
""".strip()
