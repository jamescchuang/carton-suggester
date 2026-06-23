"""Typed accessors for system settings stored in the ``settings`` table."""
from sqlalchemy.orm import Session

from .models import Setting
from .packing import STRATEGIES
from .seed import DEFAULT_FILL_RATE, DEFAULT_STRATEGY


def get_fill_rate(db: Session) -> float:
    setting = db.get(Setting, "fill_rate")
    if setting is None:
        return DEFAULT_FILL_RATE
    try:
        return float(setting.value)
    except (TypeError, ValueError):
        return DEFAULT_FILL_RATE


def set_fill_rate(db: Session, value: float) -> float:
    value = max(0.01, min(1.0, float(value)))
    setting = db.get(Setting, "fill_rate")
    if setting is None:
        db.add(Setting(key="fill_rate", value=str(value)))
    else:
        setting.value = str(value)
    db.commit()
    return value


def get_strategy(db: Session) -> str:
    setting = db.get(Setting, "strategy")
    if setting is None or setting.value not in STRATEGIES:
        return DEFAULT_STRATEGY
    return setting.value


def set_strategy(db: Session, value: str) -> str:
    if value not in STRATEGIES:
        value = DEFAULT_STRATEGY
    setting = db.get(Setting, "strategy")
    if setting is None:
        db.add(Setting(key="strategy", value=value))
    else:
        setting.value = value
    db.commit()
    return value
