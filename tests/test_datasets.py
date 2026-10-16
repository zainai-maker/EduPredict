"""FastAPI historical dataset import tests (temporary SQLite, fake predictor).

Run from project root: python -m pytest -q tests/test_datasets.py
"""
import csv
import io
import os
import tempfile
from pathlib import Path

os.environ.setdefault('DATABASE_URL', 'sqlite+pysqlite:///:memory:')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import auth_models, models  # noqa: F401
from app.auth_models import User
from app.database import Base, get_db
from app.datasets import models as dataset_models  # noqa: F401
from app.datasets.models import DatasetBatch, DatasetRow
from app.feature_options import FEATURE_ORDER
from app.main import app
from app.security import hash_password

BASE = {
    'Application mode': '39', 'Course': '33', 'Previous qualification': '1',
    'Previous qualification (grade)': '130', 'Admission grade': '102.5',
    'Debtor': '1', 'Tuition fees up to date': '0', 'Scholarship holder': '0',
    'Age at enrollment': '37', 'Curricular units 1st sem (enrolled)': '7',
    'Curricular units 1st sem (evaluations)': '7',
    'Curricular units 1st sem (approved)': '0',
    'Curricular units 1st sem (grade)': '0', 'target': '0',
}


def csv_bytes(rows, include_target=True):
    result = io.StringIO()
    columns = list(FEATURE_ORDER) + (['target'] if include_target else [])
    writer = csv.DictWriter(result, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({c: row[c] for c in columns})
    return result.getvalue().encode('utf-8')


def uploaded_file(data, name='history.csv'):
    return {'file': (name, io.BytesIO(data), 'text/csv')}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('AUTH_SECRET_KEY', 'TEST_ONLY_STRONG_JWT_SIGNING_KEY_ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    with tempfile.TemporaryDirectory() as folder:
        engine = create_engine(f'sqlite+pysqlite:///{Path(folder) / "datasets.sqlite"}')
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine, expire_on_commit=False)
        with Session() as db:
            for role in ('admin', 'teacher', 'student', 'analyst'):
                db.add(User(role=role, email=f'{role}@example.test', full_name=role.title(),
                            password_hash=hash_password('example-password-123')))
            db.commit()

        def override():
            with Session() as db:
                yield db

        app.dependency_overrides[get_db] = override
        try:
            testclient = TestClient(app)
            testclient._test_session = Session
            yield testclient
        finally:
            app.dependency_overrides.clear()
            engine.dispose()


def auth(client, role):
    response = client.post('/auth/login', json={
        'email': f'{role}@example.test', 'password': 'example-password-123'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def test_admin_only(client):
    data = csv_bytes([BASE])
    assert client.get('/datasets').status_code == 401
    for role in ('student', 'teacher', 'analyst'):
        headers = auth(client, role)
        assert client.get('/datasets', headers=headers).status_code == 403
        assert client.post('/datasets/preview', headers=headers, files=uploaded_file(data)).status_code == 403
        assert client.post('/datasets/import', headers=headers, files=uploaded_file(data)).status_code == 403


def test_preview_import_duplicate_and_no_fake_students(client):
    admin = auth(client, 'admin')
    labeled = BASE.copy()
    labeled['Application mode'] = 'Over 23 years old'
    labeled['Course'] = 'Biofuel Production Technologies'
    labeled['Debtor'] = 'Yes'
    second = BASE.copy()
    second['target'] = '1'
    data = csv_bytes([labeled, second])
    preview = client.post('/datasets/preview', headers=admin, files=uploaded_file(data))
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert (body['total_rows'], body['valid_rows'], body['invalid_rows'], body['labeled_rows']) == (2, 2, 0, 2)
    assert body['sample'][0]['features']['Course'] == 33
    assert body['sample'][0]['features']['Debtor'] == 1
    with client._test_session() as db:
        assert db.query(DatasetBatch).count() == 0

    imported = client.post('/datasets/import', headers=admin, files=uploaded_file(data))
    assert imported.status_code == 201, imported.text
    assert imported.json()['row_count'] == 2
    assert imported.json()['labeled_count'] == 2
    assert client.post('/datasets/import', headers=admin, files=uploaded_file(data)).status_code == 409
    assert len(client.get('/datasets', headers=admin).json()) == 1
    with client._test_session() as db:
        assert db.query(DatasetRow).count() == 2
        assert db.query(models.Student).count() == 0
        assert db.query(models.Prediction).count() == 0
        assert [r.actual_outcome for r in db.query(DatasetRow).order_by(DatasetRow.id)] == [0, 1]


def test_invalid_rows_are_atomic(client):
    admin = auth(client, 'admin')
    invalid = BASE.copy()
    invalid['Course'] = '999999'
    invalid['target'] = '2'
    data = csv_bytes([BASE, invalid])
    preview = client.post('/datasets/preview', headers=admin, files=uploaded_file(data))
    assert preview.status_code == 200, preview.text
    assert preview.json()['invalid_rows'] == 1
    assert preview.json()['issues'][0]['row'] == 3
    assert client.post('/datasets/import', headers=admin, files=uploaded_file(data)).status_code == 422
    with client._test_session() as db:
        assert db.query(DatasetBatch).count() == 0
        assert db.query(DatasetRow).count() == 0


def test_no_target_and_broken_headers(client):
    admin = auth(client, 'admin')
    data = csv_bytes([BASE], include_target=False)
    imported = client.post('/datasets/import', headers=admin, files=uploaded_file(data))
    assert imported.status_code == 201, imported.text
    assert imported.json()['labeled_count'] == 0
    with client._test_session() as db:
        assert db.query(DatasetRow).one().actual_outcome is None
    assert client.post('/datasets/preview', headers=admin,
        files=uploaded_file(b'Course,Age at enrollment\n999,21\n')).status_code == 422
    assert client.post('/datasets/preview', headers=admin,
        files=uploaded_file(data, name='invalid.txt')).status_code == 422


def test_invalid_numeric_and_bad_encoding(client):
    admin = auth(client, 'admin')
    row = BASE.copy()
    row['Admission grade'] = 'NaN'
    preview = client.post('/datasets/preview', headers=admin, files=uploaded_file(csv_bytes([row])))
    assert preview.status_code == 200
    assert preview.json()['invalid_rows'] == 1
    assert client.post('/datasets/preview', headers=admin,
        files=uploaded_file(b'\xff\xfe')).status_code == 422


def test_real_training_csv_parses_when_available(client):
    # Optional local regression: not required for a project installation.
    training_csv = Path(__file__).resolve().parents[1] / 'new_student_dropout_data.csv'
    if not training_csv.exists():
        pytest.skip('Original CSV is not available in this test environment')
    admin = auth(client, 'admin')
    result = client.post('/datasets/preview', headers=admin, files={
        'file': ('dataset.csv', training_csv.read_bytes(), 'text/csv')})
    assert result.status_code == 200, result.text
    assert result.json()['total_rows'] == 3630
    assert result.json()['invalid_rows'] == 0, result.json()['issues']
    imported = client.post('/datasets/import', headers=admin, files={
        'file': ('dataset.csv', training_csv.read_bytes(), 'text/csv')})
    assert imported.status_code == 201, imported.text
    assert imported.json()['row_count'] == 3630
    with client._test_session() as db:
        assert db.query(DatasetRow).count() == 3630
