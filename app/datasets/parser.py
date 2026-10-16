"""Strict CSV validation. Reuse the *existing* 13-feature Pydantic schema.

Never synthesize missing student identities or automatically retrain the ML model.
"""
from __future__ import annotations

import csv
import hashlib
import io
import math
from dataclasses import dataclass
from pathlib import PurePath

from fastapi import HTTPException, UploadFile
from pydantic import ValidationError

from app.feature_options import CATEGORICAL_OPTIONS, FEATURE_ORDER
from app.schemas import StudentInput

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10_000
MAX_ISSUES = 15


@dataclass
class ParsedDataset:
    filename: str
    file_sha256: str
    rows: list[dict]
    has_target: bool
    invalid_count: int
    issues: list[dict]

    def preview(self) -> dict:
        return {
            'filename': self.filename,
            'total_rows': len(self.rows) + self.invalid_count,
            'valid_rows': len(self.rows),
            'invalid_rows': self.invalid_count,
            'has_target': self.has_target,
            'labeled_rows': sum(r['target'] is not None for r in self.rows),
            'issues': self.issues,
            'sample': self.rows[:5],
        }


def _numeric_input(field: str, raw: str) -> float | str:
    """CSV is text. Convert continuous values to floats, preserve dropdown codes/labels."""
    text = raw.strip()
    if field in CATEGORICAL_OPTIONS:
        return text
    try:
        number = float(text)
    except ValueError:
        raise ValueError(f'{field}: expected a number') from None
    if not math.isfinite(number):
        raise ValueError(f'{field}: expected a finite number')
    return number


def _target(raw: str | None, has_target: bool) -> int | None:
    if not has_target:
        return None
    text = (raw or '').strip()
    if text == '0':
        return 0
    if text == '1':
        return 1
    raise ValueError('target must be 0 (Dropout) or 1 (Graduate)')


async def parse_upload(file: UploadFile) -> ParsedDataset:
    filename = PurePath((file.filename or 'upload.csv').replace('\\', '/')).name[:150]
    if not filename.lower().endswith('.csv'):
        raise HTTPException(422, detail='Please upload a .csv file')
    content = await file.read(MAX_FILE_BYTES + 1)
    await file.close()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, detail='CSV is too large. Maximum size is 5 MB')
    if not content:
        raise HTTPException(422, detail='CSV is empty')
    try:
        data = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise HTTPException(422, detail='CSV must be UTF-8 encoded') from None
    try:
        reader = csv.DictReader(io.StringIO(data, newline=''), strict=True)
        header = reader.fieldnames
        if not header:
            raise HTTPException(422, detail='CSV needs a header row')
        # Explicit exact column names avoid quietly misinterpreting model inputs.
        if len(header) != len(set(header)):
            raise HTTPException(422, detail='Duplicate CSV column names are not allowed')
        allowed = set(FEATURE_ORDER) | {'target'}
        missing = [name for name in FEATURE_ORDER if name not in header]
        unexpected = [name for name in header if name not in allowed]
        if missing or unexpected:
            raise HTTPException(422, detail=f'CSV headers incorrect. Missing: {missing}; unexpected: {unexpected}')

        result = ParsedDataset(filename=filename, file_sha256=hashlib.sha256(content).hexdigest(),
                               rows=[], has_target=('target' in header), invalid_count=0, issues=[])
        for raw in reader:
            line = reader.line_num
            if len(result.rows) + result.invalid_count >= MAX_ROWS:
                raise HTTPException(413, detail='CSV can contain at most 10,000 data rows')
            try:
                if None in raw:
                    raise ValueError('Too many columns in CSV row')
                if any(v is None for v in raw.values()):
                    raise ValueError('Missing column value')
                values = {field: _numeric_input(field, raw[field]) for field in FEATURE_ORDER}
                validated = StudentInput.model_validate(values)
                features = validated.model_dump(by_alias=True)
                result.rows.append({'row_number': line, 'features': features,
                                    'target': _target(raw.get('target'), result.has_target)})
            except (ValueError, ValidationError) as error:
                result.invalid_count += 1
                if len(result.issues) < MAX_ISSUES:
                    message = str(error)
                    # Keep client output readable, bounded; no stack traces or sensitive data.
                    result.issues.append({'row': line, 'message': message[:350]})
    except csv.Error as error:
        raise HTTPException(422, detail=f'Malformed CSV: {str(error)[:150]}') from error
    if not result.rows and result.invalid_count == 0:
        raise HTTPException(422, detail='CSV has no data rows')
    return result
