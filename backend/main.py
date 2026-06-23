"""FastAPI application: item/carton CRUD + carton suggestion."""
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import schemas
from .configstore import get_fill_rate, get_strategy, set_fill_rate, set_strategy
from .database import get_db
from .models import Carton, Item
from .packing import suggest
from .seed import init_db

app = FastAPI(title="Carton Suggester", version="0.1.0")

# Allow the Vite dev server (and any localhost port) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---------------------------------------------------------------- Items
@app.get("/api/items", response_model=list[schemas.ItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.name).all()


@app.post("/api/items", response_model=schemas.ItemRead, status_code=201)
def create_item(payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    if db.query(Item).filter(Item.name == payload.name).first():
        raise HTTPException(409, f"Item '{payload.name}' already exists")
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.put("/api/items/{item_id}", response_model=schemas.ItemRead)
def update_item(item_id: int, payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()


# ---------------------------------------------------------------- Cartons
@app.get("/api/cartons", response_model=list[schemas.CartonRead])
def list_cartons(db: Session = Depends(get_db)):
    return db.query(Carton).order_by(Carton.length * Carton.width * Carton.height).all()


@app.post("/api/cartons", response_model=schemas.CartonRead, status_code=201)
def create_carton(payload: schemas.CartonCreate, db: Session = Depends(get_db)):
    if db.query(Carton).filter(Carton.name == payload.name).first():
        raise HTTPException(409, f"Carton '{payload.name}' already exists")
    carton = Carton(**payload.model_dump())
    db.add(carton)
    db.commit()
    db.refresh(carton)
    return carton


@app.put("/api/cartons/{carton_id}", response_model=schemas.CartonRead)
def update_carton(
    carton_id: int, payload: schemas.CartonCreate, db: Session = Depends(get_db)
):
    carton = db.get(Carton, carton_id)
    if not carton:
        raise HTTPException(404, "Carton not found")
    clash = (
        db.query(Carton)
        .filter(Carton.name == payload.name, Carton.id != carton_id)
        .first()
    )
    if clash:
        raise HTTPException(409, f"Carton '{payload.name}' already exists")
    for key, value in payload.model_dump().items():
        setattr(carton, key, value)
    db.commit()
    db.refresh(carton)
    return carton


@app.delete("/api/cartons/{carton_id}", status_code=204)
def delete_carton(carton_id: int, db: Session = Depends(get_db)):
    carton = db.get(Carton, carton_id)
    if not carton:
        raise HTTPException(404, "Carton not found")
    db.delete(carton)
    db.commit()


# ---------------------------------------------------------------- Config
@app.get("/api/config", response_model=schemas.ConfigRead)
def read_config(db: Session = Depends(get_db)):
    return schemas.ConfigRead(fill_rate=get_fill_rate(db), strategy=get_strategy(db))


@app.put("/api/config", response_model=schemas.ConfigRead)
def update_config(payload: schemas.ConfigUpdate, db: Session = Depends(get_db)):
    if payload.fill_rate is not None:
        set_fill_rate(db, payload.fill_rate)
    if payload.strategy is not None:
        set_strategy(db, payload.strategy)
    return schemas.ConfigRead(fill_rate=get_fill_rate(db), strategy=get_strategy(db))


# ---------------------------------------------------------------- Suggestion
@app.post("/api/suggest", response_model=schemas.SuggestResponse)
def suggest_cartons(payload: schemas.SuggestRequest, db: Session = Depends(get_db)):
    items = {i.id: i for i in db.query(Item).all()}
    specs = []
    for line in payload.lines:
        item = items.get(line.item_id)
        if not item:
            raise HTTPException(404, f"Item id {line.item_id} not found")
        specs.append(
            {
                "name": item.name,
                "length": item.length,
                "width": item.width,
                "height": item.height,
                "weight": item.weight,
                "quantity": line.quantity,
                "keep_upright": line.keep_upright,
            }
        )

    cartons = [
        {
            "name": c.name,
            "length": c.length,
            "width": c.width,
            "height": c.height,
            "max_weight": c.max_weight,
        }
        for c in db.query(Carton).all()
    ]
    if not cartons:
        raise HTTPException(400, "No cartons defined")

    # Use the per-request fill_rate / strategy if provided (and persist each as
    # the new default), otherwise fall back to the stored system settings.
    if payload.fill_rate is not None:
        fill_rate = set_fill_rate(db, payload.fill_rate)
    else:
        fill_rate = get_fill_rate(db)

    if payload.strategy is not None:
        strategy = set_strategy(db, payload.strategy)
    else:
        strategy = get_strategy(db)

    result = suggest(specs, cartons, fill_rate=fill_rate, strategy=strategy)
    return schemas.SuggestResponse(
        cartons=[
            schemas.CartonResultRead(
                name=c.name,
                size=c.size,
                items=[
                    schemas.PlacedItemRead(
                        uid=p.uid,
                        name=p.name,
                        position=p.position,
                        size=p.size,
                        weight=p.weight,
                    )
                    for p in c.items
                ],
                used_volume=c.used_volume,
                carton_volume=c.carton_volume,
                utilization=c.utilization,
                total_weight=c.total_weight,
                max_weight=c.max_weight,
            )
            for c in result.cartons
        ],
        unpacked=result.unpacked,
        num_cartons=result.num_cartons,
        fill_rate=result.fill_rate,
        strategy=result.strategy,
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the built frontend (frontend/dist) if it exists, so the whole app can
# run from a single server in production.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
