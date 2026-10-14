// Display grouping and labels only. Option labels/codes/ranges come from FastAPI /form-options.
export const fields = [
  { section: "Student details", key: "Application mode", label: "Application mode" },
  { section: "Student details", key: "Course", label: "Course" },
  { section: "Student details", key: "Previous qualification", label: "Previous qualification" },
  { section: "Student details", key: "Previous qualification (grade)", label: "Previous qualification grade" },
  { section: "Student details", key: "Admission grade", label: "Admission grade" },
  { section: "Student details", key: "Debtor", label: "Debtor" },
  { section: "Student details", key: "Tuition fees up to date", label: "Tuition fees up to date" },
  { section: "Student details", key: "Scholarship holder", label: "Scholarship holder" },
  { section: "Student details", key: "Age at enrollment", label: "Age at enrollment" },
  { section: "First semester", key: "Curricular units 1st sem (enrolled)", label: "Curricular units enrolled" },
  { section: "First semester", key: "Curricular units 1st sem (evaluations)", label: "Curricular units evaluations" },
  { section: "First semester", key: "Curricular units 1st sem (approved)", label: "Curricular units approved" },
  { section: "First semester", key: "Curricular units 1st sem (grade)", label: "Curricular units grade" },
];

export const sections = ["Student details", "First semester"];
export const emptyValues = Object.fromEntries(fields.map(({ key }) => [key, ""]));
