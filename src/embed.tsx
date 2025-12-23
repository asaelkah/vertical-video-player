import React from "react";
import { createRoot } from "react-dom/client";
import { Widget } from "./widget/Widget";
import "./widget/styles.css";

function boot() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".mmvp"));
  nodes.forEach((el) => {
    const root = createRoot(el);
    root.render(<Widget hostEl={el} />);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
