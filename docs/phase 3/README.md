# EduPredict — Phase 3 frontend integration

This updates **only your existing React frontend**. Your Decision Tree, training codes, database files, and the existing `PredictionResult.jsx` remain unchanged.

## What changed

1. Dropdown options (Application mode, Course, Previous qualification, Debtor, Tuition fees, Scholarship) are fetched from FastAPI `GET /form-options`. Users see readable labels; the browser sends the **original numeric value**.
2. Student registration uses `POST /students`.
3. You can select a registered student, automatically loading their stored academic record from `GET /students/{id}/record` and prediction history from `GET /students/{id}/predictions`.
4. The form saves all 13 numeric feature values using `PUT /students/{id}/record` and then triggers `POST /students/{id}/predict`. The result is added to the on-screen history.
5. The old `POST /predict` endpoint is unchanged but is intentionally **not** used by this frontend (because that endpoint does not save predictions).

## Installation

Make backup copies first, then replace these files in your existing project:

- `frontend/src/App.jsx`
- `frontend/src/data/fields.js`
- `frontend/src/components/PredictionForm.jsx`

Keep your existing `frontend/src/components/PredictionResult.jsx`, stylesheets, package.json and other files. No new npm packages are needed.

**Prerequisite:** Phase 2 backend already running with `app/student_routes.py`, `app/schemas.py`, and Phase 1 `app/feature_options.py`, the three database tables, and your trained model.

From the project root, start backend (after ensuring `.env` has a valid DB connection):

```bash
source .venv/bin/activate
python -m app.create_tables
uvicorn app.main:app --reload
```

Start the frontend from its folder:

```bash
cd frontend
npm install
npm run dev
```

FastAPI must allow your Vite dev origin (`localhost:5173` or `127.0.0.1:5173`) and `GET, POST, PUT`. The earlier Phase 2 `main.py` already does that.

If the backend is at a different URL, configure `VITE_API_BASE_URL` in your frontend `.env`.

## How to verify

1. Load the React frontend: the three category dropdowns must display names, not numeric input boxes.
2. Register a student (`ST002`, `Example Student`). If it already exists, you should see a duplicate-code error.
3. Fill the 13 inputs, e.g. choose **Informatics Engineering** (sent as code **9119**), then **Save academic data & predict**.
4. The result appears. A new item is added under **Prediction history**.
5. Refresh the page, choose the same student in the student selector, and verify their saved inputs and prediction history reload.
6. Change an input and predict again. Both predictions should remain in the history.

The students dropdown loads the first **100** students (per Phase 2 API). Search/pagination is a future feature.

## Scope and safety

- Student registration is separate from completing first-semester academic data. Full 13-feature inputs are required only before a prediction.
- The numeric category values and feature names are sent as they appear in the training dataset. No new encoding or model training is needed.
- Your backend/database remain the source of truth. The frontend does basic validation; FastAPI revalidates everything.
- This is still a **local development** workflow; the backend student APIs have no authentication/authorization yet. Do not expose the app publicly or enter real student personal data before adding access control and appropriate data protection.
- Not end-to-end tested against your running FastAPI + PostgreSQL deployment because your model and environment are not attached to this turn.
