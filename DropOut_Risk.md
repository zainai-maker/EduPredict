# EduPredict — Student Dropout Prediction

A simple machine learning model that predicts whether a student will **Dropout** or **Graduate**.

This README documents the Decision Tree model built so far.
It does not describe the full EduPredict Big Data application.

## 1. Current status

- Model: Decision Tree Classifier (scikit-learn).
- Task: Binary classification (two possible outcomes).
- Training and held-out testing: Completed.
- Manual prediction: Available using the trained model in Google Colab.
- Web application, Hadoop, and real-time processing: Not part of this model yet.

## 2. Dataset

- Original dataset: `new_studetn_dropout.csv`.
- Prepared dataset: `new_student_dropout_data(1).csv`.
- Original records: **4,424**.
- Removed `Enrolled` records: **794**.
- Records used for binary classification: **3,630**.
- Input features: **13**.
- Target column: `target`.
- Missing values in the prepared CSV: **0**.

### Target labels

| Value | Meaning | Records |
| --- | --- | ---: |
| `0` | Dropout | 1,421 |
| `1` | Graduate | 2,209 |

`Enrolled` was excluded because those students had not yet reached a final outcome.

### Input features

The model takes the following 13 fields:
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

Some fields contain numeric *category codes*, not measurements.
For example, `Course` is a course code; it is not a numerical score.
Use the same code meanings as in the training dataset.

## 3. Data preparation

The completed preparation process was:

1. Remove the unnecessary `Unnamed: 0` index column.
2. Exclude students whose target was `Enrolled`.
3. Map `Dropout` to `0` and `Graduate` to `1`.
4. Separate input features (`X`) from the correct answers (`y`).
5. Split the data into training, validation, and test sets.

The prepared CSV already contains `0` and `1` target labels.
Do not map the target again when loading that prepared file.
Feature scaling is not required for this Decision Tree.
One-hot encoding was discussed but is not confirmed as part of the tested model.

## 4. Environment

The project was trained and tested using Python in Google Colab.

Required Python packages:

```bash
pip install pandas scikit-learn joblib
```

Upload the prepared CSV to your Colab session before running the code below.

## 5. Load and split the prepared data

```python
import pandas as pd
from sklearn.model_selection import train_test_split

df = pd.read_csv("new_student_dropout_data(1).csv")
df = df.drop(columns=["Unnamed: 0"])

X = df.drop(columns=["target"])
y = df["target"]

X_train, X_temp, y_train, y_temp = train_test_split(
    X, y, test_size=0.30, random_state=42, stratify=y
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
)
```

- Training: 70% — teach the model.
- Validation: 15% — compare settings without using test data.
- Testing: 15% — final check on unseen records.

## 6. Train the Decision Tree

This is the basic training setup used in the project walkthrough:

```python
from sklearn.tree import DecisionTreeClassifier

model = DecisionTreeClassifier(max_depth=6, random_state=42)
model.fit(X_train, y_train)
```

A weighted version (`class_weight={0: 2, 1: 1}`) was also discussed
as an experiment to prioritize identifying dropouts.
The final reported scores below should not be attributed to that
experiment unless you confirm you retrained and tested that version.

## 7. Evaluate the model

Use the validation set while experimenting with settings.
Only use the test set for your final performance report.

```python
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score
)

y_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print("Precision:", precision_score(y_test, y_pred, pos_label=0))
print("Recall:", recall_score(y_test, y_pred, pos_label=0))
print("F1:", f1_score(y_test, y_pred, pos_label=0))
```

Here, `pos_label=0` means we are evaluating **Dropout** predictions.

### Reported test results

| Metric | Result |
| --- | ---: |
| Accuracy | **87.34%** |
| Dropout precision | **85.29%** |
| Dropout recall | **81.69%** |
| Dropout F1-score | **83.45%** |
| Test students | **545** |
| Correct predictions | **476** |
| Wrong predictions | **69** |

Of the **213 actual dropouts** in the test set, the model identified
**174** correctly and missed **39** (predicted Graduate instead).
These are the reported results, not a guarantee for other universities.

## 8. Save and reload the model

```python
import joblib
joblib.dump(model, "decision_tree_model.pkl")

# In a future Colab session:
model = joblib.load("decision_tree_model.pkl")
```

Keep the `.pkl` file with your project files or load it from Google Drive.

## 9. Predict a student's outcome

Enter values for all 13 features, using the same training codes.
Run the following after training or loading the model:

```python
student_data = {}
for column in X.columns:
    student_data[column] = float(input(f"Enter {column}: "))

student = pd.DataFrame([student_data], columns=X.columns)
prediction = model.predict(student)[0]
print("Prediction:", "Dropout" if prediction == 0 else "Graduate")
```

The output is a **prediction**, not a confirmed future outcome.
The first-semester input fields are available only after that semester.

## 10. Current limitations and next step

- `Enrolled` students were excluded from training and evaluation.
- The dataset is relatively small and has more graduates than dropouts.
- Around 18% of actual dropouts in the test set were missed.
- Results on genuinely new student populations have not been validated.
- Do not use predictions alone for decisions affecting students.

**Next step:** Keep this Decision Tree as the current baseline.
Verify that the saved `.pkl` file works with manually entered student data,
and preserve the notebook, prepared CSV, and test results together.
