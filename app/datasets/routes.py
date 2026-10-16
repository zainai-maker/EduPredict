"""Admin-only historical dataset validation and ingestion.

The uploaded rows do not become students and do not trigger predictions.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_deps import require_roles
from app.auth_models import User
from app.database import get_db
from app.datasets.models import DatasetBatch, DatasetRow
from app.datasets.parser import parse_upload

router = APIRouter(prefix='/datasets', tags=['Historical datasets'],
                   dependencies=[Depends(require_roles('admin'))])


def _batch_info(batch: DatasetBatch) -> dict:
    return {
        'id': batch.id,
        'filename': batch.filename,
        'row_count': batch.row_count,
        'labeled_count': batch.labeled_count,
        'created_at': batch.created_at,
    }


@router.post('/preview')
async def preview_dataset(file: UploadFile = File(...)):
    """Validate and preview a file without storing anything."""
    parsed = await parse_upload(file)
    return parsed.preview()


@router.post('/import', status_code=201)
async def import_dataset(file: UploadFile = File(...), db: Session = Depends(get_db),
                         admin: User = Depends(require_roles('admin'))):
    parsed = await parse_upload(file)
    if parsed.invalid_count:
        raise HTTPException(422, detail=f'{parsed.invalid_count} invalid row(s); fix them before importing. Use /datasets/preview for details.')
    if db.query(DatasetBatch.id).filter_by(file_sha256=parsed.file_sha256).first():
        raise HTTPException(409, detail='This exact CSV has already been imported')

    batch = DatasetBatch(filename=parsed.filename, file_sha256=parsed.file_sha256,
                         uploaded_by=admin.id, row_count=len(parsed.rows),
                         labeled_count=sum(row['target'] is not None for row in parsed.rows))
    try:
        db.add(batch)
        db.flush()  # Obtain batch.id before adding rows.
        for start in range(0, len(parsed.rows), 500):
            db.add_all([
                DatasetRow(batch_id=batch.id, row_number=row['row_number'],
                           features=row['features'], actual_outcome=row['target'])
                for row in parsed.rows[start:start + 500]
            ])
            db.flush()
        db.commit()  # One transaction: all rows imported or none.
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, detail='This CSV was already imported') from error
    except Exception:
        db.rollback()
        raise
    db.refresh(batch)
    return _batch_info(batch)


@router.get('')
def imported_datasets(db: Session = Depends(get_db)):
    """Return upload metadata only; never expose raw row data to non-admins."""
    batches = db.query(DatasetBatch).order_by(DatasetBatch.id.desc()).limit(100).all()
    return [_batch_info(batch) for batch in batches]
