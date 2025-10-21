import React from "react";
import "../../styles/pages/Home.css";

const CafeMain = () => {
  return(
<div className="split">{/* 좌우 2분할 레이아웃 */}
      {/* 왼쪽: 카페 리스트 영역 */}
      <aside className="sidebar" aria-label="카페 리스트">
        <header className="brand">
          <h1 className="title">닭갈비 말고 카페</h1>
          {/* <p className="subtitle">춘천 감성 카페 모음</p> */}
        </header>

         <section className="list">
          <div className="placeholder">
            여기에 카페 리스트가 들어갑니다.
            {/* 추후 지도 연결*/}
          </div>
        </section>
      </aside>
      <main className="content" aria-label="지도">
        <section className="map-wrap">
          <div id="mapPlaceholder" className="map-placeholder">
            지도 영역 (카카오맵 연동)
          </div>
        </section>
      </main>


      </div>

      //지도 영역

  );
};

export default CafeMain;