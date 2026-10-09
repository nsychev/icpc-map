import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteFinder } from "./SiteFinder";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The root element is missing");

createRoot(root).render(
  <StrictMode>
    <main>
      <SiteFinder />
    </main>
  </StrictMode>,
);
