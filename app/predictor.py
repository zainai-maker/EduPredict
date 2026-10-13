"""Model loading and prediction preparation for the EduPredict API."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


FEATURE_COLUMNS = (
    "Application mode",
    "Course",
    "Previous qualification",
    "Previous qualification (grade)",
    "Admission grade",
    "Debtor",
    "Tuition fees up to date",
    "Scholarship holder",
    "Age at enrollment",
    "Curricular units 1st sem (enrolled)",
    "Curricular units 1st sem (evaluations)",
    "Curricular units 1st sem (approved)",
    "Curricular units 1st sem (grade)",
)

CATEGORY_COLUMNS = (
    "Application mode",
    "Course",
    "Previous qualification",
    "Debtor",
    "Tuition fees up to date",
    "Scholarship holder",
)


class InputValidationError(ValueError):
    """Raised when values cannot be safely passed to the trained model."""


@dataclass
class Predictor:
    """Loads the persisted model once and prepares its input consistently."""

    model_path: Path
    data_path: Path
    model: Any | None = None
    category_codes: dict[str, set[float]] | None = None

    def load(self) -> None:
        """Load and verify the trusted model and its training-data category codes."""
        if not self.model_path.is_file():
            raise RuntimeError(f"Saved model is missing: {self.model_path}")
        if not self.data_path.is_file():
            raise RuntimeError(
                "Training data is missing; category codes cannot be validated: "
                f"{self.data_path}"
            )

        self.model = joblib.load(self.model_path)
        model_features = tuple(getattr(self.model, "feature_names_in_", ()))
        if model_features != FEATURE_COLUMNS:
            raise RuntimeError(
                "The saved model feature names do not match the API's expected "
                "13 input fields."
            )

        data = pd.read_csv(self.data_path)
        missing_columns = set(FEATURE_COLUMNS) - set(data.columns)
        if missing_columns:
            raise RuntimeError(
                "Training data is missing columns required to validate category "
                f"codes: {sorted(missing_columns)}"
            )
        self.category_codes = {
            column: set(data[column].dropna().astype(float))
            for column in CATEGORY_COLUMNS
        }

    def predict(self, values: dict[str, float]) -> tuple[int, float | None]:
        """Validate and predict from a single, correctly ordered student record."""
        if self.model is None or self.category_codes is None:
            raise RuntimeError("Predictor has not been loaded.")

        errors: list[str] = []
        for column in CATEGORY_COLUMNS:
            value = float(values[column])
            if not value.is_integer():
                errors.append(f"'{column}' must be a whole-number category code.")
            elif value not in self.category_codes[column]:
                errors.append(f"'{column}' has unavailable category code {int(value)}.")
        if errors:
            raise InputValidationError(" ".join(errors))

        student = pd.DataFrame(
            [[float(values[column]) for column in FEATURE_COLUMNS]],
            columns=FEATURE_COLUMNS,
        )
        prediction = int(self.model.predict(student)[0])
        if prediction not in (0, 1):
            raise RuntimeError(f"The saved model returned unsupported label {prediction}.")

        dropout_risk: float | None = None
        if callable(getattr(self.model, "predict_proba", None)):
            classes = list(self.model.classes_)
            if 0 in classes:
                probabilities = self.model.predict_proba(student)[0]
                dropout_risk = float(probabilities[classes.index(0)] * 100)

        return prediction, dropout_risk
