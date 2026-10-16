"""Scope teacher analytics to assigned students; analysts receive aggregates only."""
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.auth_deps import require_roles
from app.auth_models import TeacherStudent, User
from app.database import get_db
from app.models import Prediction, Student

router = APIRouter(prefix='/dashboard', tags=['Dashboard'],
                   dependencies=[Depends(require_roles('admin', 'teacher', 'analyst'))])


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


@router.get('/summary', response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db),
                      user: User = Depends(require_roles('admin', 'teacher', 'analyst'))):
    # Admin and analyst receive global counts. Teacher counts only assigned students.
    assigned = select(TeacherStudent.student_id).where(TeacherStudent.teacher_id == user.id)
    student_query = db.query(Student)
    predictions_query = db.query(Prediction)
    if user.role == 'teacher':
        student_query = student_query.filter(Student.id.in_(assigned))
        predictions_query = predictions_query.filter(Prediction.student_id.in_(assigned))

    total_students = student_query.count()
    total_predictions = predictions_query.count()
    latest_ids = predictions_query.with_entities(func.max(Prediction.id).label('id')).group_by(
        Prediction.student_id).subquery()
    latest_counts = db.query(Prediction.prediction, func.count(Prediction.id)).join(
        latest_ids, Prediction.id == latest_ids.c.id).group_by(Prediction.prediction).all()
    counts = {int(outcome): int(amount) for outcome, amount in latest_counts}
    dropout, graduate = counts.get(0, 0), counts.get(1, 0)
    n_predicted = dropout + graduate

    recent = []
    if user.role != 'analyst':
        q = db.query(Prediction, Student).join(Student, Student.id == Prediction.student_id)
        if user.role == 'teacher':
            q = q.filter(Prediction.student_id.in_(assigned))
        rows = q.order_by(Prediction.id.desc()).limit(10).all()
        recent = [RecentPrediction(
            id=pred.id, student_id=pred.student_id, student_code=student.student_code,
            full_name=student.full_name,
            prediction='Dropout' if pred.prediction == 0 else 'Graduate',
            dropout_risk_percent=pred.dropout_probability, model_version=pred.model_version,
            created_at=pred.created_at) for pred, student in rows]

    return DashboardSummary(
        total_students=total_students, students_with_predictions=n_predicted,
        awaiting_prediction=max(0, total_students - n_predicted),
        predicted_dropout=dropout, predicted_graduate=graduate,
        dropout_share_percent=round(100 * dropout / n_predicted, 1) if n_predicted else None,
        total_predictions=total_predictions, recent_predictions=recent)
