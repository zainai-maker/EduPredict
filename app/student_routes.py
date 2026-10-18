
"""Student routes: admins see all, teachers only assigned students, students none."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_deps import check_student_access, require_roles
from app.auth_models import TeacherStudent, User
from app.database import get_db
from app.models import Prediction, Student, StudentRecord
from app.predictor import InputValidationError
from app.schemas import SavedPredictionResponse, StudentCreate, StudentInput, StudentResponse

router = APIRouter(
    prefix='/students',
    tags=['Students'],
    dependencies=[Depends(require_roles('admin', 'teacher'))]
)

MODEL_VERSION = 'decision-tree-v1'


def get_student(db: Session, student_id: int, user: User) -> Student:
    check_student_access(db, user, student_id)
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(404, detail='Student not found')
    return student


def serialize_prediction(pred: Prediction):
    return SavedPredictionResponse(
        id=pred.id,
        student_id=pred.student_id,
        prediction='Dropout' if pred.prediction == 0 else 'Graduate',
        dropout_risk_percent=pred.dropout_probability,
        input_snapshot=pred.input_snapshot,
        model_version=pred.model_version,
        created_at=pred.created_at,
    )


# ADMIN ONLY: Register a new student
@router.post(
    '',
    response_model=StudentResponse,
    status_code=201,
    dependencies=[Depends(require_roles('admin'))]
)
def register_student(
    payload: StudentCreate,
    db: Session = Depends(get_db)
):
    student = Student(**payload.model_dump())
    db.add(student)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            409,
            detail='Student code already exists'
        ) from error

    db.refresh(student)
    return student


# ADMIN AND TEACHER: List accessible students
@router.get('', response_model=list[StudentResponse])
def list_students(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    query = db.query(Student)

    if user.role == 'teacher':
        query = query.join(
            TeacherStudent,
            TeacherStudent.student_id == Student.id
        ).filter(TeacherStudent.teacher_id == user.id)

    return query.order_by(Student.id).offset(offset).limit(limit).all()


# ADMIN AND TEACHER: Student details
@router.get('/{student_id}', response_model=StudentResponse)
def student_details(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    return get_student(db, student_id, user)


# ADMIN AND TEACHER: Save academic records
@router.put('/{student_id}/record', response_model=StudentInput)
def save_record(
    student_id: int,
    payload: StudentInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    get_student(db, student_id, user)
    inputs = payload.model_dump(by_alias=True)

    record = db.query(StudentRecord).filter_by(
        student_id=student_id
    ).one_or_none()

    if record is None:
        db.add(StudentRecord(
            student_id=student_id,
            model_inputs=inputs
        ))
    else:
        record.model_inputs = inputs

    db.commit()
    return inputs


# ADMIN AND TEACHER: Read academic records
@router.get('/{student_id}/record', response_model=StudentInput)
def read_record(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    get_student(db, student_id, user)

    record = db.query(StudentRecord).filter_by(
        student_id=student_id
    ).one_or_none()

    if record is None:
        raise HTTPException(
            404,
            detail='Academic record not found'
        )

    return record.model_inputs


# ADMIN AND TEACHER: Generate predictions
@router.post(
    '/{student_id}/predict',
    response_model=SavedPredictionResponse,
    status_code=201
)
def predict_student(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    get_student(db, student_id, user)

    record = db.query(StudentRecord).filter_by(
        student_id=student_id
    ).one_or_none()

    if record is None:
        raise HTTPException(
            409,
            detail='Save all 13 academic features first'
        )

    inputs = StudentInput.model_validate(
        record.model_inputs
    ).model_dump(by_alias=True)

    try:
        result, risk = request.app.state.predictor.predict(inputs)
    except InputValidationError as error:
        raise HTTPException(422, detail=str(error)) from error

    prediction = Prediction(
        student_id=student_id,
        prediction=int(result),
        dropout_probability=risk,
        input_snapshot=inputs.copy(),
        model_version=MODEL_VERSION
    )

    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    return serialize_prediction(prediction)


# ADMIN AND TEACHER: View prediction history
@router.get(
    '/{student_id}/predictions',
    response_model=list[SavedPredictionResponse]
)
def prediction_history(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles('admin', 'teacher'))
):
    get_student(db, student_id, user)

    rows = db.query(Prediction).filter_by(
        student_id=student_id
    ).order_by(
        Prediction.id.desc()
    ).limit(100).all()

    return [serialize_prediction(row) for row in rows]
