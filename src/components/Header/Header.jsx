import React from 'react';
import { Link } from "react-router-dom";
import "../../styles/components/Header.css";

const Header = () => {
  return (
    <header className="header_containor">
      <nav className="nav">
        <span className="page_name">☕ Chuncheon Café</span>
        <ul className="nav_list">
          <li><Link to="/popular">인기</Link></li>
          <li><Link to="/map">지도</Link></li>
          <li><Link to="/events">행사</Link></li>
          <li><Link to="/stories">스토리</Link></li>
        </ul>
      </nav>
      <div className="header_right">
        <Link to="/cafes/new" className="create_cafe">카페 등록</Link>
      </div>
    </header>
  );
};

export default Header;
