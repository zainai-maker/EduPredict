# EduPredict — Phase 5: Authentication & Authorization

**Base:** Your working Phase 4 FastAPI + React + PostgreSQL project. No ML retraining. All 13 training fields and original numeric dropdown codes stay unchanged.

## 1. Exactly where each file goes

Unzip into a **temporary location first**, then copy the contents into the existing `FLP-Project` (project root). The ZIP mirrors the existing paths:

```text
FLP-Project/
├── app/
│   ├── .env.example          NEW (template; copy to app/.env, don't replace DB URL)
│   ├── admin_routes.py       NEW
│   ├── auth_deps.py          NEW
│   ├── auth_models.py        NEW
│   ├── auth_routes.py        NEW
│   ├── security.py           NEW
│   ├── seed_admin.py         NEW
│   ├── create_tables.py      REPLACE (adds only the auth tables)
│   ├── database.py           REPLACE (adds shared get_db + explicit .env)
│   ├── dashboard_routes.py   REPLACE (teacher-scoped analytics; analyst aggregate only)
│   ├── student_routes.py     REPLACE (server-side per-student access checks)
│   ├── main.py               REPLACE (register auth routes; protect old /predict)
│   ├── models.py             KEEP YOUR EXISTING FILE
│   ├── schemas.py            KEEP YOUR EXISTING FILE
│   ├── feature_options.py    KEEP YOUR EXISTING FILE
│   ├── predictor.py          KEEP YOUR EXISTING FILE
│   └── __init__.py           KEEP
├── frontend/
│   ├── src/
│   │   ├── App.jsx                       REPLACE
│   │   ├── api/
│   │   │   └── client.js                 NEW
│   │   ├── components/
│   │   │   ├── Auth.css                  NEW
│   │   │   ├── Dashboard.jsx             REPLACE (adds bearer authorization)
│   │   │   ├── Dashboard.css             KEEP YOUR EXISTING FILE
│   │   │   ├── LoginForm.jsx             NEW
│   │   │   ├── StudentPortal.jsx         NEW
│   │   │   ├── StudentWorkspace.jsx      NEW (moves your existing registration/form/history UI)
│   │   │   └── UserManagement.jsx        NEW
│   │   ├── data/fields.js                KEEP
│   │   └── components/PredictionForm.jsx KEEP
│   └── package.json                      KEEP
├── tests/
│   └── test_access.py                     NEW (optional: role/security tests)
├── dropout_risk_model.pkl                KEEP (never replace)
└── README...                              this guide
```

**Backup the existing files before replacing them.** These updated files were built from the Phase 4 ZIP, not from your latest Git working tree. If you made changes after Phase 4, compare/merge them before overwriting. **Do not delete any existing DB tables, source data, model pickle, CSV, secrets, frontend styles, or virtual environment.**

## 2. Install Python dependencies

Run in `FLP-Project/` with the existing virtual environment active:

```bash
python -m pip install 'fastapi' 'sqlalchemy' 'psycopg[binary]' 'python-dotenv' 'pydantic' 'argon2-cffi' 'PyJWT' 'uvicorn'
```

Only `argon2-cffi` and `PyJWT` are new authentication libraries if your previous phases' packages are already installed. Add them to your existing backend requirements list.

## 3. Configure the signing secret

Keep your existing database URL in **`app/.env`**. Add a new line `AUTH_SECRET_KEY=...` to that file.

Generate a random key from your terminal:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the output after `AUTH_SECRET_KEY=`. Do not use the placeholder `CHANGE_ME`, reuse someone else's key, or commit `.env` to Git. Keep `.env` in your `.gitignore`.

Example:

```dotenv
DATABASE_URL=postgresql+psycopg://...your-existing-connection...
AUTH_SECRET_KEY=your_own_very_long_random_secret
```

## 4. Add tables and create the first admin

From the **project root**:

```bash
python -m app.create_tables
python -m app.seed_admin
```

- `create_tables` adds **users**, **student_user_links**, and **teacher_students** to PostgreSQL; preserves your three original data tables.
- `seed_admin` asks for an admin email, name and password (minimum **12 characters**) interactively. Your password is hashed with Argon2id, not stored as plain text.
- Run `seed_admin` once to create your first administrator. Existing students do not automatically get accounts; an admin must link accounts to student records.
- `create_tables` is a safe **add-tables** convenience for this phase. Later schema modifications should use Alembic migrations.

## 5. Start the app

**Backend**, from `FLP-Project/`:

```bash
uvicorn app.main:app --reload
```

**Frontend**, separate terminal:

```bash
cd frontend
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Sign in using your bootstrap admin credentials. Backend Swagger is `http://127.0.0.1:8000/docs`. For protected Swagger endpoints, use the **Authorize** button and paste the bearer token from `/auth/login` (do not share tokens).

## 6. Test each role (in this order)

1. **Admin:** Sign in; existing dashboard/student records should work. Under **Users & assignments**, create a Teacher, a Student login, and an Analyst login.
2. **Admin:** Under **Users & assignments**, select an existing student; link their Student login; assign that student to a Teacher. These are **two different actions**.
3. **Teacher:** Sign in. Only students explicitly assigned to this teacher appear. Teacher-created student records are assigned automatically to their creator. Run a prediction; its history should save normally.
4. **Student:** Sign in. See only your own academic record (if linked). **No dropout scores, predictions, history or other student records.**
5. **Analyst:** Sign in. See counts/breakdown; **no student names, individual prediction rows, or student-record APIs**.
6. **Access checks:** Log out and request `/students` without a token (expect HTTP 401). Attempt `/students` as Student/Analyst (403); attempt an unassigned student's record as Teacher (404). Disable a user account (old token immediately stops working).

## 7. Who can see what?

| Operation | Admin | Teacher | Student | Analyst |
| --- | --- | --- | --- | --- |
| Manage user accounts, assignments | Yes | No | No | No |
| Register students | Yes | Yes (auto-assigned) | No | No |
| View/edit academic records | All | Assigned only | Own read-only academic view | No |
| Run and see dropout predictions | All | Assigned only | **No** | No |
| Dashboard aggregates | All | Assigned only | No | Global aggregates only |
| Dashboard individual recent predictions | Yes | Assigned only | No | **No** |

## 8. Important notes

- Existing `/predict` is now **Admin/Teacher only**; existing `/students/*` and `/dashboard/*` now require authorization. `/health` and `/auth/login` remain public. `/form-options` is available to signed-in accounts.
- Login returns a **30-minute access token**. The frontend keeps it only in React memory, not localStorage: **refreshing the page requires logging in again**. Logout also invalidates existing tokens server-side. Deactivation/password reset also invalidates old tokens.
- The new `/me/student` returns only the signed-in student's own academic information, not risk estimates. Their academic inputs may include financial factors, so ensure appropriate consent/privacy policy before using real data.
- The admin page shows **up to 100 student records** and **up to 500 accounts** (search/pagination is the next improvement).
- For **local/test development**, the code is a useful RBAC foundation, but **not a finished production security assessment**. Before external deployment add HTTPS, login rate limiting, audit logs, account recovery policy, security headers, backups, user consent/data-retention controls, monitoring and a real security review. Avoid actual student personal data until these are ready.

## 9. Optional automated access tests

```bash
python -m pip install pytest httpx
python -m pytest tests/test_access.py -q
```

Tests create their own **temporary SQLite** database and stub the predictor. They never write to your PostgreSQL data. Unit/integration checks here are not a substitute for browser testing with your own FastAPI/PostgreSQL environment and real model.
