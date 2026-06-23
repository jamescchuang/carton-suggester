import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useI18n } from "./i18n";
import { makeColorMap } from "./colors";
import ItemManager from "./components/ItemManager";
import CartonManager from "./components/CartonManager";
import SettingsConfig from "./components/SettingsConfig";
import OrderBuilder from "./components/OrderBuilder";
import ResultPanel from "./components/ResultPanel";
import LocaleToggle from "./components/LocaleToggle";
import NavBar from "./components/NavBar";

export default function App() {
  const { t } = useI18n();
  // "suggest" | "cartons" | "items" | "config"
  const [view, setView] = useState("suggest");
  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // System config defaults (from the DB): { fill_rate, strategy }.
  const [config, setConfig] = useState({ fill_rate: 0.8, strategy: "volume" });

  // One shared color per item name, used by both the order list and the 3D view.
  const colorMap = useMemo(() => makeColorMap(items.map((i) => i.name)), [items]);

  async function loadItems() {
    try {
      setItems(await api.listItems());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadItems();
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  async function handleSuggest(lines, requestedFillRate, strategy) {
    setLoading(true);
    setError("");
    try {
      const res = await api.suggest(lines, requestedFillRate, strategy);
      setResult(res);
      // The request values are persisted server-side; keep defaults in sync.
      setConfig((c) => ({ ...c, fill_rate: res.fill_rate, strategy: res.strategy }));
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <div className="header-text">
          <h1>📦 {t("app.title")}</h1>
          <p>{t("app.subtitle")}</p>
        </div>
        <LocaleToggle />
      </header>

      <NavBar view={view} setView={setView} />

      {error && <p className="error banner">{error}</p>}

      {view === "suggest" && (
        <div className="layout">
          <div className="col-left">
            <OrderBuilder
              items={items}
              onSuggest={handleSuggest}
              loading={loading}
              fillRate={config.fill_rate}
              defaultStrategy={config.strategy}
              colorMap={colorMap}
            />
          </div>
          <div className="col-right">
            <ResultPanel result={result} colorMap={colorMap} />
          </div>
        </div>
      )}

      {view === "cartons" && (
        <div className="page-single">
          <CartonManager />
        </div>
      )}

      {view === "items" && (
        <div className="page-single">
          <ItemManager items={items} onChange={loadItems} />
        </div>
      )}

      {view === "config" && (
        <div className="page-single">
          <SettingsConfig config={config} onSaved={setConfig} />
        </div>
      )}

      <footer>{t("app.footer")}</footer>
    </div>
  );
}
