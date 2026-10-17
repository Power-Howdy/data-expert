"""Formats that need optional packages (fastexcel, XlsxWriter, fastavro) read and write with requirements.txt."""
import fastavro
import polars as pl
import pytest

from app.models.schemas import DataFormat
from app.services.data_loader import DataLoader

DF = pl.DataFrame({"text": ["a", "b"], "n": [1, 2]})


@pytest.mark.parametrize("sheet", [{}, {"sheet_name": "Sheet1"}, {"sheet_name": 0}, {"sheet_id": 1}])
def test_excel_round_trip(tmp_path, sheet):
    path = str(tmp_path / "data.xlsx")
    loader = DataLoader()
    loader.write(DF, path, DataFormat.XLSX)
    assert loader.load_lazy(path, **sheet).collect().equals(DF)


def test_avro_read(tmp_path):
    path = tmp_path / "data.avro"
    schema = {"type": "record", "name": "r", "fields": [
        {"name": "text", "type": "string"}, {"name": "n", "type": "long"}]}
    with open(path, "wb") as f:
        fastavro.writer(f, schema, DF.to_dicts())
    assert DataLoader().load_lazy(str(path)).collect().equals(DF)
