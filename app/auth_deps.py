"""Server-side authorization for bearer clients and same-origin cookie sessions."""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt

from app.auth_models import TeacherStudent, User
from app.database import get_db
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)
COOKIE_NAME = 'edp_session'
_UNSAFE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}


def current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(401, detail='Authentication required', headers={'WWW-Authenticate': 'Bearer'})
    bearer_token = credentials.credentials if credentials is not None else None
    token = bearer_token or request.cookies.get(COOKIE_NAME)
    if not token:
        raise unauthorized
    # Cookies attach automatically; require a custom header on all state-changing
    # browser requests. Cross-origin forms cannot set this header, and CORS is restricted.
    if not bearer_token and request.method in _UNSAFE_METHODS:
        if request.headers.get('X-EduPredict-Request') != '1':
            raise HTTPException(403, detail='Missing CSRF protection header')
    try:
        payload = decode_access_token(token)
        if payload.get('type') != 'access' or not str(payload.get('sub', '')).isdigit():
            raise unauthorized
        user = db.get(User, int(payload['sub']))
        if user is None or not user.is_active or payload.get('v') != user.token_version:
            raise unauthorized
        return user
    except jwt.InvalidTokenError:
        raise unauthorized from None


def require_roles(*roles):
    def check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, detail='You do not have permission for this action')
        return user
    return check


def check_student_access(db: Session, user: User, student_id: int) -> None:
    if user.role == 'admin':
        return
    if user.role == 'teacher' and db.get(TeacherStudent, (user.id, student_id)) is not None:
        return
    raise HTTPException(404, detail='Student not found')
