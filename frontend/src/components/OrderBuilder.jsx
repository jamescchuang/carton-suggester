import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

export default function OrderBuilder({
  items,
  onSuggest,
  loading,
  fillRate,
  defaultStrategy,
  colorMap,
}) {
  const { t } = useI18n();
  const [lines, setLines] = useState([]); // [{item_id, quantity}]
  const [selId, setSelId] = useState("");
  const [qty, setQty] = useState(1);
  const [fillPct, setFillPct] = useState(80); // percentage shown in the control
  const [strategy, setStrategy] = useState("volume");

  // Initialize the controls from the system config defaults once they load.
  useEffect(() => {
    if (typeof fillRate === "number") setFillPct(Math.round(fillRate * 100));
  }, [fillRate]);

  useEffect(() => {
    if (defaultStrategy) setStrategy(defaultStrategy);
  }, [defaultStrategy]);

  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

  function handleSuggest() {
    const pct = Math.min(100, Math.max(1, Number(fillPct) || 80));
    onSuggest(lines, pct / 100, strategy);
  }

  function addLine() {
    const id = parseInt(selId, 10);
    if (!id || qty < 1) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.item_id === id);
      if (existing) {
        return prev.map((l) =>
          l.item_id === id ? { ...l, quantity: l.quantity + Number(qty) } : l
        );
      }
      return [...prev, { item_id: id, quantity: Number(qty), keep_upright: false }];
    });
    setQty(1);
  }

  function removeLine(id) {
    setLines((prev) => prev.filter((l) => l.item_id !== id));
  }

  function toggleUpright(id) {
    setLines((prev) =>
      prev.map((l) => (l.item_id === id ? { ...l, keep_upright: !l.keep_upright } : l))
    );
  }

  return (
    <section className="card">
      <h2>{t("order.title")}</h2>
      <div className="order-add">
        <select value={selId} onChange={(e) => setSelId(e.target.value)}>
          <option value="">{t("order.select")}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.length}×{i.width}×{i.height})
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <button onClick={addLine}>{t("order.add")}</button>
      </div>

      <ul className="lines">
        {lines.map((l) => {
          const name = itemById[l.item_id]?.name ?? `#${l.item_id}`;
          return (
            <li key={l.item_id}>
              <i className="dot" style={{ background: colorMap?.[name] || "#888" }} />
              <span className="line-name">{name}</span>
              <label className="upright" title={t("order.keepUpright")}>
                <input
                  type="checkbox"
                  checked={!!l.keep_upright}
                  onChange={() => toggleUpright(l.item_id)}
                />
                {t("order.keepUpright")}
              </label>
              <span className="qty">× {l.quantity}</span>
              <button className="ghost danger" onClick={() => removeLine(l.item_id)}>✕</button>
            </li>
          );
        })}
        {lines.length === 0 && <li className="muted">{t("order.empty")}</li>}
      </ul>

      <div className="strategy">
        <label htmlFor="strategy">{t("order.strategy")}</label>
        <select
          id="strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        >
          <option value="volume">{t("order.strategy.volume")}</option>
          <option value="layered">{t("order.strategy.layered")}</option>
          <option value="upright">{t("order.strategy.upright")}</option>
        </select>
      </div>

      <div className="fill-rate">
        <label htmlFor="fill-rate">{t("order.fillRate")}</label>
        <div className="fill-rate-input">
          <input
            id="fill-rate"
            type="number"
            min="1"
            max="100"
            value={fillPct}
            onChange={(e) => setFillPct(e.target.value)}
          />
          <span className="suffix">%</span>
        </div>
        <p className="hint">{t("order.fillRateHint")}</p>
      </div>

      <button
        className="primary"
        disabled={lines.length === 0 || loading}
        onClick={handleSuggest}
      >
        {loading ? t("order.calculating") : t("order.suggest")}
      </button>
    </section>
  );
}
