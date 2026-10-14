# EduPredict — Phase 1: Training-safe student form

This phase adds original categorical labels and input validation to your **existing FastAPI application**. It does **not** change/retrain the trained model or create student database tables.

## Install in your existing project

1. Copy `app/feature_options.py` into your existing `app/` directory.
2. Back up `app/main.py`, then replace it with the included `app/main.py` (adapted from the main.py you uploaded).
3. From the root of your project, start FastAPI using your existing command, usually:

   ```bash
   source .venv/bin/activate
   uvicorn app.main:app --reload
   ```

4. Open `http://127.0.0.1:8000/docs`, try `GET /form-options` and `POST /predict`.

## Frontend contract

Build the 13 form fields from `GET /form-options`. Each item includes `name`, `type`, and, for dropdown fields, `options: [{value, label}]`.

- Display `option.label` to the user.
- Submit `option.value` as its **original numeric dataset code**.
- Use `name` (including spaces and capitals) as the JSON key when submitting to `/predict`.
- All numeric fields should submit valid numbers, not text.
- The backend also accepts the exact human-readable dropdown labels and translates them to the model's numeric codes.

Example `/predict` body (all 13 features required):

```json
{
  "Application mode": "2nd phase - general contingent",
  "Course": "Tourism",
  "Previous qualification": "Secondary education",
  "Previous qualification (grade)": 122,
  "Admission grade": 127.3,
  "Debtor": "No",
  "Tuition fees up to date": "Yes",
  "Scholarship holder": "No",
  "Age at enrollment": 20,
  "Curricular units 1st sem (enrolled)": 6,
  "Curricular units 1st sem (evaluations)": 6,
  "Curricular units 1st sem (approved)": 5,
  "Curricular units 1st sem (grade)": 12.5
}
```

**Note:** Source mappings are based on the original UCI dataset. The 18 application-mode codes, 17 course codes and 17 previous-qualification codes were confirmed against the supplied training CSV. Some original labels reference Portuguese educational categories; retain original codes unless your model is retrained.

**Next phase:** Once you share your existing `app/database.py`, `app/models.py`, and `app/create_tables.py`, we can safely add registration, academic records, and prediction history without overwriting your database design.
