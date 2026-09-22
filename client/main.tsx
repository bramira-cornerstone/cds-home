import "./global.css";

import { createRoot } from "react-dom/client";
import App from "./App";

type RootElement = HTMLElement & {
  __reactRoot?: ReturnType<typeof createRoot>;
};

const rootElement = document.getElementById("root") as RootElement | null;

if (!rootElement) {
  throw new Error("Root element not found");
}

let root = rootElement.__reactRoot;

if (!root) {
  root = createRoot(rootElement);
  rootElement.__reactRoot = root;
}

root.render(<App />);

// Hot Module Replacement support
if (import.meta.hot) {
  import.meta.hot.accept("./App", (module) => {
    const App = module.default;
    root?.render(<App />);
  });
}
