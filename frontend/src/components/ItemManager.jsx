import { useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

const EMPTY = { name: "", length: "", width: "", height: "", weight: "" };

export default function ItemManager({ items, onChange }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name.trim(),
      length: parseFloat(form.length),
      width: parseFloat(form.width),
      height: parseFloat(form.height),
      weight: parseFloat(form.weight) || 0,
    };
    if (!payload.name || [payload.length, payload.width, payload.height].some((n) => !(n > 0))) {
      setError(t("items.error"));
      return;
    }
    try {
      if (editingId) await api.updateItem(editingId, payload);
      else await api.createItem(payload);
      setForm(EMPTY);
      setEditingId(null);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  function edit(it) {
    setEditingId(it.id);
    setForm({
      name: it.name,
      length: it.length,
      width: it.width,
      height: it.height,
      weight: it.weight,
    });
  }

  async function remove(id) {
    await api.deleteItem(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    onChange();
  }

  return (
    <section className="card">
      <h2>{t("items.title")}</h2>
      <form className="item-form" onSubmit={submit}>
        <input placeholder={t("items.name")} value={form.name} onChange={set("name")} />
        <input placeholder={t("items.length")} type="number" step="any" value={form.length} onChange={set("length")} />
        <input placeholder={t("items.width")} type="number" step="any" value={form.width} onChange={set("width")} />
        <input placeholder={t("items.height")} type="number" step="any" value={form.height} onChange={set("height")} />
        <input placeholder={t("items.weight")} type="number" step="any" value={form.weight} onChange={set("weight")} />
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
            <th>{t("items.col.kg")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.length}</td>
              <td>{it.width}</td>
              <td>{it.height}</td>
              <td>{it.weight}</td>
              <td className="row-actions">
                <button className="ghost" onClick={() => edit(it)}>{t("items.edit")}</button>
                <button className="ghost danger" title={t("items.delete")} onClick={() => remove(it.id)}>✕</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan="6" className="muted">{t("items.empty")}</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
