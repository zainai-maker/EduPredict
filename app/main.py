"""FastAPI application for the saved EduPredict decision tree."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from app.predictor import FEATURE_COLUMNS, InputValidationError, Predictor


ROOT_DIR = Path(__file__).resolve().parent.parent
NumericValue = Annotated[float, Field(strict=True, allow_inf_nan=False)]


class StudentInput(BaseModel):
    """A single student's numeric feature values from the trained dataset."""

    model_config = ConfigDict(populate_by_name=False, extra="forbid")

    application_mode: NumericValue = Field(alias="Application mode")
    course: NumericValue = Field(alias="Course")
    previous_qualification: NumericValue = Field(alias="Previous qualification")
    previous_qualification_grade: NumericValue = Field(
        alias="Previous qualification (grade)"
    )
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


class PredictionResponse(BaseModel):
    prediction: str
    dropout_risk_percent: float | None = Field(
        default=None,
        description="Estimated dropout probability, not a guaranteed outcome.",
    )


predictor = Predictor(
    model_path=ROOT_DIR / "dropout_risk_model.pkl",
    data_path=ROOT_DIR / "new_student_dropout_data.csv",
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    predictor.load()
    yield


app = FastAPI(
    title="EduPredict API",
    version="1.0.0",
    lifespan=lifespan,
    description="Predicts dropout or graduation using the saved Decision Tree model.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/predict", response_model=PredictionResponse)
def predict(student: StudentInput) -> PredictionResponse:
    try:
        prediction, dropout_risk = predictor.predict(student.model_dump(by_alias=True))
    except InputValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return PredictionResponse(
        prediction="Dropout" if prediction == 0 else "Graduate",
        dropout_risk_percent=dropout_risk,
    )


assert len(FEATURE_COLUMNS) == 13
