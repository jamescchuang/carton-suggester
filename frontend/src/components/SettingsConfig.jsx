import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

const STRATEGIES = ["volume", "layered", "upright"];

export default function SettingsConfig({ config, onSaved }) {
  const { t } = useI18n();
  const [fillPct, setFillPct] = useState(80);
  const [strategy, setStrategy] = useState("volume");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");

  // Sync the form with the loaded config.
  useEffect(() => {
    if (config) {
      setFillPct(Math.round((config.fill_rate ?? 0.8) * 100));
      setStrategy(config.strategy ?? "volume");
    }
  }, [config]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const pct = Math.min(100, Math.max(1, Number(fillPct) || 80));
      const cfg = await api.updateConfig({ fill_rate: pct / 100, strategy });
      onSaved?.(cfg);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>{t("settings.config")}</h2>

      <div className="config-form">
        <div className="strategy">
          <label htmlFor="cfg-strategy">{t("order.strategy")}</label>
          <select
            id="cfg-strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {t(`order.strategy.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="fill-rate">
          <label htmlFor="cfg-fill">{t("order.fillRate")}</label>
          <div className="fill-rate-input">
            <input
              id="cfg-fill"
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

        {error && <p className="error">{error}</p>}

        <div className="config-actions">
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? t("config.saving") : t("items.save")}
          </button>
          {savedAt > 0 && !saving && <span className="saved">{t("config.saved")}</span>}
        </div>
      </div>
    </section>
  );
}
