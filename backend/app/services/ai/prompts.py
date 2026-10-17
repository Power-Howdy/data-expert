from app.models.ai_schemas import AIPrompts

DEFAULT_PROMPTS = AIPrompts(
    system=(
        "You are Data Expert, a careful data analyst assistant. "
        "You work with tabular datasets and answer precisely and concisely."
    ),
    planner=(
        "Turn the user's request into a short pipeline of function calls from the library.\n"
        "- You only see the schema and a few sample rows; the functions run locally on the full data.\n"
        "- Always prefer existing library functions. Fill their params from the schema and samples "
        "(e.g. choose topic keywords for keyword_tag by reading the samples).\n"
        "- Reuse existing columns when they already hold what is needed (e.g. a token_count column).\n"
        "- For 'best N' requests use a meaningful score column, or build one with weighted_score, "
        "keyword_score or completeness_score, then top_n.\n"
        "- Only if no function can do the job, request a new one in new_functions."
    ),
    function_writer=(
        "You write small, reusable data functions in Python using Polars lazy expressions. "
        "Make them general (driven by params), vectorised and side-effect free."
    ),
    insights=(
        "Write an insight report for the dataset described below, in Markdown.\n"
        "Use these sections: ## Overview, ## Key findings, ## Data quality, ## Suggested next steps.\n"
        "Be specific: cite column names and numbers from the profile. Keep it under 400 words."
    ),
)

PLAN_FORMAT = """
Respond with ONLY a JSON object, no prose and no code fences:
{"explanation": "<one or two sentences>",
 "steps": [{"function": "<library function name>", "description": "<short human summary>", "params": {...}}],
 "new_functions": []}

Every param without "?" or a default is required. Column params must name existing columns
(or columns created by an earlier step). new_column params name the column a step creates.

If no library function fits, add a request to new_functions and call it in steps by that name:
{"name": "<snake_case>", "purpose": "<what it does, generally>",
 "params": [{"name": "...", "type": "column|columns|new_column|string|number|integer|boolean|list|mapping", "description": "..."}],
 "input": "<what columns it reads>", "output": "<what it returns>"}

Examples (column names are illustrative):
Request "Extract the email addresses from the text":
{"explanation": "Pull emails out of text.", "steps": [{"function": "extract_pattern", "description": "Extract emails",
 "params": {"column": "text", "new_column": "emails", "preset": "email"}}], "new_functions": []}
Request "Enrich data with topic fields":
{"explanation": "Tag each row with a topic using keywords seen in the samples.", "steps": [{"function": "keyword_tag",
 "description": "Tag topic", "params": {"column": "text", "new_column": "topic",
 "categories": {"technology": ["software", "ai", "cloud"], "health": ["doctor", "patient", "clinic"]}}}], "new_functions": []}
Request "Get me the best 10 results from the data":
{"explanation": "Score completeness and keep the top 10.", "steps": [
 {"function": "completeness_score", "description": "Score rows", "params": {"new_column": "score"}},
 {"function": "top_n", "description": "Keep best 10", "params": {"column": "score", "n": 10}}], "new_functions": []}
""".strip()

WRITER_CONTRACT = """
Respond with ONLY a JSON object, no prose and no code fences:
{"name": "<snake_case>", "title": "<short title>", "category": "filter|transform|extract|enrich|clean|reshape|aggregate|rank",
 "purpose": "<one sentence>", "input": "<columns/types it reads>", "output": "<what it returns>",
 "params": [{"name": "...", "type": "column|columns|new_column|string|number|integer|boolean|list|mapping|enum",
             "required": true, "default": null, "description": "...", "options": []}],
 "example": {<params for a typical call>},
 "code": "def run(lf, params):\\n    ...\\n    return lf"}

Code rules:
- Define `def run(lf, params):` taking a polars LazyFrame and a dict, returning a LazyFrame.
- Use lazy Polars expressions (pl.col, .str, .list, .struct, pl.when, with_columns, filter, sort, group_by).
  Never call .collect(), never import anything, never read or write files, no names starting with "_".
- Available names: pl, re, math, json, as_text(schema, column) -> text Expr for any column type,
  size_expr(schema, column, words: bool), filter_expr(schema, column, operator, value), PRESET_PATTERNS.
  Get the schema with lf.collect_schema().
- Read every column name and setting from params; do not hard-code dataset columns.
""".strip()
