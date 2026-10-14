"""FastAPI application for the saved EduPredict decision tree."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.predictor import FEATURE_COLUMNS, InputValidationError, Predictor
from app.feature_options import FEATURE_ORDER, build_form_fields
from app.schemas import StudentInput, PredictionResponse
from app.student_routes import router as student_router
from app.dashboard_routes import router as dashboard_router


ROOT_DIR = Path(__file__).resolve().parent.parent
predictor = Predictor(
    model_path=ROOT_DIR / "dropout_risk_model.pkl",
    data_path=ROOT_DIR / "new_student_dropout_data.csv",
)


@asynccontextmanager
async def lifespan(application: FastAPI):
    predictor.load()
    application.state.predictor = predictor
    yield


app = FastAPI(
    title="EduPredict API",
    version="1.0.0",
    lifespan=lifespan,
    description="Predicts dropout or graduation using the saved Decision Tree model.",
)

app.include_router(student_router)
app.include_router(dashboard_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/form-options")
def form_options() -> list[dict]:
    """Return input types, labels, and original numeric codes for all 13 fields."""
    return build_form_fields()


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


assert list(FEATURE_COLUMNS) == list(FEATURE_ORDER), "Feature order mismatch"
