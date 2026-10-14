"""Aggregated dashboard data for registered students and saved predictions."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Prediction, Student
from app.student_routes import get_db


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class RecentPrediction(BaseModel):
    id: int
    student_id: int
    student_code: str
    full_name: str
    prediction: str
    dropout_risk_percent: float | None
    model_version: str
    created_at: datetime | None


class DashboardSummary(BaseModel):
    total_students: int
    students_with_predictions: int
    awaiting_prediction: int
    predicted_dropout: int
    predicted_graduate: int
    dropout_share_percent: float | None
    total_predictions: int
    recent_predictions: list[RecentPrediction]


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    """Count each student once, using *their latest prediction* for summary cards."""
    total_students = db.query(func.count(Student.id)).scalar() or 0
    total_predictions = db.query(func.count(Prediction.id)).scalar() or 0

    # One newest saved prediction per student. Counts are NOT the number of
    # historical predictions (a student can be predicted multiple times).
    latest_ids = (
        db.query(func.max(Prediction.id).label("id"))
        .group_by(Prediction.student_id)
        .subquery()
    )
    latest_counts = (
        db.query(Prediction.prediction, func.count(Prediction.id))
        .join(latest_ids, Prediction.id == latest_ids.c.id)
        .group_by(Prediction.prediction)
        .all()
    )
    counts = {int(outcome): int(amount) for outcome, amount in latest_counts}
    predicted_dropout = counts.get(0, 0)
    predicted_graduate = counts.get(1, 0)
    students_with_predictions = predicted_dropout + predicted_graduate

    # Return only 10 rows, ordered newest first, with their student names.
    rows = (
        db.query(Prediction, Student)
        .join(Student, Student.id == Prediction.student_id)
        .order_by(Prediction.id.desc())
        .limit(10)
        .all()
    )
    recent = [
        RecentPrediction(
            id=prediction.id,
            student_id=prediction.student_id,
            student_code=student.student_code,
            full_name=student.full_name,
            prediction="Dropout" if prediction.prediction == 0 else "Graduate",
            dropout_risk_percent=prediction.dropout_probability,
            model_version=prediction.model_version,
            created_at=prediction.created_at,
        )
        for prediction, student in rows
    ]

    return DashboardSummary(
        total_students=total_students,
        students_with_predictions=students_with_predictions,
        awaiting_prediction=max(total_students - students_with_predictions, 0),
        predicted_dropout=predicted_dropout,
        predicted_graduate=predicted_graduate,
        dropout_share_percent=(
            round(100 * predicted_dropout / students_with_predictions, 1)
            if students_with_predictions else None
        ),
        total_predictions=total_predictions,
        recent_predictions=recent,
    )
