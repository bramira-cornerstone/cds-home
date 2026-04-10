import "./global.css";

import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

let root = rootElement.__reactRoot as ReturnType<typeof createRoot> | undefined;

if (!root) {
  root = createRoot(rootElement);
  (rootElement as any).__reactRoot = root;
}

root.render(<App />);

// Hot Module Replacement support
if (import.meta.hot) {
  import.meta.hot.accept("./App", (module) => {
    const App = module.default;
    root?.render(<App />);
  });
}
