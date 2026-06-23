"""Pydantic request/response schemas."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---- Items ----
class ItemBase(BaseModel):
    name: str = Field(..., min_length=1)
    length: float = Field(..., gt=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    weight: float = Field(0.0, ge=0)


class ItemCreate(ItemBase):
    pass


class ItemRead(ItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Cartons ----
class CartonBase(BaseModel):
    name: str = Field(..., min_length=1)
    length: float = Field(..., gt=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    max_weight: float = Field(1e6, gt=0)


class CartonCreate(CartonBase):
    pass


class CartonRead(CartonBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- System configuration ----
class ConfigRead(BaseModel):
    fill_rate: float  # fraction (0-1] of carton volume usable for items
    strategy: str     # default placement strategy


class ConfigUpdate(BaseModel):
    fill_rate: Optional[float] = Field(None, gt=0, le=1)
    strategy: Optional[str] = None


# ---- Suggestion ----
class OrderLine(BaseModel):
    item_id: int
    quantity: int = Field(..., gt=0)
    keep_upright: bool = False  # if True, this item must be packed upright


class SuggestRequest(BaseModel):
    lines: list[OrderLine] = Field(..., min_length=1)
    # Optional per-request override; if set it also becomes the saved default.
    fill_rate: Optional[float] = Field(None, gt=0, le=1)
    # Item placement strategy: "volume" | "layered" | "upright".
    strategy: Optional[str] = None


class PlacedItemRead(BaseModel):
    uid: str
    name: str
    position: list[float]  # [x, y, z] corner (width, height, length axes)
    size: list[float]      # [w, h, l] after rotation
    weight: float


class CartonResultRead(BaseModel):
    name: str
    size: list[float]  # [width, height, length]
    items: list[PlacedItemRead]
    used_volume: float
    carton_volume: float
    utilization: float
    total_weight: float
    max_weight: float


class SuggestResponse(BaseModel):
    cartons: list[CartonResultRead]
    unpacked: list[str]
    num_cartons: int
    fill_rate: float
    strategy: str
