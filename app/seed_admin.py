"""One-time interactive admin bootstrap: python -m app.seed_admin"""
from getpass import getpass
from app import auth_models, models  # noqa: F401: import for table metadata
from app.auth_models import User
from app.database import SessionLocal
from app.security import _secret, hash_password


def main():
    _secret()  # Refuse setup without a strong signing secret.
    email = input('Admin email: ').strip().lower()
    name = input('Admin full name: ').strip()
    password = getpass('New admin password (min 12 characters): ')
    again = getpass('Confirm password: ')
    if not email or '@' not in email or not name or password != again:
        raise SystemExit('Invalid details or passwords do not match')
    password_hash = hash_password(password)
    with SessionLocal() as db:
        if db.query(User).filter_by(email=email).one_or_none() is not None:
            raise SystemExit('An account with this email already exists')
        db.add(User(email=email, full_name=name, role='admin', password_hash=password_hash))
        db.commit()
    print('Admin account created. You can log in now.')


if __name__ == '__main__':
    main()
