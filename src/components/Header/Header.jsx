import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/components/Header.css";

// ⬇️ 방금 제공한 모달 컴포넌트 경로에 맞게 수정하세요.
import CafeCreateModal from "../CafeCreate/CafeCreate"; // 예: "../../components/Modals/CafeCreateModal"

const Header = () => {
  const [modalOpen, setModalOpen] = useState(false);

  // 등록 버튼에서 넘어온 데이터 처리 (백엔드 연동 지점)
  const handleCreate = async (payload) => {
    // TODO: API 연동
    // await fetch("/api/cafes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    console.log("카페 등록 요청:", payload);
  };

  return (
    <header className="header_containor">
      <nav className="nav">
        <Link to="/" className="page_name">☕ 닭갈비 말고 카페</Link>
        <ul className="nav_list">
          <li><Link to="/popular">인기</Link></li>
          <li><Link to="/map">지도</Link></li>
          <li><Link to="/events">행사</Link></li>
          <li><Link to="/stories">스토리</Link></li>
        </ul>
      </nav>

      <div className="header_right">
        <button className="create_cafe" onClick={() => setModalOpen(true)}>
          카페 등록
        </button>
      </div>

      {/* 모달: ESC/오버레이 닫힘, 포커스/스크롤 잠금, 라이브 미리보기 포함 */}
      <CafeCreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        closeOnOverlayClick
      />
    </header>
  );
};

export default Header;
