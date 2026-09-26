import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.database import engine

from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TYPE legalentitytype ADD VALUE IF NOT EXISTS 'COMPANY'"))
    conn.execute(text("ALTER TYPE legalentitytype ADD VALUE IF NOT EXISTS 'company'"))
    conn.commit()
print("Enum updated successfully!")
