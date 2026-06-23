import { useState } from "react";
import CartonViewer from "./CartonViewer";
import { useI18n } from "../i18n";

export default function ResultPanel({ result, colorMap }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  if (!result) {
    return (
      <section className="card viewer-card">
        <h2>{t("result.title")}</h2>
        <p className="muted">{t("result.placeholder", { action: t("order.suggest") })}</p>
      </section>
    );
  }

  const { cartons, unpacked, num_cartons } = result;
  const carton = cartons[active];

  // Count items per name in the active carton.
  const counts = {};
  carton?.items.forEach((i) => (counts[i.name] = (counts[i.name] || 0) + 1));

  const cartonWord = num_cartons === 1 ? t("common.carton") : t("common.cartons");
  const itemWord = unpacked.length === 1 ? t("common.item") : t("common.items");

  return (
    <section className="card viewer-card">
      <h2>
        {t("result.title")} · {num_cartons} {cartonWord}
      </h2>

      {unpacked.length > 0 && (
        <p className="error">
          {t("result.unpacked", {
            count: unpacked.length,
            itemWord,
            names: unpacked.join(", "),
          })}
        </p>
      )}

      {cartons.length > 1 && (
        <div className="tabs">
          {cartons.map((c, i) => (
            <button
              key={i}
              className={i === active ? "tab active" : "tab"}
              onClick={() => setActive(i)}
            >
              #{i + 1} {c.name.trim()}
            </button>
          ))}
        </div>
      )}

      {carton && (
        <>
          <div className="stats">
            <div><span>{t("result.stat.carton")}</span><strong>{carton.name.trim()}</strong></div>
            <div><span>{t("result.stat.dimensions")}</span><strong>{carton.size.map((n) => +n.toFixed(0)).join(" × ")}</strong></div>
            <div><span>{t("result.stat.items")}</span><strong>{carton.items.length}</strong></div>
            <div><span>{t("result.stat.fill")}</span><strong>{(carton.utilization * 100).toFixed(0)}%</strong></div>
            <div><span>{t("result.stat.weight")}</span><strong>{carton.total_weight.toFixed(1)} / {carton.max_weight} kg</strong></div>
          </div>

          <CartonViewer carton={carton} colorMap={colorMap} />

          <div className="legend">
            {Object.entries(counts).map(([name, n]) => (
              <span key={name} className="chip">
                <i style={{ background: colorMap[name] }} /> {name} × {n}
              </span>
            ))}
          </div>
          <p className="hint">{t("result.hint")}</p>
        </>
      )}
    </section>
  );
}
