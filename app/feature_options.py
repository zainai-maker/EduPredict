"""Student form metadata and original UCI dataset categorical codes.

Codes sourced from: https://archive.ics.uci.edu/dataset/697/
predict+students+dropout+and+academic+success

Never replace these codes with the index of a dropdown item: the trained model
expects the original numeric values.
"""

from __future__ import annotations

import math


FEATURE_ORDER = (
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

# Each key is an original dataset field name; every dropdown value is the
# unchanged code used by the training data.
CATEGORICAL_OPTIONS: dict[str, dict[int, str]] = {
    "Application mode": {
        1: "1st phase - general contingent",
        2: "Ordinance No. 612/93",
        5: "1st phase - special contingent (Azores Island)",
        7: "Holders of other higher courses",
        10: "Ordinance No. 854-B/99",
        15: "International student (bachelor)",
        16: "1st phase - special contingent (Madeira Island)",
        17: "2nd phase - general contingent",
        18: "3rd phase - general contingent",
        26: "Ordinance No. 533-A/99, item b2) (Different Plan)",
        27: "Ordinance No. 533-A/99, item b3 (Other Institution)",
        39: "Over 23 years old",
        42: "Transfer",
        43: "Change of course",
        44: "Technological specialization diploma holders",
        51: "Change of institution/course",
        53: "Short cycle diploma holders",
        57: "Change of institution/course (International)",
    },
    "Course": {
        33: "Biofuel Production Technologies",
        171: "Animation and Multimedia Design",
        8014: "Social Service (evening attendance)",
        9003: "Agronomy",
        9070: "Communication Design",
        9085: "Veterinary Nursing",
        9119: "Informatics Engineering",
        9130: "Equinculture",
        9147: "Management",
        9238: "Social Service",
        9254: "Tourism",
        9500: "Nursing",
        9556: "Oral Hygiene",
        9670: "Advertising and Marketing Management",
        9773: "Journalism and Communication",
        9853: "Basic Education",
        9991: "Management (evening attendance)",
    },
    "Previous qualification": {
        1: "Secondary education",
        2: "Higher education - bachelor's degree",
        3: "Higher education - degree",
        4: "Higher education - master's",
        5: "Higher education - doctorate",
        6: "Frequency of higher education",
        9: "12th year of schooling - not completed",
        10: "11th year of schooling - not completed",
        12: "Other - 11th year of schooling",
        14: "10th year of schooling",
        15: "10th year of schooling - not completed",
        19: "Basic education 3rd cycle (9th/10th/11th year) or equiv.",
        38: "Basic education 2nd cycle (6th/7th/8th year) or equiv.",
        39: "Technological specialization course",
        40: "Higher education - degree (1st cycle)",
        42: "Professional higher technical course",
        43: "Higher education - master (2nd cycle)",
    },
    "Debtor": {0: "No", 1: "Yes"},
    "Tuition fees up to date": {0: "No", 1: "Yes"},
    "Scholarship holder": {0: "No", 1: "Yes"},
}

# Limits are dataset-definition grade scales, or basic nonnegative-number checks.
# They are not the min/max values observed in this particular CSV sample.
NUMERIC_FIELDS: dict[str, dict[str, int | float | str]] = {
    "Previous qualification (grade)": {"min": 0, "max": 200, "step": "any"},
    "Admission grade": {"min": 0, "max": 200, "step": "any"},
    "Age at enrollment": {"min": 1, "step": 1},
    "Curricular units 1st sem (enrolled)": {"min": 0, "step": 1},
    "Curricular units 1st sem (evaluations)": {"min": 0, "step": 1},
    "Curricular units 1st sem (approved)": {"min": 0, "step": 1},
    "Curricular units 1st sem (grade)": {"min": 0, "max": 20, "step": "any"},
}


def build_form_fields() -> list[dict]:
    """API metadata to render the UI without duplicating model mappings."""
    result = []
    for field in FEATURE_ORDER:
        if field in CATEGORICAL_OPTIONS:
            result.append({
                "name": field,
                "label": field,
                "type": "select",
                "required": True,
                "options": [
                    {"value": code, "label": label}
                    for code, label in CATEGORICAL_OPTIONS[field].items()
                ],
            })
        else:
            result.append({
                "name": field,
                "label": field,
                "type": "number",
                "required": True,
                **NUMERIC_FIELDS[field],
            })
    return result


def dropdown_to_model_code(field: str, raw: object) -> float:
    """Accept the exact human label OR its code; return the original code.

    HTML selects generally send a string code (e.g. '9254'). React can also
    submit the displayed label (e.g. 'Tourism'). Both are supported.
    """
    options = CATEGORICAL_OPTIONS[field]
    code: int | None = None
    if isinstance(raw, bool):
        raise ValueError(f"{field} must be one of the listed options")
    if isinstance(raw, int):
        code = raw
    elif isinstance(raw, float):
        if math.isfinite(raw) and raw.is_integer():
            code = int(raw)
    elif isinstance(raw, str):
        text = raw.strip()
        labels = {label.casefold(): value for value, label in options.items()}
        if text.casefold() in labels:
            code = labels[text.casefold()]
        elif text.isdecimal():
            code = int(text)

    if code not in options:
        raise ValueError(f"Invalid option for {field}: {raw!r}")
    return float(code)


def check_numeric_fields(input_values: dict[str, float]) -> None:
    """Reject nonsensical numeric entries before sending them to the model."""
    for field, rules in NUMERIC_FIELDS.items():
        number = input_values[field]
        if "min" in rules and number < rules["min"]:
            raise ValueError(f"{field} must be at least {rules['min']}")
        if "max" in rules and number > rules["max"]:
            raise ValueError(f"{field} must be at most {rules['max']}")
        if rules["step"] == 1 and not number.is_integer():
            raise ValueError(f"{field} must be a whole number")
