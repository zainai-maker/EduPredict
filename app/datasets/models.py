"""Historical upload tables; intentionally NOT linked to live Student records."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, func
from app.database import Base


class DatasetBatch(Base):
    __tablename__ = 'dataset_batches'

    id = Column(Integer, primary_key=True)
    filename = Column(String(150), nullable=False)
    file_sha256 = Column(String(64), nullable=False, unique=True)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    row_count = Column(Integer, nullable=False)
    labeled_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DatasetRow(Base):
    __tablename__ = 'dataset_rows'
    __table_args__ = (UniqueConstraint('batch_id', 'row_number', name='uq_dataset_row_number'),)

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey('dataset_batches.id', ondelete='CASCADE'), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)  # Physical CSV row number (header is 1).
    features = Column(JSON, nullable=False)
    actual_outcome = Column(Integer, nullable=True)  # 0 dropout / 1 graduate. Not a model prediction.
