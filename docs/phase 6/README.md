# EduPredict — Phase 6: Historical CSV Data Ingestion

**Purpose:** Add secure, admin-only historical CSV imports without changing existing student records, authentication, prediction model, dashboards, or session cookies.

This patch was built against **Phase 5 Authentication + the Session & Routes Fix** that we provided previously. If you have modified any of these files since then, **merge the changes**, not a blind replacement.

## 1) Where every file goes

Copy relative to your existing `FLP-Project/` directory:

```text
FLP-Project/
├── app/
│   ├── main.py                      REPLACE/MERGE — register dataset router
│   ├── create_tables.py             REPLACE/MERGE — import new table metadata
│   ├── datasets/                    NEW FOLDER
│   │   ├── __init__.py              NEW
│   │   ├── models.py                NEW — historical dataset tables
│   │   ├── parser.py                NEW — validate codes, labels, numbers, target
│   │   └── routes.py                NEW — admin-only dataset APIs
│   ├── models.py                    KEEP — original student tables
│   ├── student_routes.py            KEEP — current student APIs
│   ├── predictor.py                 KEEP — existing trained model integration
│   ├── auth_deps.py                 KEEP — your cookie authentication
│   └── ...
├── frontend/
│   ├── vite.config.js               KEEP — current /api proxy
│   └── src/
│       ├── App.jsx                  REPLACE/MERGE — new admin route & navigation
│       ├── api/client.js            KEEP — existing cookie-aware request()
│       └── components/
│           ├── DatasetImports.jsx  NEW
│           ├── DatasetImports.css  NEW
│           └── ...
├── tests/
│   └── test_datasets.py             NEW — automated tests
└── examples/
    └── historical_students_sample.csv   OPTIONAL SAMPLE
```

Back up your existing `app/main.py`, `app/create_tables.py`, and `frontend/src/App.jsx` before replacing them.

### If you want to merge instead of replacing

`app/main.py`: add `from app.datasets.routes import router as dataset_router` alongside imports and `app.include_router(dataset_router)` alongside other routers.

`app/create_tables.py`: import `from app.datasets import models as dataset_models` before `Base.metadata.create_all(bind=engine)`.

`frontend/src/App.jsx`: import `DatasetImports` from `./components/DatasetImports`, add `"/admin/datasets": ["admin"]` to `routeRoles`, add an Admin-only navigation link to `/admin/datasets`, and add an Admin-only route rendering `<DatasetImports api={api} />`.

The ZIP contains fully merged reference versions of these three files.

## 2) Install dependency

In your activated Python environment, from `FLP-Project/`:

```bash
pip install python-multipart
```

Keep your existing FastAPI, SQLAlchemy, Postgres driver, argon2, and JWT dependencies installed.

## 3) Create the two *new* database tables

```bash
python -m app.create_tables
```

Creates `dataset_batches` and `dataset_rows`. No existing student, auth, or prediction data is deleted or modified. For future schema changes on production databases, use database migrations instead of relying on `create_all`.

## 4) Run and test

Start FastAPI and your React frontend normally:

```bash
uvicorn app.main:app --reload
# separate terminal:
cd frontend && npm run dev
```

Sign in as **Admin**, then open:

**http://localhost:5173/admin/datasets**

Choose `examples/historical_students_sample.csv` and click **Validate & preview**. Then click **Import valid CSV**. After that, try uploading the same file again: the backend should reject the duplicate.

You can also choose your full original `new_student_dropout_data.csv` file. Its expected preview is **3,630 rows with 0 invalid rows** (assuming it is unchanged from the uploaded training CSV).

## 5) New API endpoints

| Method | FastAPI endpoint | Who can use it | Behavior |
| --- | --- | --- | --- |
| POST | `/datasets/preview` | Admin | Validate CSV, show counts, first 5 valid rows, and up to 15 errors; no database writes |
| POST | `/datasets/import` | Admin | Import all rows in one DB transaction, reject invalid/duplicate files |
| GET | `/datasets` | Admin | List recent import batches (metadata only) |

For browser requests these are proxied as `/api/datasets/...` by your existing Vite config. The uploader uses `FormData` with file field **`file`**; don't manually set a `Content-Type` header. Normal session cookie and your `X-EduPredict-Request` header are used automatically through `api/client.js`.

## 6) Exact CSV format

- Header row must contain the **13 exact feature column names** from the current model; optional `target` column.
- Columns may appear in any order; other columns, duplicate columns, and missing columns are rejected.
- Dropdown fields accept **original numeric codes or verified text labels** (e.g., `Course=33` or `Course=Biofuel Production Technologies`).
- Numeric columns must contain valid finite numbers within the backend's existing range rules.
- If `target` exists, every row must have exactly `0` (actual Dropout) or `1` (actual Graduate). Do **not** confuse this historical label with a model prediction.
- A row with missing/invalid values is reported in the preview. Import is **all-or-nothing**; there is no guessing or imputation.
- CSV must be UTF-8, at most **5 MB**, and at most **10,000 rows** per file.

**Your original historical CSV contains no student name, email, or ID.** It cannot safely be imported as real registered students. Historical uploads are stored in their own tables and will not affect `/students`, `/dashboard/summary`, or `/predict` unless a future feature intentionally uses them.

## 7) Tests

Install test dependencies if needed:

```bash
pip install pytest httpx
python -m pytest -q tests/test_datasets.py
```

Tests use a temporary SQLite database and do not connect to your PostgreSQL database. Existing student/auth/session tests should also continue working.

## 8) What's completed and what's still pending

**Phase 6A delivered:** CSV batch imports, validation/error preview, storage, duplicate protection, role-based API access, admin UI.

**Not implemented yet:** Hadoop/HDFS storage, real-time streaming, attendance/LMS ingestion, large-scale parallel processing, or model retraining. Those need separate integration work and infrastructure; this ZIP does **not** claim to satisfy the entire Big Data requirement.

Before uploading genuine educational records in production, validate your data retention/privacy requirements and complete the earlier HTTPS, CSRF, rate-limit, and security hardening tasks.
