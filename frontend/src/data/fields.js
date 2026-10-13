export const fields = [
  {
    section: "Student details",
    key: "Application mode",
    label: "Application mode code",
    kind: "code",
  },
  { section: "Student details", key: "Course", label: "Course code", kind: "code" },
  {
    section: "Student details",
    key: "Previous qualification",
    label: "Previous qualification code",
    kind: "code",
  },
  {
    section: "Student details",
    key: "Previous qualification (grade)",
    label: "Previous qualification grade",
    kind: "number",
  },
  {
    section: "Student details",
    key: "Admission grade",
    label: "Admission grade",
    kind: "number",
  },
  { section: "Student details", key: "Debtor", label: "Debtor", kind: "yesNo" },
  {
    section: "Student details",
    key: "Tuition fees up to date",
    label: "Tuition fees up to date",
    kind: "yesNo",
  },
  {
    section: "Student details",
    key: "Scholarship holder",
    label: "Scholarship holder",
    kind: "yesNo",
  },
  {
    section: "Student details",
    key: "Age at enrollment",
    label: "Age at enrollment",
    kind: "number",
  },
  {
    section: "First semester",
    key: "Curricular units 1st sem (enrolled)",
    label: "Curricular units enrolled",
    kind: "number",
  },
  {
    section: "First semester",
    key: "Curricular units 1st sem (evaluations)",
    label: "Curricular units evaluations",
    kind: "number",
  },
  {
    section: "First semester",
    key: "Curricular units 1st sem (approved)",
    label: "Curricular units approved",
    kind: "number",
  },
  {
    section: "First semester",
    key: "Curricular units 1st sem (grade)",
    label: "Curricular units grade",
    kind: "number",
  },
];

export const sections = ["Student details", "First semester"];
export const emptyValues = Object.fromEntries(fields.map(({ key }) => [key, ""]));
