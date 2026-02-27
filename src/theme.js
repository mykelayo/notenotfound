// src/theme.js
// ─────────────────────────────────────────────────────────────────────────────
// Theme system for notenotfound.
//
// Uses a module-level singleton + subscriber set.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

const KEY = "nnf-theme";

// ── Singleton ──────────────────────────────────────────────────────────────────

function readInitial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === "dark";
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

let _dark = readInitial();
const _subs = new Set();

function broadcast(dark) {
  _dark = dark;
  _subs.forEach(fn => fn(dark));
}

// ── Light palette ─────────────────────────────────────────────────────────────

export const LIGHT = {
  bg:          "#faf5ee",
  bgCard:      "#ffffff",
  bgInput:     "#fdf8f2",
  bgMuted:     "#f5ede0",
  border:      "#e8d5b8",
  text:        "#1a0f00",
  textSub:     "#6b4c2a",
  muted:       "#a07850",
  amber:       "#c87820",
  amberHover:  "#a86010",
  amberLight:  "#fef4e0",
  green:       "#2d7a4a",
  greenLight:  "#edf7f1",
  red:         "#b83225",
  redLight:    "#fdf0ee",
  navBg:       "rgba(250,245,238,0.96)",
  toggleBg:    "#f5ede0",
  toggleIcon:  "🌙",
  scrollThumb: "#e8d5b8",
  selectionBg: "rgba(200,120,32,0.18)",
};

// ── Dark palette ──────────────────────────────────────────────────────────────

export const DARK = {
  bg:          "#0e0904",
  bgCard:      "#1a1208",
  bgInput:     "#150e04",
  bgMuted:     "#201508",
  border:      "#3d2c12",
  text:        "#f0e6d4",
  textSub:     "#c49a6a",
  muted:       "#8a6642",
  amber:       "#e09535",
  amberHover:  "#f0a840",
  amberLight:  "#281a05",
  green:       "#4ab870",
  greenLight:  "#0a1f10",
  red:         "#e05545",
  redLight:    "#1f0808",
  navBg:       "rgba(14,9,4,0.95)",
  toggleBg:    "#201508",
  toggleIcon:  "☀️",
  scrollThumb: "#3d2c12",
  selectionBg: "rgba(224,149,53,0.22)",
};

// ── useTheme hook ─────────────────────────────────────────────────────────────

export function useTheme() {
  const [isDark, setIsDark] = useState(() => _dark);

  useEffect(() => {
    _subs.add(setIsDark);

    function onStorage(e) {
      if (e.key === KEY && e.newValue) {
        broadcast(e.newValue === "dark");
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      _subs.delete(setIsDark);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = !_dark;
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch {}
    broadcast(next);
  }

  return { C: isDark ? DARK : LIGHT, isDark, toggle };
}
