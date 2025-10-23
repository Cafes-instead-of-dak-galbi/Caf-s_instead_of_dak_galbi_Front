import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/pages/Home.css";
import Header from "../../components/Header/Header";
import KakaoMap from "../../components/Map/KakaoMap";

// ──────────────────────────────────────────────
// 유틸
const keyOf = (p) => p?.id || `${p?.x},${p?.y},${p?.place_name}`;
const telOf = (p) => (p?.phone || p?.tel || "").trim();
const addrOf = (p) => p?.road_address_name || p?.address_name || "";

const normalizeBrand = (s = "") =>
  (s.normalize ? s.normalize("NFKD") : s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/[^a-z0-9가-힣]/g, "");
const FRANCHISE_TOKENS = [
  "스타벅스","starbucks","스벅","리저브","이디야","ediya","투썸","twosome","투썸플레이스",
  "할리스","hollys","hollyscoffee","엔제리너스","angelinus","파스쿠찌","pascucci","커피빈","coffeebean","thecoffeebean",
  "빽다방","paik","paiks","폴바셋","paulbassett","탐앤탐스","tomntoms","tomandtoms","컴포즈","컴포즈커피","composecoffee","compose",
  "드롭탑","droptop","요거프레소","yogerpresso","커피베이","coffeebay","더벤티","venti","매머드","mammoth","mammothcoffee",
  "공차","gongcha","메가커피","megamgc","megacoffee","달콤","dalkomm","카페베네","caffebene"
];
const BRAND_SET = new Set(FRANCHISE_TOKENS.map(normalizeBrand));
const brandType = (name = "") => {
  const n = normalizeBrand(name);
  for (const t of BRAND_SET) if (n.includes(t)) return "fr"; // 프랜차이즈
  return "lo"; // 개인
};

// Haversine(meters)
const R = 6371e3;
const toRad = (d) => (d * Math.PI) / 180;
const distanceM = (p, me) => {
  if (!p || !me) return Infinity;
  const lat1 = Number(p.y), lon1 = Number(p.x);
  if (Number.isNaN(lat1) || Number.isNaN(lon1)) return Infinity;
  const φ1 = toRad(lat1), φ2 = toRad(me.lat);
  const Δφ = toRad(me.lat - lat1);
  const Δλ = toRad(me.lng - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 로컬 스토리지 (즐겨찾기/클릭/최근)
const LS_KEY = "cafe_stats_v1";
const loadStats = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
};
const saveStats = (obj) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {}
};

// 인기 점수(로컬): 즐겨찾기 가중 20, 클릭 2, 최근 방문(24h=+6, 7d=+3)
const popularityScore = (st) => {
  if (!st) return 0;
  const fav = st.fav ? 20 : 0;
  const clicks = (st.clicks || 0) * 2;
  const now = Date.now();
  let recent = 0;
  if (st.last) {
    const diff = (now - st.last) / 86400000;
    if (diff <= 1) recent = 6;
    else if (diff <= 7) recent = 3;
  }
  return fav + clicks + recent;
};

// ──────────────────────────────────────────────

export default function Home() {
  const [places, setPlaces] = useState([]);        // KakaoMap에서 전달되는 원본
  const [mapApi, setMapApi] = useState(null);      // KakaoMap 제어
  const [myLoc, setMyLoc] = useState(null);        // {lat,lng}
  const [query, setQuery] = useState("");
  const [dong, setDong] = useState("전체");
  const [brand, setBrand] = useState("all");       // 'all' | 'fr' | 'lo'
  const [radius, setRadius] = useState("all");     // 'all' | 500 | 1000 | 3000
  const [sortBy, setSortBy] = useState("popular"); // 'popular' | 'nearest' | 'recent' | 'name'
  const [stats, setStats] = useState(() => loadStats());
  const itemRefs = useRef({});                     // 자동 스크롤용

  // 동 목록
  const dongList = useMemo(() => {
    const m = new Map();
    for (const p of places) {
      const d = p.__dong || "기타";
      m.set(d, (m.get(d) || 0) + 1);
    }
    const arr = Array.from(m.entries()).sort((a,b) => a[0].localeCompare(b[0], "ko"));
    return [["전체", places.length], ...arr];
  }, [places]);

  // 필터 적용
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const me = myLoc;
    const r = radius === "all" ? Infinity : Number(radius);

    return places.filter((p) => {
      // 동 필터
      if (dong !== "전체" && (p.__dong || "기타") !== dong) return false;
      // 브랜드 필터
      if (brand !== "all" && brandType(p.place_name) !== brand) return false;
      // 검색(이름/동/주소/전화)
      if (q) {
        const text = [
          p.place_name, p.__dong, addrOf(p), telOf(p)
        ].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      // 반경 필터
      if (me && r !== Infinity) {
        const d = distanceM(p, me);
        if (d > r) return false;
      }
      return true;
    });
  }, [places, dong, brand, query, myLoc, radius]);

  // 정렬
  const sorted = useMemo(() => {
    const me = myLoc;
    const s = [...filtered].map((p) => {
      const k = keyOf(p);
      const st = stats[k];
      return {
        p,
        score: popularityScore(st),
        dist: me ? distanceM(p, me) : Infinity,
        last: st?.last || 0,
      };
    });

    switch (sortBy) {
      case "nearest":
        return s.sort((a, b) => a.dist - b.dist).map((x) => x.p);
      case "recent":
        return s.sort((a, b) => b.last - a.last).map((x) => x.p);
      case "name":
        return s.sort((a, b) => a.p.place_name.localeCompare(b.p.place_name, "ko")).map((x) => x.p);
      case "popular":
      default:
        // 동점이면 이름순
        return s
          .sort((a, b) => (b.score - a.score) || a.p.place_name.localeCompare(b.p.place_name, "ko"))
          .map((x) => x.p);
    }
  }, [filtered, sortBy, myLoc, stats]);

  // KakaoMap에서 클릭 시 호출 → 통계 업데이트 & 리스트 스크롤
  const handlePlaceClick = (p) => {
    const k = keyOf(p);
    const next = {
      ...stats,
      [k]: {
        fav: stats[k]?.fav || false,
        clicks: (stats[k]?.clicks || 0) + 1,
        last: Date.now(),
      },
    };
    setStats(next); saveStats(next);

    // 해당 카드로 스크롤
    const el = itemRefs.current[k];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // 리스트에서 클릭 → 지도 포커스 + 통계
  const focusFromList = (p) => {
    mapApi?.focusPlaceById?.(p.id, { level: 3 });
    handlePlaceClick(p);
  };

  // 즐겨찾기
  const toggleFav = (p) => {
    const k = keyOf(p);
    const cur = stats[k] || {};
    const next = { ...stats, [k]: { ...cur, fav: !cur.fav, last: cur.last || 0, clicks: cur.clicks || 0 } };
    setStats(next); saveStats(next);
  };

  // 내 위치 가져오기(정렬/필터용)
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  };

  // KakaoMap onPlacesLoaded -> places 세팅
  const handlePlacesLoaded = (list) => setPlaces(list || []);

  // 주소 1줄 ellipsis가 확실히 먹도록 ref 초기화
  useEffect(() => { itemRefs.current = {}; }, [sorted]);

  return (
    <div>
      <Header />
      <div className="split">
        {/* ───────────── 왼쪽: 리스트/필터 ───────────── */}
        <aside className="sidebar" aria-label="카페 리스트">
          <header className="brand">
            <h1 className="title">춘천 카페</h1>
            <p className="subtitle">프랜차이즈/개인 구분 · 동/반경/정렬 지원</p>

            {/* 검색 */}
            <div className="list-search">
              <input
                className="list-search__input"
                placeholder="카페명, 동, 주소, 전화 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="list-search__clear" onClick={() => setQuery("")} aria-label="지우기">×</button>
              )}
            </div>

            {/* 정렬 */}
            <div className="seg seg--tabs" role="tablist" aria-label="정렬">
              {[
                ["popular", "인기순"],
                ["nearest", "가까운순"],
                ["recent", "최근본"],
                ["name", "이름순"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  className={`seg__btn ${sortBy === key ? "is-active" : ""}`}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 브랜드 토글 */}
            <div className="seg seg--brand" aria-label="브랜드">
              {[
                ["all", "전체"],
                ["lo", "개인"],
                ["fr", "프랜차이즈"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`seg__btn ${brand === key ? "is-active" : ""}`}
                  onClick={() => setBrand(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 반경 + 내 위치 */}
            <div className="seg seg--radius">
              <button className="btn-mini" onClick={useMyLocation}>📍 내 위치 반영</button>
              {["all", 500, 1000, 3000].map((r) => (
                <button
                  key={r}
                  className={`seg__btn ${String(radius) === String(r) ? "is-active" : ""}`}
                  onClick={() => setRadius(String(r))}
                  disabled={!myLoc && r !== "all"}
                  title={!myLoc && r !== "all" ? "먼저 내 위치를 반영하세요" : undefined}
                >
                  {r === "all" ? "전체" : `${r >= 1000 ? r/1000+"km" : r+"m"}`}
                </button>
              ))}
            </div>

            {/* 동 필터 칩 */}
            <div className="dong-chips" role="group" aria-label="행정동">
              {dongList.map(([name, count]) => (
                <button
                  key={name}
                  className={`chip chip--filter ${dong === name ? "is-active" : ""}`}
                  onClick={() => setDong(name)}
                  title={`${name} (${count})`}
                >
                  {name} <span className="chip__count">{count}</span>
                </button>
              ))}
            </div>
          </header>

          {/* 리스트(스크롤) */}
          <section className="list">
            {sorted.length === 0 ? (
              <div className="placeholder">조건에 맞는 카페가 없습니다.</div>
            ) : (
              <ul className="cafe-list">
                {sorted.map((p) => {
                  const k = keyOf(p);
                  const fr = brandType(p.place_name) === "fr";
                  const tel = telOf(p);
                  const kakaoTo = `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
                  const isFav = !!stats[k]?.fav;
                  const dist = myLoc ? Math.round(distanceM(p, myLoc)) : null;

                  return (
                    <li key={k}>
                      <button
                        ref={(el) => (itemRefs.current[k] = el)}
                        type="button"
                        className={`cafe-item ${fr ? "is-franchise" : ""}`}
                        onClick={() => focusFromList(p)}
                        title={p.place_name}
                      >
                        {/* 왼쪽 바는 ::before */}

                        {/* 본문 */}
                        <div className="cafe-item__body">
                          <div className="cafe-item__title">
                            <span className="cafe-item__name">{p.place_name}</span>
                            {p.__dong && <span className="chip chip--dong">{p.__dong}</span>}
                            <span className={`chip ${fr ? "chip--fr" : "chip--lo"}`}>
                              {fr ? "프랜차이즈" : "개인 카페"}
                            </span>
                            {dist != null && (
                              <span className="chip chip--dist">{dist >= 1000 ? (dist/1000).toFixed(1)+"km" : dist+"m"}</span>
                            )}
                          </div>
                          {/* 주소 1줄 고정 */}
                          <div className="cafe-item__addr">{addrOf(p) || "주소 미상"}</div>
                        </div>

                        {/* 액션 */}
                        <div className="cafe-item__actions">
                          {/* 즐겨찾기 */}
                          <button
                            type="button"
                            className={`fav-btn ${isFav ? "is-on" : ""}`}
                            onClick={(e) => { e.stopPropagation(); toggleFav(p); }}
                            aria-label="즐겨찾기"
                            title={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
                          >
                            ★
                          </button>

                          {tel ? (
                            <a
                              className="cafe-link nowrap"
                              href={`tel:${tel.replace(/[^0-9+]/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📞 {tel}
                            </a>
                          ) : (
                            <span className="muted">전화 없음</span>
                          )}

                          <a
                            className="btn-mini"
                            target="_blank"
                            rel="noreferrer"
                            href={kakaoTo}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🧭 길찾기
                          </a>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>

        {/* ───────────── 오른쪽: 지도 ───────────── */}
        <main className="content" aria-label="지도">
          <section className="map-wrap">
            <KakaoMap
              center={{ lat: 37.88663, lng: 127.735395 }}
              level={5}
              theme="beige"
              onPlaceClick={handlePlaceClick}
              onPlacesLoaded={handlePlacesLoaded}
              onMapApi={(api) => setMapApi(api)}
              style={{ width: "100%", height: 480 }}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
