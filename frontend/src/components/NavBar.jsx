import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export default function NavBar({ view, setView }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (v) => {
    setView(v);
    setOpen(false);
  };
  const inSettings = view === "cartons" || view === "items" || view === "config";

  return (
    <nav className="navbar">
      <button
        className={view === "suggest" ? "nav-item active" : "nav-item"}
        onClick={() => go("suggest")}
      >
        {t("nav.suggest")}
      </button>

      <div className="nav-dropdown" ref={ref}>
        <button
          className={inSettings ? "nav-item active" : "nav-item"}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {t("nav.settings")} <span className="caret">▾</span>
        </button>
        {open && (
          <div className="nav-menu" role="menu">
            <button
              role="menuitem"
              className={view === "cartons" ? "active" : ""}
              onClick={() => go("cartons")}
            >
              {t("settings.cartons")}
            </button>
            <button
              role="menuitem"
              className={view === "items" ? "active" : ""}
              onClick={() => go("items")}
            >
              {t("settings.items")}
            </button>
            <button
              role="menuitem"
              className={view === "config" ? "active" : ""}
              onClick={() => go("config")}
            >
              {t("settings.config")}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
