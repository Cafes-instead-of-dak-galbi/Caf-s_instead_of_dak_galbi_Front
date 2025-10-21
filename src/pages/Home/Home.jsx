import React from 'react';
import '../../styles/pages/Home.css';
import Header from '../../components/Header/Header';
import KakaoMap from '../../components/Map/KakaoMap';

const Home = () => {
  return (
    <div>
      <Header />
      <p>처음에 들어오면 로딩 되는 메인 페이지 입니다.</p>

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
