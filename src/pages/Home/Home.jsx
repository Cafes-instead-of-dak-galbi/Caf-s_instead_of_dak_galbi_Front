import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/pages/Home.css";
import Header from "../../components/Header/Header";
import KakaoMap from "../../components/Map/KakaoMap";

// ──────────────────────────────────────────────
// 유틸
const keyOf = (p) => p?.id || `${p?.x},${p?.y},${p?.place_name}`;
const telOf = (p) => (p?.phone || p?.tel || "").trim();
const addrOf = (p) => p?.road_address_name || p?.address_name || "";
const sanitizeTel = (t = "") => t.replace(/[^0-9+]/g, ""); // ← tel 링크용 정제

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
  for (const t of BRAND_SET) if (n.includes(t)) return "fr";
  return "lo";
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

// 로컬 스토리지 (즐겨찾기/클릭/최근 + 목록 캐시)
const LS_KEY = "cafe_stats_v1";
const LS_PLACES = "cafe_places_cache_v1";
const loadStats = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const saveStats = (obj) => { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {} };

// 인기 점수(로컬): 즐겨찾기 20, 클릭*2, 최근(24h=+6, 7d=+3)
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

// 썸네일 유틸
const thumbOf = (p) =>
  p?.thumbnail || p?.thumbnail_url || p?.photo || p?.image_url || p?.image || p?.img || null;

const firstLetter = (name = "?") => {
  const s = name.trim();
  return s ? s[0].toUpperCase() : "?";
};

const colorFromString = (s = "") => {
  const palette = [
    [0xF5,0xE6,0xC8],
    [0xFF,0xF9,0xF1],
    [0xE9,0xF1,0xFF],
    [0xEC,0xF8,0xF5],
    [0xF7,0xED,0xE7],
  ];
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  const c = palette[h % palette.length];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// ──────────────────────────────────────────────

export default function Home() {
  const [places, setPlaces] = useState([]);        // KakaoMap 원본
  const [mapApi, setMapApi] = useState(null);      // KakaoMap 제어
  const [myLoc, setMyLoc] = useState(null);        // {lat,lng}
  const [query, setQuery] = useState("");
  const [dong, setDong] = useState("전체");
  const [brand, setBrand] = useState("all");       // 'all' | 'fr' | 'lo'
  const [radius, setRadius] = useState("all");     // 'all' | 500 | 1000 | 3000
  const [sortBy, setSortBy] = useState("popular");// 'popular' | 'nearest' | 'recent' | 'name'
  const [stats, setStats] = useState(() => loadStats());
  const [showFavOnly, setShowFavOnly] = useState(false); // 즐겨찾기 전용 보기
  const itemRefs = useRef({});

  // URL 파라미터 → 상태 초기화 (퍼머링크)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q");        if (q) setQuery(q);
    const d = sp.get("dong");     if (d) setDong(d);
    const b = sp.get("brand");    if (b) setBrand(b);
    const r = sp.get("r");        if (r) setRadius(r);
    const s = sp.get("sort");     if (s) setSortBy(s);
    const fav = sp.get("fav");    if (fav === "1") setShowFavOnly(true);
  }, []);

  // 상태 변화 → URL 갱신 (퍼머링크)
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (dong !== "전체") params.set("dong", dong);
    if (brand !== "all") params.set("brand", brand);
    if (radius !== "all") params.set("r", radius);
    if (sortBy !== "popular") params.set("sort", sortBy);
    if (showFavOnly) params.set("fav", "1");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [query, dong, brand, radius, sortBy, showFavOnly]);

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
      if (showFavOnly) {
        const k = keyOf(p);
        if (!stats[k]?.fav) return false;
      }
      if (dong !== "전체" && (p.__dong || "기타") !== dong) return false;
      if (brand !== "all" && brandType(p.place_name) !== brand) return false;

      if (q) {
        const text = [p.place_name, p.__dong, addrOf(p), telOf(p)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (me && r !== Infinity) {
        const d = distanceM(p, me);
        if (d > r) return false;
      }
      return true;
    });
  }, [places, dong, brand, query, myLoc, radius, showFavOnly, stats]);

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

  // KakaoMap onPlacesLoaded -> places 세팅 + 캐시 저장(상세 새로고침 대응)
  const handlePlacesLoaded = (list) => {
    const arr = list || [];
    setPlaces(arr);
    try { localStorage.setItem(LS_PLACES, JSON.stringify(arr)); } catch {}
  };

  // 주소 1줄 ellipsis가 확실히 먹도록 ref 초기화
  useEffect(() => { itemRefs.current = {}; }, [sorted]);

  // CSV 내보내기
  const exportCsv = () => {
    const headers = ["name","dong","addr","tel","x","y"];
    const rows = sorted.map(p => [
      p.place_name,
      p.__dong || "",
      (addrOf(p) || "").replace(/\n/g, " "),
      telOf(p) || "",
      p.x ?? "",
      p.y ?? ""
    ]);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cafes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ──────────────────────────────────────────────
  // 지도 아래 섹션: 근처 Top5 / 최근 본 카페
  const placeByKey = useMemo(() => {
    const m = {};
    for (const p of places) m[keyOf(p)] = p;
    return m;
  }, [places]);

  const topNear = useMemo(() => {
    if (!myLoc) return [];
    return [...filtered]
      .map((p) => ({
        p,
        d: distanceM(p, myLoc),
        s: popularityScore(stats[keyOf(p)]),
      }))
      .filter((x) => Number.isFinite(x.d))
      .sort((a, b) => a.d - b.d || b.s - a.s)
      .slice(0, 5)
      .map((x) => x.p);
  }, [filtered, myLoc, stats]);

  const recentPlaces = useMemo(() => {
    return Object.entries(stats)
      .filter(([_, st]) => st?.last)
      .sort((a, b) => b[1].last - a[1].last)
      .map(([k]) => placeByKey[k])
      .filter(Boolean)
      .slice(0, 8);
  }, [stats, placeByKey]);

  // ──────────────────────────────────────────────

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

            {/* 즐겨찾기 토글 + CSV 내보내기 */}
            <div className="seg seg--tools" aria-label="도구">
              <button
                className={`seg__btn ${showFavOnly ? "is-active" : ""}`}
                onClick={() => setShowFavOnly(v => !v)}
                title="즐겨찾기한 카페만 보기"
              >
                ★ 즐겨찾기만
              </button>
              <button className="seg__btn" onClick={exportCsv} title="현재 보이는 리스트를 CSV로 저장">
                ⬇️ CSV
              </button>
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
                  const thumb = thumbOf(p);

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

                        {/* 썸네일 */}
                        <div
                          className="cafe-item__thumb"
                          aria-hidden="true"
                          style={{ background: colorFromString(p.place_name) }}
                        >
                          <div className="thumb-fallback">
                            <span className="thumb-letter">{firstLetter(p.place_name)}</span>
                          </div>
                          {thumb && (
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => { e.currentTarget.remove(); }}
                            />
                          )}
                        </div>

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
                          <div className="cafe-item__addr">{addrOf(p) || "주소 미상"}</div>
                        </div>

                        {/* 액션 */}
                        <div className="cafe-item__actions">
                          {/* 상세 페이지 이동 */}
                          <Link
                            className="btn-mini"
                            to={`/cafe/${encodeURIComponent(p.id || k)}`}
                            state={{ place: p }}
                            onClick={(e)=>e.stopPropagation()}
                          >
                            상세
                          </Link>

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

                          {/* 전화: 유/무 동일 pill UI */}
                          {tel ? (
                            <a
                              className="pill pill--tel"
                              href={`tel:${sanitizeTel(tel)}`}
                              onClick={(e) => e.stopPropagation()}
                              title="전화 걸기"
                            >
                              <span aria-hidden="true">📞</span>
                              <span className="nowrap">{tel}</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="pill pill--tel is-disabled"
                              aria-disabled="true"
                              onClick={(e) => e.stopPropagation()}
                              title="전화 정보 없음"
                            >
                              <span aria-hidden="true">📞</span>
                              <span>전화 없음</span>
                            </button>
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

          {/* ───────────── 지도 하단 콘텐츠 ───────────── */}
          <section className="below-map">
            <div className="below-row">
              <h3 className="below-title">📍 내 위치 근처 Top 5</h3>

              {!myLoc ? (
                <div className="below-placeholder">
                  내 위치를 반영하면 가까운 카페를 보여줄게요.
                  <button className="btn-mini" onClick={useMyLocation} style={{ marginLeft: 8 }}>
                    📍 내 위치 반영
                  </button>
                </div>
              ) : topNear.length === 0 ? (
                <div className="below-placeholder">주변에 조건에 맞는 카페가 없어요.</div>
              ) : (
                <ul className="mini-list">
                  {topNear.map((p) => {
                    const d = Math.round(distanceM(p, myLoc));
                    return (
                      <li key={keyOf(p)}>
                        <button
                          type="button"
                          className="mini-card"
                          onClick={() => focusFromList(p)}
                          title={p.place_name}
                        >
                          <div className="mini-title">{p.place_name}</div>
                          <div className="mini-meta">
                            {p.__dong && <span className="chip chip--dong">{p.__dong}</span>}
                            <span className="chip chip--dist">
                              {d >= 1000 ? (d / 1000).toFixed(1) + "km" : d + "m"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="below-row">
              <h3 className="below-title">🕒 최근 본 카페</h3>
              {recentPlaces.length === 0 ? (
                <div className="below-placeholder">아직 최근 본 카페가 없어요.</div>
              ) : (
                <div className="recent-chips">
                  {recentPlaces.map((p) => (
                    <button
                      key={keyOf(p)}
                      className="recent-chip"
                      title={p.place_name}
                      onClick={() => focusFromList(p)}
                    >
                      {p.place_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
