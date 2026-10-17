from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ParamType = Literal[
    "column", "columns", "new_column", "string", "number", "integer", "boolean",
    "enum", "list", "mapping", "regex", "any",
]


class FunctionParam(BaseModel):
    name: str
    type: ParamType = "any"
    required: bool = True
    default: Any = None
    description: str = ""
    options: List[str] = Field(default_factory=list)


class FunctionSpec(BaseModel):
    """A data function the planner can call. Built-ins are code in this repo; generated ones are sandboxed source."""
    name: str
    title: str = ""
    category: str = "transform"
    purpose: str = ""
    params: List[FunctionParam] = Field(default_factory=list)
    input: str = ""
    output: str = ""
    example: Dict[str, Any] = Field(default_factory=dict)
    source: Literal["builtin", "generated"] = "builtin"
    code: Optional[str] = None
    prompt: str = ""
    created_at: Optional[datetime] = None
    uses: int = 0
