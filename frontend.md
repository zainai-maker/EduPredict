# EduPredict Frontend - Codex Terra Task

## Goal
Build a **simple React frontend** for the existing FastAPI Decision Tree backend.
A user enters one student's information, clicks **Predict**, and sees
**Dropout** or **Graduate**, plus estimated dropout risk if the API returns it.
Do not change or retrain the model.

## Read first
- Inspect the existing repository and FastAPI code before creating files.
- Read `README.md` and `backend.md` if available.
- Check the **actual** `POST /predict` request and response using the code or `/docs`.
- Reuse any existing frontend setup; otherwise create a minimal **React + Vite** app.
- Match the backend's actual field names, value types, and response format.
  Do not assume a response schema or invent new category mappings.

## One-page interface only
- Title: **EduPredict - Student Outcome Prediction**.
- Short note: "Enter student details to estimate Dropout or Graduate."
- A clear form split visually into **Student details** and **First semester**.
- One **Predict** button and one result area below the form.
- Simple, readable, responsive styling; plain CSS is enough.
- No extra pages, routing, UI libraries, charts, or dashboards.

## Required input fields (use these exact API keys)
Student details:
1. `Application mode` - category code
2. `Course` - category code
3. `Previous qualification` - category code
4. `Previous qualification (grade)` - number
5. `Admission grade` - number
6. `Debtor` - Yes / No (send 1 / 0)
7. `Tuition fees up to date` - Yes / No (send 1 / 0)
8. `Scholarship holder` - Yes / No (send 1 / 0)
9. `Age at enrollment` - number

First semester:
10. `Curricular units 1st sem (enrolled)` - number
11. `Curricular units 1st sem (evaluations)` - number
12. `Curricular units 1st sem (approved)` - number
13. `Curricular units 1st sem (grade)` - number

## Input behavior
- Show friendly labels; keep the JSON keys exactly as the backend expects.
- Where verified code-to-name mappings exist, show readable dropdown choices
  and send their actual numeric codes.
- Otherwise, use clearly labeled numeric code inputs for categorical fields.
  **Never invent** labels such as a course name for an unknown code.
- Use number inputs for numeric fields; preserve decimal grades.
- Require all 13 fields, with clear validation messages for missing/invalid input.
- Send numeric JSON values, not numeric strings; do **not** send `target`.
- Avoid made-up score limits or extra business rules not supported by the backend.

## API integration
- Use the existing FastAPI `POST /predict` endpoint.
- Configure the backend URL using `VITE_API_BASE_URL` (document its value).
- Submit one student as a JSON object with the 13 fields above.
- Show a loading state and disable repeat submissions while waiting.
- Show the predicted label from the real API response (`Dropout` / `Graduate`).
- If the response contains `dropout_risk_percent`, display it as an **estimate**.
- If no probability is returned, show only the prediction; do not manufacture one.
- Show readable error messages for API/network errors and invalid requests.
- Do not log, save, or transmit student data anywhere except the prediction API.

## Keep out of scope
- No authentication, user roles, database, saved predictions, student profiles.
- No Hadoop, analytics dashboard, notifications, history, or model training.
- No mock predictions, fake API data, complex state-management, or extra packages.
- Do not refactor backend logic; adjust local CORS only if required to connect
  the React development server, without exposing the API publicly.

## Verification & handoff
- Start the frontend locally; document install/run commands.
- Test one valid student input against the **running backend**.
- Confirm the output matches the result from FastAPI `/docs` for that input.
- Test missing fields, a wrong value, loading state, and unreachable backend.
- Briefly report created/changed files, how to start, and any blockers.
- If the backend contract or category mappings are unavailable, report that
  limitation instead of guessing or adding unnecessary new functionality.
