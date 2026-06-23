import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

const EMPTY = { name: "", length: "", width: "", height: "", max_weight: "" };

export default function CartonManager() {
  const { t } = useI18n();
  const [cartons, setCartons] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function load() {
    try {
      setCartons(await api.listCartons());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name.trim(),
      length: parseFloat(form.length),
      width: parseFloat(form.width),
      height: parseFloat(form.height),
      max_weight: parseFloat(form.max_weight) || 1000000,
    };
    if (!payload.name || [payload.length, payload.width, payload.height].some((n) => !(n > 0))) {
      setError(t("items.error"));
      return;
    }
    try {
      if (editingId) await api.updateCarton(editingId, payload);
      else await api.createCarton(payload);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function edit(c) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      length: c.length,
      width: c.width,
      height: c.height,
      max_weight: c.max_weight,
    });
  }

  async function remove(id) {
    await api.deleteCarton(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    load();
  }

  return (
    <section className="card">
      <h2>{t("settings.cartons")}</h2>
      <form className="item-form" onSubmit={submit}>
        <input placeholder={t("items.name")} value={form.name} onChange={set("name")} />
        <input placeholder={t("items.length")} type="number" step="any" value={form.length} onChange={set("length")} />
        <input placeholder={t("items.width")} type="number" step="any" value={form.width} onChange={set("width")} />
        <input placeholder={t("items.height")} type="number" step="any" value={form.height} onChange={set("height")} />
        <input placeholder={t("carton.maxWeight")} type="number" step="any" value={form.max_weight} onChange={set("max_weight")} />
        <button type="submit">{editingId ? t("items.save") : t("items.add")}</button>
        {editingId && (
          <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
            {t("items.cancel")}
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}
      <table className="grid">
        <thead>
          <tr>
            <th>{t("items.col.name")}</th>
            <th>{t("items.col.l")}</th>
            <th>{t("items.col.w")}</th>
            <th>{t("items.col.h")}</th>
            <th>{t("carton.col.maxkg")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cartons.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.length}</td>
              <td>{c.width}</td>
              <td>{c.height}</td>
              <td>{c.max_weight}</td>
              <td className="row-actions">
                <button className="ghost" onClick={() => edit(c)}>{t("items.edit")}</button>
                <button className="ghost danger" title={t("items.delete")} onClick={() => remove(c.id)}>✕</button>
              </td>
            </tr>
          ))}
          {cartons.length === 0 && (
            <tr><td colSpan="6" className="muted">{t("carton.empty")}</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
