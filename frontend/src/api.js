// Thin API client for the FastAPI backend.
const BASE = "/api";

async function req(path, options) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listItems: () => req("/items"),
  createItem: (data) => req("/items", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id, data) =>
    req(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItem: (id) => req(`/items/${id}`, { method: "DELETE" }),
  listCartons: () => req("/cartons"),
  createCarton: (data) => req("/cartons", { method: "POST", body: JSON.stringify(data) }),
  updateCarton: (id, data) =>
    req(`/cartons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCarton: (id) => req(`/cartons/${id}`, { method: "DELETE" }),
  getConfig: () => req("/config"),
  updateConfig: (patch) =>
    req("/config", { method: "PUT", body: JSON.stringify(patch) }),
  suggest: (lines, fillRate, strategy) =>
    req("/suggest", {
      method: "POST",
      body: JSON.stringify({
        lines,
        ...(fillRate == null ? {} : { fill_rate: fillRate }),
        ...(strategy == null ? {} : { strategy }),
      }),
    }),
};
