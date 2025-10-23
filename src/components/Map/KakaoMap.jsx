import { useEffect, useRef, useState, useMemo } from "react";
import "../../styles/components/Map.css";

/**
 * 사용법 예시
 * <KakaoMap
 *   center={{ lat: 37.88663, lng: 127.735395 }}
 *   level={5}
 *   theme="beige"                 // "beige" | "none"
 *   debugClickToCopy={true}
 *   onPlaceClick={(p) => console.log(p)}
 *   onPlacesLoaded={(list) => setList(list)} // __dong(동 이름) 포함
 *   onMapApi={(api) => setMapApi(api)}       // 리스트 클릭 시 지도 제어
 *   style={{ width: "100%", height: 480 }}
 * />
 */

const FALLBACK_KAKAO_JS_KEY = "ba585e9cad247b97fff579969d74478a";
const KAKAO_JS_KEY =
  (process.env.REACT_APP_KAKAO_JS_KEY && process.env.REACT_APP_KAKAO_JS_KEY.trim()) ||
  FALLBACK_KAKAO_JS_KEY;

// ──────────────────────────────────────────────────────────────────────────────
// SDK 로더
function loadKakaoSdk() {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) return resolve(window.kakao);

    const existing = document.querySelector(
      'script[src^="https://dapi.kakao.com/v2/maps/sdk.js"]'
    );

    const onReady = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
      } else reject(new Error("Kakao object not available"));
    };

    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", () => reject(new Error("Kakao SDK load failed")));
      if (window.kakao && window.kakao.maps) onReady();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(script);
  });
}

// 안전한 LatLng 생성
function safeLatLng(kakao, lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) throw new Error("Invalid coordinates");
  if (Math.abs(la) > 90 && Math.abs(lo) <= 90) return new kakao.maps.LatLng(lo, la);
  return new kakao.maps.LatLng(la, lo);
}

// 마커 이미지
function makePinImage(kakao, color = "#7b5b3a") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path fill="${color}" d="M14 0c7.18 0 13 5.58 13 12.46C27 20.5 14 36 14 36S1 20.5 1 12.46C1 5.58 6.82 0 14 0z"/>
    <circle cx="14" cy="12" r="4" fill="#fff" opacity=".95"/>
  </svg>`;
  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(28, 36), {
    offset: new kakao.maps.Point(14, 35),
  });
}

// 중앙 링(센터 마커)
function makeCenterDotImage(kakao, stroke = "#7b5b3a") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
    <circle cx="9" cy="9" r="7.5" fill="#fff" stroke="${stroke}" stroke-width="3"/>
  </svg>`;
  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(18, 18), {
    offset: new kakao.maps.Point(9, 9),
  });
}

// XSS-safe 텍스트
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ──────────────────────────────────────────────────────────────────────────────
// 춘천 bbox + 타일링
function getChuncheonBounds(kakao) {
  const sw = new kakao.maps.LatLng(37.7500, 127.5500);
  const ne = new kakao.maps.LatLng(38.0300, 127.9000);
  return new kakao.maps.LatLngBounds(sw, ne);
}
function splitBounds(bounds, rows = 4, cols = 4, kakao) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const latStep = (ne.getLat() - sw.getLat()) / rows;
  const lngStep = (ne.getLng() - sw.getLng()) / cols;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileSw = new kakao.maps.LatLng(sw.getLat() + r * latStep, sw.getLng() + c * lngStep);
      const tileNe = new kakao.maps.LatLng(sw.getLat() + (r + 1) * latStep, sw.getLng() + (c + 1) * lngStep);
      tiles.push(new kakao.maps.LatLngBounds(tileSw, tileNe));
    }
  }
  return tiles;
}

// 중복 제거
const dedupeById = (list) => {
  const seen = new Set();
  return list.filter((p) => {
    const id = p.id || `${p.x},${p.y},${p.place_name}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

// 프랜차이즈 판별(정규화)
function normalizeBrand(s) {
  try { return (s || "").normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); }
  catch { return (s || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, ""); }
}
const FRANCHISE_TOKENS = [
  "스타벅스","starbucks","스벅","리저브",
  "이디야","ediya",
  "투썸","twosome","투썸플레이스",
  "할리스","hollys","hollyscoffee",
  "엔제리너스","angelinus",
  "파스쿠찌","pascucci",
  "커피빈","coffeebean","thecoffeebean",
  "빽다방","paik","paiks",
  "폴바셋","paulbassett",
  "탐앤탐스","tomntoms","tomandtoms",
  "컴포즈","컴포즈커피","composecoffee","compose",
  "드롭탑","droptop",
  "요거프레소","yogerpresso",
  "커피베이","coffeebay",
  "더벤티","venti",
  "매머드","mammoth","mammothcoffee",
  "공차","gongcha",
  "메가커피","megamgc","megacoffee",
  "달콤","dalkomm",
  "카페베네","caffebene"
];
const BRAND_SET = new Set(FRANCHISE_TOKENS.map(normalizeBrand));
function isFranchiseName(name) {
  const n = normalizeBrand(name);
  for (const t of BRAND_SET) if (n.includes(t)) return true;
  return false;
}
const COLOR_FRANCHISE = "#6A4525"; // 진한 브라운
const COLOR_LOCAL = "#C9A27E";     // 연한 브라운

// ──────────────────────────────────────────────────────────────────────────────

export default function KakaoMap({
  center = { lat: 37.88663, lng: 127.735395 },
  level = 5,
  theme = "beige",
  debugClickToCopy = true,
  onPlaceClick,
  onPlacesLoaded,
  onMapApi, // ← 리스트에서 지도 제어용 API를 받는 콜백
  style = { width: "100%", height: "360px" },
  className,
}) {
  // 지도/마커 레퍼런스
  const mapBoxRef = useRef(null);          // 실제 지도 캔버스가 들어갈 div
  const mapRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const clustererRef = useRef(null);
  const cafeMarkersRef = useRef([]);       // [{ place, marker, franchise }]

  // 팝업/콜백 레퍼런스
  const overlayRef = useRef(null);
  const onPlaceClickRef = useRef(onPlaceClick);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  const openOverlayRef = useRef((place, marker) => {});

  useEffect(() => { onPlaceClickRef.current = onPlaceClick; }, [onPlaceClick]);
  useEffect(() => { onPlacesLoadedRef.current = onPlacesLoaded; }, [onPlacesLoaded]);

  // 검색창 상태
  const [query, setQuery] = useState("");
  const [allPlaces, setAllPlaces] = useState([]); // withDong 저장

  // 자동완성 목록 (간단 includes 기반)
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pick = [];
    for (const p of allPlaces) {
      const text = [
        p.place_name,
        p.__dong,
        p.road_address_name,
        p.address_name,
        p.phone || p.tel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (text.includes(q)) pick.push(p);
      if (pick.length >= 12) break;
    }
    return pick;
  }, [query, allPlaces]);

  // 검색 결과 선택 → 포커스 & 팝업
  const focusPlace = (p) => {
    const map = mapRef.current;
    if (!map || !p) return;

    const t =
      cafeMarkersRef.current.find((x) => x.place?.id === p.id) ||
      cafeMarkersRef.current.find(
        (x) => x.place?.x === p.x && x.place?.y === p.y && x.place?.place_name === p.place_name
      );

    if (t) {
      map.setLevel(3, { animate: true });
      map.panTo(t.marker.getPosition());
      openOverlayRef.current?.(t.place, t.marker);
    } else {
      // 폴백: 좌표로만 이동
      const pos = new window.kakao.maps.LatLng(Number(p.y), Number(p.x));
      map.setLevel(3, { animate: true });
      map.panTo(pos);
    }
    setQuery("");
  };

  useEffect(() => {
    let unmounted = false;

    loadKakaoSdk()
      .then(async (kakao) => {
        if (unmounted) return;

        // 지도 생성 (mapBoxRef 안에 렌더)
        const centerLatLng = safeLatLng(kakao, center.lat, center.lng);
        const map = new kakao.maps.Map(mapBoxRef.current, { center: centerLatLng, level });
        mapRef.current = map;

        // 컨트롤
        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

        // 센터 마커
        centerMarkerRef.current = new kakao.maps.Marker({
          position: centerLatLng,
          map,
          image: makeCenterDotImage(kakao),
          title: "Center",
        });

        // 클러스터러
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          styles: [{
            width: "36px",
            height: "36px",
            background: "rgba(123, 91, 58, 0.92)",
            color: "#fff",
            textAlign: "center",
            borderRadius: "50%",
            lineHeight: "36px",
            fontWeight: "700",
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }],
        });

        // 카드형 팝업
        overlayRef.current = new kakao.maps.CustomOverlay({ zIndex: 4 });
        kakao.maps.event.addListener(map, "click", () => {
          overlayRef.current?.setMap(null);
        });

        // 춘천 전체 타일링 → CE7 수집
        const CHUNCHEON_BOUNDS = getChuncheonBounds(kakao);
        map.setBounds(CHUNCHEON_BOUNDS);

        const tiles = splitBounds(CHUNCHEON_BOUNDS, 4, 4, kakao);
        const placesSvc = new kakao.maps.services.Places();
        const geocoder = new kakao.maps.services.Geocoder();

        const pinImageLocal = makePinImage(kakao, COLOR_LOCAL);
        const pinImageFranchise = makePinImage(kakao, COLOR_FRANCHISE);

        function searchCE7InBounds(bounds) {
          return new Promise((resolve) => {
            const acc = [];
            const handle = (data, status, pagination) => {
              if (status !== kakao.maps.services.Status.OK) return resolve(acc);
              acc.push(...data);
              if (pagination && pagination.hasNextPage) pagination.nextPage();
              else resolve(acc);
            };
            placesSvc.categorySearch("CE7", handle, {
              bounds,
              size: 15,
              sort: kakao.maps.services.SortBy.ACCURACY,
            });
          });
        }

        function coordToDong(lng, lat) {
          return new Promise((resolve) => {
            geocoder.coord2RegionCode(lng, lat, (res, status) => {
              if (status === kakao.maps.services.Status.OK && res && res.length) {
                const h = res.find((r) => r.region_type === "H") || res[0];
                resolve(h?.region_3depth_name || h?.region_2depth_name || "");
              } else resolve("");
            });
          });
        }

        async function annotateDong(list) {
          const out = [];
          for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const lat = Number(p.y), lng = Number(p.x);
            let dong = "";
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              dong = await coordToDong(lng, lat);
            }
            out.push({ ...p, __dong: dong });
            if (i % 10 === 0) await new Promise((r) => setTimeout(r, 50));
          }
          return out;
        }

        // 타일 순차 수집
        let all = [];
        for (let i = 0; i < tiles.length; i++) {
          const part = await searchCE7InBounds(tiles[i]);
          all.push(...part);
          await new Promise((r) => setTimeout(r, 120));
        }

        // 중복제거 + 춘천 필터
        const deduped = dedupeById(all);
        const filtered = deduped.filter((p) => {
          const addr = p.road_address_name || p.address_name || "";
          const lat = Number(p.y), lng = Number(p.x);
          const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
          const inBox = valid && CHUNCHEON_BOUNDS.contain(new kakao.maps.LatLng(lat, lng));
          const inChuncheonByAddr = addr.includes("춘천시");
          return inBox || inChuncheonByAddr;
        });

        // 동 이름 주석
        const withDong = await annotateDong(filtered);
        setAllPlaces(withDong); // ← 검색 자동완성에서 사용
        onPlacesLoadedRef.current && onPlacesLoadedRef.current(withDong);

        // 기존 마커 정리
        cafeMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
        cafeMarkersRef.current = [];
        clustererRef.current?.clear();

        // 팝업 오픈 함수 정의
        openOverlayRef.current = (place, marker) => {
          const addr = place.road_address_name || place.address_name || "";
          const tel = place.phone || place.tel || "";
          const franchise = isFranchiseName(place.place_name);
          const badge = franchise
            ? `<span class="map-popup__chip map-popup__chip--fr">프랜차이즈</span>`
            : `<span class="map-popup__chip map-popup__chip--lo">개인 카페</span>`;
          const lat = Number(place.y), lng = Number(place.x);
          const dong = place.__dong ? ` (${escapeHtml(place.__dong)})` : "";
          const id = `map-popup-${(place.id || `${lat}-${lng}`).toString().replace(/[^a-z0-9_-]/gi, "")}`;

          const html = `
            <div class="map-popup" id="${id}">
              <button class="map-popup__close" type="button" data-role="close" aria-label="닫기">×</button>
              <div class="map-popup__title">
                ${escapeHtml(place.place_name || "")}${dong} ${badge}
              </div>
              <div class="map-popup__addr">${escapeHtml(addr)}</div>
              <div class="map-popup__actions">
                <a class="btn btn--primary" target="_blank" rel="noreferrer"
                   href="https://map.kakao.com/link/to/${encodeURIComponent(place.place_name)},${place.y},${place.x}">
                  길찾기 열기
                </a>
                ${tel ? `<a class="btn" href="tel:${tel.replace(/[^0-9+]/g,"")}">전화</a>` : ""}
                <button class="btn" type="button" data-role="copy">좌표 복사</button>
              </div>
            </div>
          `;
          overlayRef.current.setContent(html);
          overlayRef.current.setPosition(marker.getPosition());
          overlayRef.current.setMap(map);

          // 버튼 바인딩
          setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            el.querySelector('[data-role="close"]')?.addEventListener(
              "click",
              () => overlayRef.current.setMap(null),
              { once: true }
            );
            const copyBtn = el.querySelector('[data-role="copy"]');
            if (copyBtn && navigator.clipboard) {
              copyBtn.addEventListener(
                "click",
                async () => {
                  try {
                    await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    const t = copyBtn.textContent;
                    copyBtn.textContent = "복사됨!";
                    setTimeout(() => (copyBtn.textContent = t), 900);
                  } catch {}
                },
                { once: true }
              );
            }
          }, 0);
        };

        // 마커 생성
        const tuples = withDong.map((place) => {
          const lat = Number(place.y), lng = Number(place.x);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          const pos = new kakao.maps.LatLng(lat, lng);
          const franchise = isFranchiseName(place.place_name);
          const image = franchise ? pinImageFranchise : pinImageLocal;

          const marker = new kakao.maps.Marker({
            position: pos,
            title: place.place_name,
            image,
            zIndex: franchise ? 2 : 1,
          });

          kakao.maps.event.addListener(marker, "click", () => {
            onPlaceClickRef.current && onPlaceClickRef.current(place);
            openOverlayRef.current(place, marker);
          });

          return { place, marker, franchise };
        }).filter(Boolean);

        cafeMarkersRef.current = tuples;
        clustererRef.current.addMarkers(tuples.map((t) => t.marker));

        // 결과 범위 맞춤
        const bounds = new kakao.maps.LatLngBounds();
        withDong.forEach((p) => bounds.extend(new kakao.maps.LatLng(Number(p.y), Number(p.x))));
        if (!bounds.isEmpty()) map.setBounds(bounds);

        // 디버그: 클릭 → 좌표 복사
        if (debugClickToCopy) {
          kakao.maps.event.addListener(map, "click", (e) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();
            centerMarkerRef.current?.setPosition(e.latLng);
            navigator.clipboard?.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).catch(() => {});
          });
        }

        // 🔸 지도 제어 API 노출: 리스트에서 호출해 포커스/팝업
        const api = {
          /** place.id로 포커스 + 팝업 */
          focusPlaceById: (id, opts = {}) => {
            const t = cafeMarkersRef.current.find((x) => x.place?.id === id);
            if (!t) return;
            if (opts.level) map.setLevel(opts.level, { animate: true });
            map.panTo(t.marker.getPosition());
            openOverlayRef.current?.(t.place, t.marker);
          },
          /** 좌표로 포커스 (x:lng, y:lat) */
          focusPlaceByCoord: (x, y, opts = {}) => {
            const pos = new kakao.maps.LatLng(Number(y), Number(x));
            if (opts.level) map.setLevel(opts.level, { animate: true });
            map.panTo(pos);
          },
        };
        typeof onMapApi === "function" && onMapApi(api);
      })
      .catch((err) => console.error("Kakao SDK load failed:", err));

    return () => { unmounted = true; };
  }, [center.lat, center.lng, level, theme, debugClickToCopy, onMapApi]);

  const themedClass =
    "kakao-map " + (theme === "beige" ? "kakao-map--beige" : "") + (className ? ` ${className}` : "");

  // 정리
  useEffect(() => {
    return () => {
      centerMarkerRef.current?.setMap(null);
      cafeMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
      cafeMarkersRef.current = [];
      clustererRef.current?.clear();
      clustererRef.current?.setMap(null);
      overlayRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, []);

  // ───────────────────────────────────────────
  // 렌더: 지도 캔버스 + 검색 오버레이
  // ───────────────────────────────────────────
  const onSubmitSearch = (e) => e.preventDefault();

  const onKeyDown = (e) => {
    if (e.key === "Escape") setQuery("");
    if (e.key === "Enter" && suggestions[0]) {
      e.preventDefault();
      focusPlace(suggestions[0]);
    }
  };

  return (
    <div
      className={themedClass}
      style={{
        position: "relative",
        width: "100%",
        height: "360px",
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 실제 지도 캔버스 */}
      <div
        ref={mapBoxRef}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* 지도 위 검색창 오버레이 */}
      <div className="map-search ui-layer" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmitSearch} style={{ position: "relative" }}>
          <input
            className="map-search__input"
            placeholder="카페명, 동, 주소, 전화 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              type="button"
              className="map-search__clear"
              aria-label="지우기"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </form>

        {query && suggestions.length > 0 && (
          <div className="map-search__list">
            {suggestions.map((p) => (
              <button
                key={p.id || `${p.x},${p.y},${p.place_name}`}
                type="button"
                className="map-search__item"
                onClick={() => focusPlace(p)}
                title={p.place_name}
              >
                <div className="map-search__item-title">
                  {p.place_name}
                  {p.__dong ? <span className="map-search__chip">{p.__dong}</span> : null}
                </div>
                <div className="map-search__item-sub">
                  {p.road_address_name || p.address_name || "주소 미상"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
