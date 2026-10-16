"""Additive tables; the original Student, StudentRecord, Prediction models stay untouched."""
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from app.database import Base

ROLES = ('admin', 'teacher', 'student', 'analyst')


class User(Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint("role IN ('admin','teacher','student','analyst')", name='ck_user_role'),)

    id = Column(Integer, primary_key=True)
    email = Column(String(254), nullable=False, unique=True, index=True)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StudentUserLink(Base):
    __tablename__ = 'student_user_links'
    student_id = Column(Integer, ForeignKey('students.id'), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)


class TeacherStudent(Base):
    __tablename__ = 'teacher_students'
    __table_args__ = (UniqueConstraint('teacher_id', 'student_id', name='uq_teacher_student'),)
    teacher_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    student_id = Column(Integer, ForeignKey('students.id'), primary_key=True)
