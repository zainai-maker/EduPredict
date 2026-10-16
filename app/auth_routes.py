"""Cookie-based browser sessions; existing Bearer API support is retained."""
import os
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth_deps import COOKIE_NAME, current_user
from app.auth_models import StudentUserLink, User
from app.database import get_db
from app.models import Student, StudentRecord
from app.security import create_access_token, verify_password

router = APIRouter(prefix='/auth', tags=['Authentication'])
me_router = APIRouter(prefix='/me', tags=['My academics'])

# Align cookie lifetime with security.create_access_token() (30 minutes).
SESSION_SECONDS = 30 * 60


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str
    password: str


def public_user(user: User) -> dict:
    return {'id': user.id, 'full_name': user.full_name, 'email': user.email, 'role': user.role}


@router.post('/login')
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    # Reject cross-origin form-based login CSRF; our React client sends this header.
    if request.headers.get('Origin') and request.headers.get('X-EduPredict-Request') != '1':
        raise HTTPException(403, detail='Missing CSRF protection header')
    user = db.query(User).filter(User.email == payload.email.strip().lower()).one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, detail='Invalid email or password')
    token = create_access_token(user)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=os.getenv('AUTH_COOKIE_SECURE', 'false').lower() == 'true',
        samesite='lax',
        path='/',
    )
    # Keep access_token in the JSON response for Swagger/existing API clients.
    # The updated React client never saves or uses it.
    return {'access_token': token, 'token_type': 'bearer', 'user': public_user(user)}


@router.get('/me')
def who_am_i(user: User = Depends(current_user)):
    return public_user(user)


@router.post('/logout', status_code=204)
def logout(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()
    response.delete_cookie(key=COOKIE_NAME, path='/', samesite='lax')


@me_router.get('/student')
def my_student(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != 'student':
        raise HTTPException(403, detail='Student account required')
    link = db.query(StudentUserLink).filter_by(user_id=user.id).one_or_none()
    if link is None:
        return {'student': None, 'academic_record': None}
    student = db.get(Student, link.student_id)
    record = db.query(StudentRecord).filter_by(student_id=link.student_id).one_or_none()
    if student is None:
        return {'student': None, 'academic_record': None}
    # Do not expose predictions or dropout probabilities to students.
    return {
        'student': {'student_code': student.student_code, 'full_name': student.full_name, 'email': student.email},
        'academic_record': record.model_inputs if record is not None else None,
    }
