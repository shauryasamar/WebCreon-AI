import os

from sqlmodel import SQLModel, Session, create_engine


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://webnirmaan:devpassword@localhost:5432/webnirmaan",
)


engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session