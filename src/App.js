import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home/Home";
import CafeDetail from "./pages/CafeDetail/CafeDetail"; // ✅ 추가!

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/Cafe/:pid" element={<CafeDetail/>} /> {/* ✅ 추가! */}
    </Routes>
  );
}

export default App;
