# EduPredict - Phase 2: Student database APIs

This is a minimal, additive backend update that keeps your trained model and current anonymous `/predict` API unchanged.

## Copy files

From the ZIP, place these files in `FLP-Project/app/`:

- `main.py` — **replace** your current Phase 1 `app/main.py` (keep a backup first).
- `schemas.py` — **new** shared Pydantic validation schemas.
- `student_routes.py` — **new** student + academic record + history endpoints.

**Do not delete or replace** your existing `app/database.py`, `app/models.py`, or `app/create_tables.py`. Their three-table design works with these routes. Keep `app/feature_options.py` from Phase 1, along with your real `app/predictor.py`, model pickle and dataset CSV.

## Start

From the `FLP-Project/` root (not inside `app/`):

```bash
source .venv/bin/activate
python -m pip install sqlalchemy 'psycopg[binary]' python-dotenv
python -m app.create_tables
uvicorn app.main:app --reload
```

Your `app/.env` must have a valid `DATABASE_URL`. Do **not** put passwords in code or commit `.env`. `create_tables` uses `create_all`: it creates missing tables but doesn't migrate existing ones (none of your current table columns were changed here).

Browse: http://127.0.0.1:8000/docs

## Test in Swagger, in this order

1. **POST `/students`** to register a student:

   ```json
   {"student_code": "ST001", "full_name": "Example Student", "email": "student@example.com"}
   ```

2. Get the `id` returned (e.g. `1`). **PUT `/students/1/record`** to save all 13 features:

   ```json
   {
     "Application mode": 17,
     "Course": 9119,
     "Previous qualification": 1,
     "Previous qualification (grade)": 130,
     "Admission grade": 120,
     "Debtor": "Yes",
     "Tuition fees up to date": "No",
     "Scholarship holder": "No",
     "Age at enrollment": 20,
     "Curricular units 1st sem (enrolled)": 6,
     "Curricular units 1st sem (evaluations)": 6,
     "Curricular units 1st sem (approved)": 3,
     "Curricular units 1st sem (grade)": 11
   }
   ```

   You may submit exact dropdown labels or their original numeric codes. The API converts them into training codes before storing.

3. **POST `/students/1/predict`** with no JSON body. The backend uses the saved 13 features, runs the existing model, saves the result, and returns prediction metadata.
4. **GET `/students/1/predictions`** to view saved prediction history. Every prediction stores its own input snapshot, so it is not changed by later record edits.

## All added endpoints

- `POST /students` — register
- `GET /students` — list (paged with `limit`/`offset`)
- `GET /students/{id}` — details
- `PUT /students/{id}/record` — create/update latest 13-feature record
- `GET /students/{id}/record` — retrieve latest record
- `POST /students/{id}/predict` — run and save prediction from stored record
- `GET /students/{id}/predictions` — most recent 100 saved results

Your existing `GET /health`, `GET /form-options`, and `POST /predict` are preserved. The old `/predict` still handles standalone predictions and **does not save them**; use `/students/{id}/predict` to save a registered student's prediction.

## Frontend integration still needed

You shared `PredictionForm.jsx`, which renders fields from `../data/fields`. To integrate correctly **without breaking your existing React state**, the next step is to check:

1. `frontend/src/data/fields.js` (or equivalent `fields` file)
2. The parent component that supplies `values`, `onValueChange`, and `onSubmit` to `PredictionForm` (often `App.jsx`)

Then wire the dropdowns to `GET /form-options`, connect student registration, and use the new saved-prediction endpoints. Don't change the model encoding.

## Security / scope

This is a **local-development MVP**. Registration, academic records and prediction history currently have no authentication and are not appropriate to expose publicly with real student data. Implement authentication + authorization before deployment. Store student data only with appropriate permission.

## Validation

The API routes were exercised in an isolated SQLite test database with a **fake predictor** (real model files were not supplied as part of this update). Registration, duplicate protection, validation, record updates, predictions, snapshot preservation, and history passed. You'll still need to test end-to-end against your actual Postgres database and trained model.
