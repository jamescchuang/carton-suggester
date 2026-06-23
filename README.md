# Carton Suggester

Suggest the smallest shipping carton(s) for a set of items and visualize the
3D packing plan. Bin-packing is simulated with [`py3dbp`](https://pypi.org/project/py3dbp/).

- **Backend** — FastAPI + SQLAlchemy + SQLite, packing/suggestion built on py3dbp.
- **Frontend** — React (Vite) with a three.js (react-three-fiber) 3D viewer.
- **Database** — SQLite (`carton.db`) holding item and carton dimensions; seeded
  with standard carton sizes and a few sample items on first run.

## How it works

Each item has `length × width × height` and a weight. You build an order
(item + quantity), and the backend:

1. Expands the order into individual units.
2. Tries each candidate carton, smallest first, packing with an extreme-point
   first-fit-decreasing algorithm that uses py3dbp's item rotations and geometry.
3. Returns the **smallest single carton** that fits everything, or falls back to
   a **multi-carton** plan (fill the best carton, repeat).
4. Reports per-carton fill %, weight, and exact item positions/rotations for the
   3D visualization.

### Placement strategy

The order panel has a **Placement** selector controlling how items are arranged
inside a carton (sent as `strategy` with the suggest request):

- **Densest (largest first)** — `volume`: biggest items first, any orientation.
  The default; usually the tightest pack.
- **Layered (largest base first)** — `layered`: largest-footprint items first so
  flat items tile into neat horizontal layers.
- **Keep upright (no tipping)** — `upright`: an item's height stays vertical
  (only its footprint may yaw), for fragile / liquid goods. May need a larger
  carton since items can't be laid on their side.

Beyond the global strategy, each order line has a **Keep upright** checkbox
(`keep_upright` per `OrderLine`) that forces *that item* to stay upright while
the others may still tip — useful when only some goods are orientation-sensitive.
Each order line also shows a color swatch matching the item's color in the 3D
view (one shared palette, keyed by item name).

Strategies are defined in `STRATEGIES` in `backend/packing.py` (item sort order,
pivot preference, and allowed orientations) — add an entry there and an
`<option>` in the frontend to extend the set.

The **default** strategy is stored in system config (`settings` table, default
`volume`) alongside `fill_rate`, editable on the **Fill Rate / Default Strategy**
settings page and via `GET`/`PUT /api/config`. Picking a value in the order panel
overrides it per request and saves it back as the new default.

### Fill rate

`fill_rate` is a system setting (stored in the `settings` table, default **80%**)
that caps how much of each carton's volume the packer may use — the rest is
excluded from the calculation as padding/void. A lower fill rate makes the
suggester pick larger cartons (or more of them). You can change it on the page
(next to **Suggest cartons**) before each calculation; the value you use is saved
back as the new default. It is also exposed via `GET`/`PUT /api/config`.

> Note: the `py3dbp` package on PyPI ships a packing loop with a placement bug
> (it re-places already-placed items, so only one lands per box). This project
> keeps py3dbp for the item/rotation **geometry** but drives placement with a
> correct loop in `backend/packing.py`, and validates that no items overlap or
> escape the carton.

## Requirements

- Python ≥ 3.13 with [uv](https://docs.astral.sh/uv/)
- Node ≥ 18

## Run with the scripts (Windows / PowerShell)

Start/stop both services in the background (logs + pids go to `.run/`):

```powershell
# start backend (:8000) and frontend (:5173)
.\scripts\start-all.ps1

# stop both
.\scripts\stop-all.ps1
```

Per-service control is also available:

```powershell
.\scripts\start-backend.ps1     # or -Port 8001
.\scripts\start-frontend.ps1    # runs npm install on first use; or -Port 5174
.\scripts\stop-backend.ps1
.\scripts\stop-frontend.ps1
```

Then open http://localhost:5173. Logs: `.run\backend.out.log`, `.run\frontend.out.log`.

The start scripts are idempotent (they no-op if the port is already up); the stop
scripts kill the whole process tree (`uv`→uvicorn, `npm`→node) and free the port.

> If scripts are blocked by execution policy, run them via:
> `powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1`

## Run (development, manual)

Two terminals:

```bash
# 1) Backend  (http://127.0.0.1:8000)
uv run uvicorn backend.main:app --reload

# 2) Frontend (http://127.0.0.1:5173 — proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173.

## Run (single server / production)

Build the frontend; the backend then serves it from `/`:

```bash
cd frontend && npm install && npm run build && cd ..
uv run uvicorn backend.main:app --port 8000
# open http://127.0.0.1:8000
```

## API

| Method | Path                  | Description                         |
| ------ | --------------------- | ----------------------------------- |
| GET    | `/api/items`          | List items                          |
| POST   | `/api/items`          | Create item                         |
| PUT    | `/api/items/{id}`     | Update item                         |
| DELETE | `/api/items/{id}`     | Delete item                         |
| GET    | `/api/cartons`        | List candidate cartons              |
| POST   | `/api/cartons`        | Add a carton size                   |
| PUT    | `/api/cartons/{id}`   | Update a carton                     |
| DELETE | `/api/cartons/{id}`   | Delete a carton                     |
| GET    | `/api/config`         | Read system config (`fill_rate`)    |
| PUT    | `/api/config`         | Update `fill_rate`                  |
| POST   | `/api/suggest`        | Suggest carton(s) for an order      |

`POST /api/suggest` body:

```json
{ "lines": [ { "item_id": 1, "quantity": 5 }, { "item_id": 2, "quantity": 3 } ] }
```

Interactive docs at http://127.0.0.1:8000/docs.

## Navigation

A top nav bar switches between pages (a lightweight `view` state in `App.jsx`):

- **Carton Suggestion** — the order builder + 3D result (the main tool).
- **Settings** (dropdown):
  - **Carton Type & Size Maintenance** — CRUD for candidate cartons
    (`CartonManager.jsx`).
  - **Product Name & Size Maintenance** — CRUD for items (`ItemManager.jsx`).
  - **Fill Rate / Default Strategy** — system config defaults
    (`SettingsConfig.jsx`); see below.

Master-data editing lives under Settings; the main page just consumes it.

## Internationalization (i18n)

The UI supports **English** and **Traditional Chinese (繁體中文)**. Switch with the
toggle in the upper-right corner of the page; the choice is saved to
`localStorage` (and defaults to the browser language on first visit).

Locale strings live in Java-style `.properties` files:

```
frontend/src/locales/en.properties
frontend/src/locales/zh-Hant.properties
```

They are loaded via Vite's `?raw` import and parsed by `frontend/src/i18n.jsx`,
which exposes a `useI18n()` hook with `t(key, vars)`. `{placeholder}` tokens in a
value are substituted from `vars`. To add a string, add the same key to **both**
files; to add a language, drop in a new `.properties` file, register it in
`DICTS`/`LOCALES` in `i18n.jsx`. (Item and carton **names** come from the
database and are shown as-entered.)

## Project layout

```
backend/
  database.py   SQLite engine/session
  models.py     Item, Carton ORM
  schemas.py    Pydantic request/response models
  packing.py    py3dbp-based packing + carton suggestion
  seed.py       table creation + default cartons/items
  main.py       FastAPI app (CRUD + /api/suggest, serves built frontend)
frontend/
  src/
    api.js                 API client
    i18n.jsx               locale loader + useI18n() hook
    App.jsx                layout + state
    locales/
      en.properties        English strings
      zh-Hant.properties   Traditional Chinese strings
    components/
      ItemManager.jsx      add/edit/delete items
      OrderBuilder.jsx     pick items + quantities
      ResultPanel.jsx      suggestion summary + stats
      CartonViewer.jsx     3D packing visualization
      LocaleToggle.jsx     language switcher
```
