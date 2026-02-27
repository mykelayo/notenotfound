// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Terms from "./Terms.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<App />} />
        <Route path="/note/:id" element={<App />} />
        <Route path="/terms"    element={<Terms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
