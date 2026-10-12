import { createRoot } from "react-dom/client";
import App from "./App";
import "./game/game.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到遊戲根節點。 ");
}

createRoot(root).render(<App />);
