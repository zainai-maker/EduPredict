"""Initialize tables only; existing PostgreSQL tables are preserved."""
from app.database import Base, engine
from app import models, auth_models  # noqa: F401
from app.datasets import models as dataset_models  # noqa: F401

Base.metadata.create_all(bind=engine)
print('Database tables are ready (including historical dataset imports).')
