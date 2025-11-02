import React, { useMemo } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import "../../styles/pages/CafeDetail.css";
import { FaStar } from "react-icons/fa";
import Header from "../../components/Header/Header";
import DetailMap from "../../components/Map/DetailMap"; // ✅ 추가

// ===== 유틸 (Home.jsx와 동일한 규칙 일부 복사) =====
const addrOf = (p) => p?.road_address_name || p?.address_name || "";
const telOf = (p) => (p?.phone || p?.tel || "").trim();

const normalizeBrand = (s = "") =>
  (s.normalize ? s.normalize("NFKD") : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/[^a-z0-9가-힣]/g, "");
const TOKENS = [
  "스타벅스","starbucks","스벅","리저브","이디야","ediya","투썸","twosome","투썸플레이스",
  "할리스","hollys","hollyscoffee","엔제리너스","angelinus","파스쿠찌","pascucci","커피빈","coffeebean","thecoffeebean",
  "빽다방","paik","paiks","폴바셋","paulbassett","탐앤탐스","tomntoms","tomandtoms","컴포즈","composecoffee","compose",
  "드롭탑","droptop","요거프레소","yogerpresso","커피베이","coffeebay","더벤티","venti","매머드","mammothcoffee",
  "공차","gongcha","메가커피","megamgc","megacoffee","달콤","dalkomm","카페베네","caffebene"
];
const BRAND_SET = new Set(TOKENS.map(normalizeBrand));
const brandType = (name = "") => {
  const n = normalizeBrand(name);
  for (const t of BRAND_SET) if (n.includes(t)) return "fr";
  return "lo";
};

// 썸네일
const thumbOf = (p) =>
  p?.thumbnail || p?.thumbnail_url || p?.photo || p?.image_url || p?.image || p?.img || null;

const firstLetter = (name = "?") => (name.trim()?.[0] || "?").toUpperCase();

const colorFromString = (s = "") => {
  const palette = [
    [0xF5,0xE6,0xC8], [0xFF,0xF9,0xF1], [0xE9,0xF1,0xFF], [0xEC,0xF8,0xF5], [0xF7,0xED,0xE7],
  ];
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  const c = palette[h % palette.length];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// 캐시에서 place 찾기(새로고침 대응)
const LS_PLACES = "cafe_places_cache_v1";
const readCache = () => { try { return JSON.parse(localStorage.getItem(LS_PLACES)) || []; } catch { return []; } };
const keyOf = (p) => p?.id || `${p?.x},${p?.y},${p?.place_name}`;

function findPlace(pid, statePlace) {
  if (statePlace) return statePlace;
  const list = readCache();
  const target = decodeURIComponent(pid);
  return (
    list.find(p => String(p.id) === target) ||
    list.find(p => keyOf(p) === target) ||
    null
  );
}

const CafeDetail = () => {
  const { pid } = useParams();
  const location = useLocation();
  const place = useMemo(() => findPlace(pid, location.state?.place), [pid, location.state]);

  if (!place) {
    return (
      <>
        <Header/>
        <div className="cafe-detail" style={{padding: 24, justifyContent:"center"}}>
          <div>
            <h2>상세 데이터를 찾을 수 없어요 😢</h2>
            <p>목록에서 다시 진입하거나, 다른 카페를 선택해 보세요.</p>
            <Link to="/" className="button-copy" style={{textDecoration:"none"}}>목록으로</Link>
          </div>
        </div>
      </>
    );
  }

  const name = place.place_name || "이름 미상";
  const addr = addrOf(place) || "주소 미상";
  const tel  = telOf(place);
  const fr   = brandType(name) === "fr";
  const kakaoTo = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${place.y},${place.x}`;
  const thumb = thumbOf(place);

  // 메뉴/태그는 데이터가 있으면 사용하고, 없으면 예시 노출
  const menu = place.menu || [
    { n: "아메리카노", p: "4,000원" },
    { n: "라떼",     p: "4,500원" },
    { n: "샌드위치", p: "6,000원" },
  ];
  const tags = place.tags || (fr ? ["프랜차이즈", "주차 가능?"] : ["개인 카페", "포토스팟?"]);

  return (
    <>
      <Header/>
      <div className="cafe-detail">
        {/* 왼쪽 정보 */}
        <div className="cafe-info">
          <h1 className="cafe-name">{name}</h1>

          <div className="cafe-rating">
            {place.rating ? (
              <>
                <FaStar className="star-icon" />
                <span className="rating-score">{place.rating}</span>
                <span className="cafe-address">{addr}</span>
              </>
            ) : (
              <span className="cafe-address">{addr}</span>
            )}
          </div>

          <div
            className="cafe-image-box"
            style={{ background: colorFromString(name) }}
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8 }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="cafe-image-placeholder">
                <span style={{ fontSize: 36, fontWeight: 800 }}>{firstLetter(name)}</span>
              </div>
            )}
          </div>

          <div className="menu-section">
            <h2>대표 메뉴</h2>
            <div className="menu-list">
              {menu.map((m, i) => (
                <div className="menu-item" key={i}>
                  {m.n} <span className="price">{m.p}</span>
                </div>
              ))}
            </div>

            <div className="menu-tags">
              {tags.map((t, i) => (
                <span className="tag" key={i}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {tel ? (
              <a className="button-copy" href={`tel:${tel.replace(/[^0-9+]/g,"")}`} style={{ textDecoration:"none" }}>
                전화하기
              </a>
            ) : null}

            <a className="button-copy" href={kakaoTo} target="_blank" rel="noreferrer" style={{ textDecoration:"none" }}>
              길찾기
            </a>

            <button
              className="button-copy"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("📋 링크가 복사되었습니다!");
              }}
            >
              공유하기
            </button>
          </div>
        </div>

        {/* 오른쪽 지도 */}
        <div className="map-section">
          <DetailMap
            lat={Number(place.y)}   // 카카오: y=위도, x=경도
            lng={Number(place.x)}
            name={name}
            level={3}
            className="detail-map"
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </>
  );
};

export default CafeDetail;
