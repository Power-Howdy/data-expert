from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import yaml


class ServerSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173"])


class DataSettings(BaseSettings):
    max_stream_chunk: int = 10000
    default_page_size: int = 100
    max_preview_rows: int = 1000
    search_index_path: str = "./.data_expert/search_indexes"
    registry_path: str = "./.data_expert/datasets.json"
    allowed_extensions: List[str] = Field(default_factory=lambda: [
        ".parquet", ".json", ".jsonl", ".json.gz", 
        ".csv", ".tsv", ".feather", ".avro", ".orc", 
        ".xlsx", ".xls"
    ])


class FormatSettings(BaseSettings):
    auto_detect: bool = True
    encoding: str = "utf-8"
    csv_delimiter: str = ","
    json_lines: bool = True


class PerformanceSettings(BaseSettings):
    polars_threads: int = 0
    stream_buffer_size: int = 65536
    max_memory_usage_mb: int = 2048


class SearchSettings(BaseSettings):
    engine: str = "tantivy"
    index_path: str = "./.data_expert/search_indexes"
    max_results: int = 1000
    highlight: bool = True


class ExportSettings(BaseSettings):
    max_rows_per_file: int = 1000000
    compression: str = "gzip"
    partition_size_mb: int = 100


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",
        extra="ignore"
    )
    
    server: ServerSettings = ServerSettings()
    data: DataSettings = DataSettings()
    formats: FormatSettings = FormatSettings()
    performance: PerformanceSettings = PerformanceSettings()
    search: SearchSettings = SearchSettings()
    export: ExportSettings = ExportSettings()
    
    @classmethod
    def from_yaml(cls, path: str) -> "Settings":
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        return cls(**data)


settings = Settings.from_yaml("config.yaml")

# Ensure search index directory exists
Path(settings.search.index_path).mkdir(parents=True, exist_ok=True)
Path(settings.data.search_index_path).mkdir(parents=True, exist_ok=True)