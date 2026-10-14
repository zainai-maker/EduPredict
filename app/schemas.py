"""Request and response schemas shared by prediction and student endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from app.feature_options import check_numeric_fields, dropdown_to_model_code


NumericValue = Annotated[float, Field(strict=True, allow_inf_nan=False)]


class StudentInput(BaseModel):
    """Exactly the 13 named features used by the saved decision tree."""

    model_config = ConfigDict(populate_by_name=False, extra="forbid")

    application_mode: NumericValue = Field(alias="Application mode")
    course: NumericValue = Field(alias="Course")
    previous_qualification: NumericValue = Field(alias="Previous qualification")
    previous_qualification_grade: NumericValue = Field(alias="Previous qualification (grade)")
    admission_grade: NumericValue = Field(alias="Admission grade")
    debtor: NumericValue = Field(alias="Debtor")
    tuition_fees_up_to_date: NumericValue = Field(alias="Tuition fees up to date")
    scholarship_holder: NumericValue = Field(alias="Scholarship holder")
    age_at_enrollment: NumericValue = Field(alias="Age at enrollment")
    curricular_units_1st_sem_enrolled: NumericValue = Field(
        alias="Curricular units 1st sem (enrolled)"
    )
    curricular_units_1st_sem_evaluations: NumericValue = Field(
        alias="Curricular units 1st sem (evaluations)"
    )
    curricular_units_1st_sem_approved: NumericValue = Field(
        alias="Curricular units 1st sem (approved)"
    )
    curricular_units_1st_sem_grade: NumericValue = Field(
        alias="Curricular units 1st sem (grade)"
    )

    @field_validator(
        "application_mode", "course", "previous_qualification", "debtor",
        "tuition_fees_up_to_date", "scholarship_holder", mode="before"
    )
    @classmethod
    def convert_dropdown(cls, value: object, info: ValidationInfo) -> float:
        dataset_field = cls.model_fields[info.field_name].alias
        return dropdown_to_model_code(dataset_field, value)

    @model_validator(mode="after")
    def validate_numbers(self):
        check_numeric_fields(self.model_dump(by_alias=True))
        return self


class PredictionResponse(BaseModel):
    prediction: str
    dropout_risk_percent: float | None = Field(
        default=None, description="Estimated dropout probability, not a guaranteed outcome."
    )


class StudentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    student_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=254)

    @field_validator("student_code", "full_name", mode="before")
    @classmethod
    def nonblank(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is not None:
            # Lightweight format check, without adding a new third-party dependency.
            parts = value.split("@")
            if len(parts) != 2 or not parts[0] or "." not in parts[1] or any(c.isspace() for c in value):
                raise ValueError("Enter a valid email address")
        return value


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_code: str
    full_name: str
    email: str | None
    created_at: datetime | None


class SavedPredictionResponse(PredictionResponse):
    id: int
    student_id: int
    model_version: str
    input_snapshot: dict[str, float]
    created_at: datetime | None
