"""Carton suggestion built on top of py3dbp.

py3dbp models a box as (width, height, depth) with a corner position. We treat
the user-facing dimensions as (length, width, height) and map length -> depth,
so the visualization axes are:

    x = width, y = height, z = length (depth)

py3dbp's ``Bin``/``Packer`` use mutable default arguments for their list fields,
so we always assign fresh lists to avoid state leaking between calls. py3dbp
also ignores weight during geometric packing, so we enforce ``max_weight`` here
by trimming the heaviest items out of an over-weight carton.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from py3dbp.main import Item, RotationType

# Fraction of a carton's volume that may actually be used for items; the rest is
# reserved (padding / void). Overridable per request.
DEFAULT_FILL_RATE = 0.8


@dataclass
class Instance:
    """A single physical unit to be packed."""

    uid: str
    name: str
    length: float
    width: float
    height: float
    weight: float
    keep_upright: bool = False  # if True, height must stay vertical (no tipping)

    @property
    def volume(self) -> float:
        return self.length * self.width * self.height


@dataclass
class PlacedItem:
    uid: str
    name: str
    position: list[float]  # [x, y, z] corner, axes (width, height, length)
    size: list[float]      # [w, h, l] after rotation
    weight: float


@dataclass
class CartonResult:
    name: str
    size: list[float]  # [width, height, length]
    items: list[PlacedItem]
    used_volume: float
    carton_volume: float
    total_weight: float
    max_weight: float

    @property
    def utilization(self) -> float:
        return self.used_volume / self.carton_volume if self.carton_volume else 0.0


@dataclass
class Suggestion:
    cartons: list[CartonResult] = field(default_factory=list)
    unpacked: list[str] = field(default_factory=list)  # item names that fit nowhere
    fill_rate: float = 0.0  # fraction of carton volume usable for items
    strategy: str = ""  # placement strategy used

    @property
    def num_cartons(self) -> int:
        return len(self.cartons)


def _boxes_overlap(a: PlacedItem, b: PlacedItem, eps: float = 1e-6) -> bool:
    for ax in range(3):
        a0, a1 = a.position[ax], a.position[ax] + a.size[ax]
        b0, b1 = b.position[ax], b.position[ax] + b.size[ax]
        if a1 <= b0 + eps or b1 <= a0 + eps:
            return False
    return True


def _within_bounds(p: PlacedItem, carton: dict, eps: float = 1e-6) -> bool:
    dims = [carton["width"], carton["height"], carton["length"]]
    for ax in range(3):
        if p.position[ax] < -eps or p.position[ax] + p.size[ax] > dims[ax] + eps:
            return False
    return True


def _rotations_all(width: float, height: float, length: float) -> list[list[float]]:
    """All 6 axis-aligned orientations as [w, h, depth], via py3dbp's Item."""
    probe = Item("probe", width, height, length, 0, 0, [0, 0, 0])
    out = []
    for rt in RotationType.ALL:
        probe.rotation_type = rt
        out.append([float(x) for x in probe.get_dimension()])
    return out


def _rotations_upright(width: float, height: float, length: float) -> list[list[float]]:
    """Keep the item upright: height stays vertical, only the footprint yaws."""
    return [[width, height, length], [length, height, width]]


# Placement strategies. Each controls how items are ordered, where they are
# placed (pivot preference), and which orientations are allowed.
#   sort:  item ordering key (sorted descending)
#   pivot: candidate-position ordering key (smaller = tried first)
#   rot:   allowed orientations for an item
STRATEGIES = {
    # Densest: biggest items first, fill bottom -> back -> left, any orientation.
    "volume": {
        "sort": lambda i: i.volume,
        "pivot": lambda p: (p[1], p[2], p[0]),
        "rot": _rotations_all,
    },
    # Layered: largest footprint first so flat items tile neat horizontal layers.
    "layered": {
        "sort": lambda i: (i.width * i.length, i.height),
        "pivot": lambda p: (p[1], p[2], p[0]),
        "rot": _rotations_all,
    },
    # Keep upright: never tip an item onto its side (for fragile / liquid goods).
    "upright": {
        "sort": lambda i: (i.height, i.volume),
        "pivot": lambda p: (p[1], p[2], p[0]),
        "rot": _rotations_upright,
    },
}
DEFAULT_STRATEGY = "volume"


def _pack_single(
    carton: dict, instances: list[Instance], strategy: str = DEFAULT_STRATEGY
) -> tuple[list[PlacedItem], list[str]]:
    """Pack ``instances`` into one carton with extreme-point first-fit-decreasing.

    The chosen ``strategy`` controls item ordering, pivot preference, and the
    allowed orientations. For each item we try every candidate corner position
    (extreme points seeded at the origin and grown from placed items) in every
    allowed orientation, taking the first collision-free, in-bounds fit.
    Returns (placed_items, unfitted_uids). Weight is NOT enforced here.
    """
    strat = STRATEGIES.get(strategy, STRATEGIES[DEFAULT_STRATEGY])
    cw, ch, cl = carton["width"], carton["height"], carton["length"]
    ordered = sorted(instances, key=strat["sort"], reverse=True)

    placed: list[PlacedItem] = []
    unfitted: list[str] = []
    # Candidate corner positions (x=width, y=height, z=length/depth).
    pivots: list[tuple[float, float, float]] = [(0.0, 0.0, 0.0)]

    for inst in ordered:
        # Per-item upright constraint overrides the strategy's rotation set.
        rot_fn = _rotations_upright if inst.keep_upright else strat["rot"]
        rotations = rot_fn(inst.width, inst.height, inst.length)
        candidates = sorted(set(pivots), key=strat["pivot"])
        placed_here = None
        for px, py, pz in candidates:
            for size in rotations:
                cand = PlacedItem(inst.uid, inst.name, [px, py, pz], size, inst.weight)
                if _within_bounds(cand, carton) and not any(
                    _boxes_overlap(cand, k) for k in placed
                ):
                    placed_here = cand
                    break
            if placed_here:
                break

        if placed_here is None:
            unfitted.append(inst.uid)
            continue

        placed.append(placed_here)
        px, py, pz = placed_here.position
        w, h, d = placed_here.size
        # Grow extreme points off the three exposed faces.
        for nxt in ((px + w, py, pz), (px, py + h, pz), (px, py, pz + d)):
            if nxt[0] < cw and nxt[1] < ch and nxt[2] < cl:
                pivots.append(nxt)

    return placed, unfitted


def _enforce_weight(
    placed: list[PlacedItem], max_weight: float
) -> tuple[list[PlacedItem], list[str]]:
    """Trim the heaviest placed items until total weight <= max_weight."""
    kept = list(placed)
    evicted: list[str] = []
    kept.sort(key=lambda p: p.weight)  # lightest first
    while sum(p.weight for p in kept) > max_weight and kept:
        heavy = kept.pop()  # heaviest is last
        evicted.append(heavy.uid)
    return kept, evicted


def _enforce_fill(
    placed: list[PlacedItem], volume_cap: float, keep_min: int = 1
) -> tuple[list[PlacedItem], list[str]]:
    """Trim items (keeping the placement order, largest-first) so the used volume
    stays within ``volume_cap``. At least ``keep_min`` items are always kept so a
    single item that alone exceeds the cap still gets packed (and progress is made
    in the multi-carton loop)."""
    kept: list[PlacedItem] = []
    evicted: list[str] = []
    total = 0.0
    for p in placed:
        vol = p.size[0] * p.size[1] * p.size[2]
        if len(kept) < keep_min or total + vol <= volume_cap + 1e-6:
            kept.append(p)
            total += vol
        else:
            evicted.append(p.uid)
    return kept, evicted


def _build_result(carton: dict, placed: list[PlacedItem]) -> CartonResult:
    used = sum(p.size[0] * p.size[1] * p.size[2] for p in placed)
    cv = carton["length"] * carton["width"] * carton["height"]
    return CartonResult(
        name=carton["name"],
        size=[carton["width"], carton["height"], carton["length"]],
        items=placed,
        used_volume=used,
        carton_volume=cv,
        total_weight=sum(p.weight for p in placed),
        max_weight=carton.get("max_weight", 1e9),
    )


def _carton_volume(carton: dict) -> float:
    return carton["length"] * carton["width"] * carton["height"]


def _fit_all(
    carton: dict, instances: list[Instance], fill_rate: float, strategy: str
) -> CartonResult | None:
    """Return a CartonResult if every instance fits — geometry, weight, and the
    fill-rate volume cap (used volume must stay within ``fill_rate`` of the
    carton's volume). Otherwise None."""
    if sum(i.weight for i in instances) > carton.get("max_weight", 1e9):
        return None
    placed, unfitted = _pack_single(carton, instances, strategy)
    if unfitted:
        return None
    used = sum(p.size[0] * p.size[1] * p.size[2] for p in placed)
    if used > fill_rate * _carton_volume(carton) + 1e-6:
        return None
    return _build_result(carton, placed)


def suggest(
    item_specs: list[dict],
    cartons: list[dict],
    fill_rate: float = DEFAULT_FILL_RATE,
    strategy: str = DEFAULT_STRATEGY,
) -> Suggestion:
    """Suggest carton(s) for the requested items.

    ``item_specs``: list of {name, length, width, height, weight, quantity}.
    ``cartons``: list of {name, length, width, height, max_weight}.
    ``fill_rate``: fraction (0-1] of each carton's volume usable for items; the
    remainder is excluded from the calculation as padding/void.
    ``strategy``: item placement strategy (see ``STRATEGIES``).

    Selection: if all items fit in one carton (within the fill cap), return the
    smallest such carton. Otherwise greedily fill the carton that packs the most
    volume (up to the cap) and repeat, finishing with the smallest carton that
    holds whatever remains.
    """
    fill_rate = max(1e-3, min(1.0, float(fill_rate)))
    if strategy not in STRATEGIES:
        strategy = DEFAULT_STRATEGY
    instances: list[Instance] = []
    counter = 0
    for spec in item_specs:
        qty = int(spec.get("quantity", 1))
        for _ in range(qty):
            instances.append(
                Instance(
                    uid=str(counter),
                    name=spec["name"],
                    length=float(spec["length"]),
                    width=float(spec["width"]),
                    height=float(spec["height"]),
                    weight=float(spec.get("weight", 0.0)),
                    keep_upright=bool(spec.get("keep_upright", False)),
                )
            )
            counter += 1

    cartons_by_vol = sorted(cartons, key=lambda c: c["length"] * c["width"] * c["height"])
    suggestion = Suggestion(fill_rate=fill_rate, strategy=strategy)
    remaining = instances

    guard = 0
    while remaining:
        guard += 1
        if guard > len(instances) + 5:  # safety: cannot exceed one carton per item
            suggestion.unpacked.extend(i.name for i in remaining)
            break

        # 1) Does everything remaining fit in a single carton? Take the smallest.
        single = next(
            (r for c in cartons_by_vol if (r := _fit_all(c, remaining, fill_rate, strategy))),
            None,
        )
        if single is not None:
            suggestion.cartons.append(single)
            break

        # 2) Otherwise fill the carton that packs the most volume this round,
        #    capped at fill_rate of the carton volume.
        best_result: CartonResult | None = None
        best_uids: set[str] = set()
        for carton in cartons_by_vol:
            placed, _ = _pack_single(carton, remaining, strategy)
            placed, _evicted = _enforce_weight(placed, carton.get("max_weight", 1e9))
            placed, _capped = _enforce_fill(placed, fill_rate * _carton_volume(carton))
            if not placed:
                continue
            result = _build_result(carton, placed)
            if best_result is None or result.used_volume > best_result.used_volume:
                best_result = result
                best_uids = {p.uid for p in placed}

        if best_result is None:
            # Nothing fits anywhere (item larger than every carton).
            suggestion.unpacked.extend(i.name for i in remaining)
            break

        suggestion.cartons.append(best_result)
        remaining = [i for i in remaining if i.uid not in best_uids]

    return suggestion
