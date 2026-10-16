"""Admin-only account provisioning and student assignments."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_deps import require_roles
from app.auth_models import ROLES, StudentUserLink, TeacherStudent, User
from app.auth_routes import public_user
from app.database import get_db
from app.models import Student
from app.security import hash_password

router = APIRouter(prefix='/admin', tags=['Administration'], dependencies=[Depends(require_roles('admin'))])


class CreateUser(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=12, max_length=128)
    role: str


class UserActive(BaseModel):
    is_active: bool


class UserId(BaseModel):
    user_id: int


class ResetPassword(BaseModel):
    password: str = Field(min_length=12, max_length=128)


class TeacherId(BaseModel):
    teacher_id: int


@router.get('/users')
def users(db: Session = Depends(get_db)):
    return [{**public_user(user), 'is_active': user.is_active} for user in db.query(User).order_by(User.id).limit(500)]


@router.post('/users', status_code=201)
def add_user(payload: CreateUser, db: Session = Depends(get_db)):
    if payload.role not in ROLES:
        raise HTTPException(422, detail='Role must be admin, teacher, student or analyst')
    email = payload.email.strip().lower()
    if not email or '@' not in email or email.startswith('@') or email.endswith('@') or any(c.isspace() for c in email):
        raise HTTPException(422, detail='Invalid email')
    name = payload.full_name.strip()
    if not name:
        raise HTTPException(422, detail='Name is required')
    user = User(email=email, full_name=name, role=payload.role,
                password_hash=hash_password(payload.password), is_active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, detail='Email already registered') from error
    db.refresh(user)
    return public_user(user)


@router.patch('/users/{user_id}/active')
def change_user_active(
    user_id: int, body: UserActive, db: Session = Depends(get_db),
    admin: User = Depends(require_roles('admin')),
):
    if user_id == admin.id and not body.is_active:
        raise HTTPException(400, detail='You cannot deactivate your own account')
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, detail='User not found')
    user.is_active = body.is_active
    user.token_version += 1
    db.commit()
    return {**public_user(user), 'is_active': user.is_active}


@router.patch('/users/{user_id}/password', status_code=204)
def reset_user_password(user_id: int, body: ResetPassword, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, detail='User not found')
    user.password_hash = hash_password(body.password)
    user.token_version += 1  # Revoke old credentials immediately.
    db.commit()


@router.post('/students/{student_id}/link-user', status_code=201)
def link_student(student_id: int, payload: UserId, db: Session = Depends(get_db)):
    if db.get(Student, student_id) is None:
        raise HTTPException(404, detail='Student not found')
    user = db.get(User, payload.user_id)
    if user is None or user.role != 'student':
        raise HTTPException(422, detail='Select a student-role user')
    if db.get(StudentUserLink, student_id) is not None:
        raise HTTPException(409, detail='This student is already linked to an account')
    db.add(StudentUserLink(student_id=student_id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, detail='Account is already linked to another student') from error
    return {'student_id': student_id, 'user_id': user.id}


@router.post('/students/{student_id}/assign-teacher', status_code=201)
def assign_teacher(student_id: int, payload: TeacherId, db: Session = Depends(get_db)):
    if db.get(Student, student_id) is None:
        raise HTTPException(404, detail='Student not found')
    teacher = db.get(User, payload.teacher_id)
    if teacher is None or teacher.role != 'teacher' or not teacher.is_active:
        raise HTTPException(422, detail='Select an active teacher-role user')
    assignment = TeacherStudent(student_id=student_id, teacher_id=teacher.id)
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, detail='Teacher is already assigned to this student') from error
    return {'student_id': student_id, 'teacher_id': teacher.id}


@router.delete('/students/{student_id}/teachers/{teacher_id}', status_code=204)
def unassign_teacher(student_id: int, teacher_id: int, db: Session = Depends(get_db)):
    assignment = db.get(TeacherStudent, (teacher_id, student_id))
    if assignment is None:
        raise HTTPException(404, detail='Assignment not found')
    db.delete(assignment)
    db.commit()
