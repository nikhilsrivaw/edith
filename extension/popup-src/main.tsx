import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root")!;
// StrictMode removed — double-invoke breaks some Motion components in
// production builds, surfacing as React error #418/#423.
createRoot(root).render(<App />);
