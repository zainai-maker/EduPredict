from sqlalchemy import (
    Column, Integer, String, Float,
    DateTime, ForeignKey, JSON, func
)
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True)
    student_code = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudentRecord(Base):
    __tablename__ = "student_records"

    id = Column(Integer, primary_key=True)
    student_id = Column(
        Integer, ForeignKey("students.id"),
        unique=True, nullable=False
    )
    model_inputs = Column(JSON, nullable=False)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True)
    student_id = Column(
        Integer, ForeignKey("students.id"),
        nullable=False
    )
    prediction = Column(Integer, nullable=False)
    dropout_probability = Column(Float)
    input_snapshot = Column(JSON, nullable=False)
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())