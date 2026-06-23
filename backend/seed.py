"""Create tables and seed default cartons, sample items, and system settings."""
from .database import Base, SessionLocal, engine
from .models import Carton, Item, Setting

# Default fraction of a carton's volume usable for items (the rest is padding).
DEFAULT_FILL_RATE = 0.8
# Default item placement strategy (see packing.STRATEGIES).
DEFAULT_STRATEGY = "volume"

# Standard shipping carton inner dimensions (length, width, height) in cm.
DEFAULT_CARTONS = [
    ("XS  20x15x10", 20, 15, 10, 5),
    ("S   30x20x15", 30, 20, 15, 10),
    ("M   40x30x20", 40, 30, 20, 20),
    ("L   50x40x30", 50, 40, 30, 30),
    ("XL  60x50x40", 60, 50, 40, 40),
    ("XXL 80x60x50", 80, 60, 50, 60),
]

SAMPLE_ITEMS = [
    ("Book", 24, 17, 3, 0.4),
    ("Mug", 12, 9, 9, 0.3),
    ("Shoe box", 33, 20, 12, 0.8),
    ("Notebook", 21, 15, 2, 0.2),
    ("Bottle", 8, 8, 25, 0.6),
]


def init_db(seed_samples: bool = True) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Carton).count() == 0:
            for name, length, width, height, max_w in DEFAULT_CARTONS:
                db.add(
                    Carton(
                        name=name,
                        length=length,
                        width=width,
                        height=height,
                        max_weight=max_w,
                    )
                )
        if seed_samples and db.query(Item).count() == 0:
            for name, length, width, height, weight in SAMPLE_ITEMS:
                db.add(
                    Item(
                        name=name,
                        length=length,
                        width=width,
                        height=height,
                        weight=weight,
                    )
                )
        if db.get(Setting, "fill_rate") is None:
            db.add(Setting(key="fill_rate", value=str(DEFAULT_FILL_RATE)))
        if db.get(Setting, "strategy") is None:
            db.add(Setting(key="strategy", value=DEFAULT_STRATEGY))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized and seeded.")
