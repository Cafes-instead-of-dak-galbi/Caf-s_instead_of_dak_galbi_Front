import React from 'react';
import '../../styles/pages/Home.css';
import Header from '../../components/Header/Header';
import KakaoMap from '../../components/Map/KakaoMap';

const Home = () => {
  return (
    <div>
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

      <div style={{ maxWidth: 980, margin: '40px auto', padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>한림대 중심 · 춘천 카페 지도</h1>

        {/* 기본값: 한림대 좌표 */}
        <KakaoMap
          center={{ lat: 37.886630, lng: 127.735395 }}
          level={5}
          radius={4000}
          theme="beige"
          onPlaceClick={(p) => console.log(p)}
          style={{ width: '100%', height: 480 }}
        />
      </div>
    </div>
  );
};






export default Home;
