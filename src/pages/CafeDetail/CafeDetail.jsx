import React from "react";
import "../../styles/pages/CafeDetail.css";
import { FaStar } from "react-icons/fa";
import Header from "../../components/Header/Header";

const CafeDetail = () => {
  return (
    <><Header/>
    <div className="cafe-detail">
      
      
      <div className="cafe-info">
        <h1 className="cafe-name">카페 소양</h1>

        <div className="cafe-rating">
          <FaStar className="star-icon" />
          <span className="rating-score">4.8</span>
          <span className="cafe-address">춘천시 근화성종길 56</span>
        </div>

        <div className="cafe-image-box">
          <div className="cafe-image-placeholder">사진 영역</div>
        </div>

        <div className="menu-section">
          <h2>대표 메뉴</h2>
          <div className="menu-list">
            <div className="menu-item">
              아메리카노 <span className="price">4,000원</span>
            </div>
            <div className="menu-item">
              라떼 <span className="price">4,500원</span>
            </div>
            <div className="menu-item">
              샌드위치 <span className="price">6,000원</span>
            </div>
          </div>

          <div className="menu-tags">
            <span className="tag">분위기가 좋아요</span>
            <span className="tag">사진이 예뻐요</span>
          </div>
        </div>

        
          <button className="button-copy"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("📋 링크가 복사되었습니다!");
            }}
          >
            공유하기
          </button>
        
      </div>

      <div className="map-section">
        <div className="map-placeholder">지도 표시 영역</div>
      </div>
    </div>
    </>
  );
};

export default CafeDetail;
