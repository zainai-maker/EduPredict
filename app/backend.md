# EduPredict Backend - Codex Terra Task

## Goal
Build a **small FastAPI backend** that uses the **existing trained Decision Tree** to predict whether a student will **Dropout** or **Graduate**. Do not retrain or change the model.

## Read first
- Inspect the current repository before creating or changing files.
- Read `README.md` for the actual model history and feature list.
- Find the saved model (`decision_tree_model.pkl` or its real filename), and any saved preprocessing/encoding files.
- If the model or a required encoder is missing, **report exactly what is missing**. Do not generate a fake model, invent mappings, or silently retrain one.

## Existing model facts
- Framework: scikit-learn Decision Tree, trained in Python.
- Labels: `0 = Dropout`, `1 = Graduate` (`Enrolled` is excluded).
- Input: 13 student features, in the **same order and format used in training**.
- Reported held-out test accuracy: **87.34%**; Dropout recall: **81.69%**. These are historical results, not API acceptance targets.

## Input features
1. `Application mode`
2. `Course`
3. `Previous qualification`
4. `Previous qualification (grade)`
5. `Admission grade`
6. `Debtor`
7. `Tuition fees up to date`
8. `Scholarship holder`
9. `Age at enrollment`
10. `Curricular units 1st sem (enrolled)`
11. `Curricular units 1st sem (evaluations)`
12. `Curricular units 1st sem (approved)`
13. `Curricular units 1st sem (grade)`

## Scope: implement only these things
1. Set up FastAPI with minimal dependencies: `fastapi`, `uvicorn`, `pandas`, `scikit-learn`, `joblib` (plus what the actual saved model requires).
2. Load the **trusted saved model once** when the application starts; do not load it on every request.
3. Implement `POST /predict` accepting one student's 13 fields in JSON.
4. Validate required fields, data types, missing values, and available category codes; return clear HTTP 422 errors for invalid input.
5. Convert incoming values into the **exact model input format**, including column names/order and any real saved preprocessing steps.
6. Return the prediction as `Dropout` or `Graduate`. If `predict_proba` is available, also return `dropout_risk_percent` as an **estimate**, not a guaranteed risk.
7. Add `GET /health` returning a simple healthy status and confirm the API is accessible via FastAPI's `/docs`.

## Human-readable input: important
- The training CSV stores some categories as **number codes** (`Course`, `Application mode`, `Previous qualification`).
- Accept readable text labels **only if** a verified label-to-code mapping exists in the project or is supplied by me.
- Never guess that a text label such as `Computer Science` corresponds to a particular numeric code.
- Until those mappings exist, accept the original numeric category codes, while keeping the JSON field names readable.
- Reuse any real encoder fitted at training time; do not fit a new encoder during prediction.

## Keep it simple
- Small structure is enough: `app/main.py`, `app/predictor.py`, `requirements.txt` (adapt to existing repo layout).
- No authentication, database, Hadoop, HDFS, PySpark, frontend, Docker, deployment, background jobs, or extra ML models **at this stage**.
- Do not log or store students' personal information. Use local or synthetic examples while authentication is absent.
- Do not refactor unrelated code or add abstractions that are not needed.

## Verification and handoff
- Run the app locally with Uvicorn.
- Test one valid `/predict` request and one invalid request; confirm the invalid one gives a useful 422 message.
- Ensure the prediction matches calling the **same saved model** directly with the same prepared 13 features.
- Provide the exact install/start commands, an example JSON request, the response format, and a short list of files changed.
- If a model/encoder/mapping is missing, stop at that blocker and ask for it rather than pretending the API is complete.
