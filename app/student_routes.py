"""Store registered students, their latest academic inputs, and all predictions."""

from __future__ import annotations

from collections.abc import Generator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Prediction, Student, StudentRecord
from app.predictor import InputValidationError
from app.schemas import (
    SavedPredictionResponse,
    StudentCreate,
    StudentInput,
    StudentResponse,
)


router = APIRouter(prefix="/students", tags=["Students"])
MODEL_VERSION = "decision-tree-v1"  # Update this when the saved model is replaced.


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_student(db: Session, student_id: int) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def output_prediction(pred: Prediction) -> SavedPredictionResponse:
    return SavedPredictionResponse(
        id=pred.id,
        student_id=pred.student_id,
        prediction="Dropout" if pred.prediction == 0 else "Graduate",
        dropout_risk_percent=pred.dropout_probability,
        input_snapshot=pred.input_snapshot,
        model_version=pred.model_version,
        created_at=pred.created_at,
    )


@router.post("", response_model=StudentResponse, status_code=201)
def register_student(payload: StudentCreate, db: Session = Depends(get_db)):
    student = Student(**payload.model_dump())
    db.add(student)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Student code already exists") from error
    db.refresh(student)
    return student


@router.get("", response_model=list[StudentResponse])
def list_students(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return (
        db.query(Student)
        .order_by(Student.id)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{student_id}", response_model=StudentResponse)
def student_details(student_id: int, db: Session = Depends(get_db)):
    return require_student(db, student_id)


@router.put("/{student_id}/record", response_model=StudentInput)
def save_academic_record(
    student_id: int,
    payload: StudentInput,
    db: Session = Depends(get_db),
):
    require_student(db, student_id)
    values = payload.model_dump(by_alias=True)
    record = db.query(StudentRecord).filter_by(student_id=student_id).one_or_none()
    if record is None:
        record = StudentRecord(student_id=student_id, model_inputs=values)
        db.add(record)
    else:
        record.model_inputs = values
    db.commit()
    return values


@router.get("/{student_id}/record", response_model=StudentInput)
def get_academic_record(student_id: int, db: Session = Depends(get_db)):
    require_student(db, student_id)
    record = db.query(StudentRecord).filter_by(student_id=student_id).one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Academic record not found")
    return record.model_inputs


@router.post("/{student_id}/predict", response_model=SavedPredictionResponse, status_code=201)
def predict_registered_student(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    require_student(db, student_id)
    record = db.query(StudentRecord).filter_by(student_id=student_id).one_or_none()
    if record is None:
        raise HTTPException(status_code=409, detail="Save all 13 academic features first")

    # Revalidate stored inputs and preserve exactly the features used at prediction time.
    inputs = StudentInput.model_validate(record.model_inputs).model_dump(by_alias=True)
    try:
        result, dropout_risk = request.app.state.predictor.predict(inputs)
    except InputValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    prediction = Prediction(
        student_id=student_id,
        prediction=int(result),
        dropout_probability=dropout_risk,
        input_snapshot=inputs.copy(),
        model_version=MODEL_VERSION,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return output_prediction(prediction)


@router.get("/{student_id}/predictions", response_model=list[SavedPredictionResponse])
def prediction_history(
    student_id: int,
    db: Session = Depends(get_db),
):
    require_student(db, student_id)
    rows = (
        db.query(Prediction)
        .filter_by(student_id=student_id)
        .order_by(Prediction.id.desc())
        .limit(100)
        .all()
    )
    return [output_prediction(row) for row in rows]
