"""EduPredict FastAPI app: authenticated student management and ML predictions."""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.auth_deps import current_user, require_roles
from app.auth_routes import me_router, router as auth_router
from app.admin_routes import router as admin_router
from app.dashboard_routes import router as dashboard_router
from app.datasets.routes import router as dataset_router
from app.feature_options import FEATURE_ORDER, build_form_fields
from app.predictor import FEATURE_COLUMNS, InputValidationError, Predictor
from app.schemas import PredictionResponse, StudentInput
from app.security import _secret
from app.student_routes import router as student_router

ROOT_DIR = Path(__file__).resolve().parent.parent
predictor = Predictor(model_path=ROOT_DIR / 'dropout_risk_model.pkl',
                      data_path=ROOT_DIR / 'new_student_dropout_data.csv')


@asynccontextmanager
async def lifespan(application: FastAPI):
    _secret()  # Fail startup if JWT secret is missing/weak.
    predictor.load()
    application.state.predictor = predictor
    yield


app = FastAPI(title='EduPredict API', version='2.0.0', lifespan=lifespan)
app.include_router(auth_router)
app.include_router(me_router)
app.include_router(admin_router)
app.include_router(student_router)
app.include_router(dashboard_router)
app.include_router(dataset_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)


@app.get('/health')
def health():
    return {'status': 'healthy'}


@app.get('/form-options')
def form_options(user=Depends(current_user)):
    return build_form_fields()


@app.post('/predict', response_model=PredictionResponse,
          dependencies=[Depends(require_roles('admin', 'teacher'))])
def predict(student: StudentInput):
    try:
        result, risk = predictor.predict(student.model_dump(by_alias=True))
    except InputValidationError as error:
        raise HTTPException(422, detail=str(error)) from error
    return PredictionResponse(prediction='Dropout' if result == 0 else 'Graduate',
                              dropout_risk_percent=risk)


assert list(FEATURE_COLUMNS) == list(FEATURE_ORDER), 'Feature order mismatch'
