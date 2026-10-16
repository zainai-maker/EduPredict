# EduPredict — Phase 4: Student Dashboard & Analytics

This phase adds a **read-only student dashboard** to your existing FastAPI + PostgreSQL + React app. It keeps the trained Decision Tree and all 13 training features unchanged. **No new tables or packages are required.**

## Install (starting from your working Phase 3)

Back up your existing files before replacing them.

1. Copy `app/dashboard_routes.py` into your existing `app/` folder.
2. Update your existing `app/main.py` by adding these **two lines**, in the right places:

   ```python
   from app.dashboard_routes import router as dashboard_router  # with imports
   app.include_router(dashboard_router)  # after app = FastAPI(...)
   ```

   An example updated `app/main.py` is included for reference, but **keeping your actual main.py and adding only those two lines is safer** if you have made local changes.
3. Replace `frontend/src/App.jsx` with the included `frontend/src/App.jsx`.
4. Add `frontend/src/components/Dashboard.jsx` and `frontend/src/components/Dashboard.css`.
5. Keep the existing `PredictionForm.jsx`, `PredictionResult.jsx`, `fields.js`, database files, predictor, `.env`, `package.json`, and stylesheets.

## Run

From the **project root**:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload
```

From `frontend/` in a separate terminal:

```bash
npm run dev
```

No need to run `create_tables.py` again — the dashboard reads the tables you already created.

## Check

1. Open `http://127.0.0.1:8000/docs` and run `GET /dashboard/summary`. You should see the counts and a `recent_predictions` array.
2. Open the frontend. It now has **Dashboard** and **Student records & predictions** tabs.
3. The Dashboard should show the student you already registered and their saved prediction.
4. Under **Student records & predictions**, create or predict for another student. Return to **Dashboard** and check the refreshed numbers.
5. Click **Refresh data** if another browser/tab made changes.

## What the numbers actually mean

- **Registered students:** total saved student profiles.
- **Students with predictions:** unique students with at least one saved prediction.
- **Predicted dropout / predicted graduate:** the *latest* prediction for each student, so multiple predictions do not double-count students.
- **Awaiting prediction:** registered students who have no saved prediction yet.
- **Predicted dropout share:** predicted dropout / students with predictions (not the actual/observed dropout rate). Shows `—` when none have been predicted.
- **Total prediction runs:** all historical prediction rows.
- **Recent predictions:** latest 10 saved runs, including reruns for the same student.

**Caution:** The model's 100% risk number is an estimate, not a guarantee. The dashboard does not measure real-world retention accuracy.

## Safety and limitations

- The API is **not authenticated**. Only test with non-sensitive demo students on a local/private development system. Do not publicly deploy without access controls and appropriate data protection.
- No destructive database operations, schema changes, data imports, or ML retraining.
- The student selector on the existing form still shows at most the first 100 students. Search/pagination belongs to a later phase; **dashboard counts do not have that 100-student limitation**.
- Backend statistics were tested in an isolated SQLite test database (empty database, latest-per-student counts, pending students, and history ordering). JSX parsed successfully. Your full PostgreSQL + model + browser environment has **not** been tested here.
