import { useEffect, useRef } from "react";
import "../../styles/components/Map.css";

/**
 * 사용법 예시
 * <KakaoMap
 *   center={{ lat: 37.867, lng: 127.728 }}
 *   level={5}
 *   theme="beige"                            // "beige" | "none"
 *   debugClickToCopy={true}
 *   onPlaceClick={(p) => console.log(p)}
 *   onPlacesLoaded={(list) => setList(list)} // 각 item에 __dong(동 이름) 포함
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

// 안전한 LatLng 생성(숫자/순서 보정)
function safeLatLng(kakao, lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) {
    throw new Error("Invalid coordinates");
  }
  if (Math.abs(la) > 90 && Math.abs(lo) <= 90) {
    return new kakao.maps.LatLng(lo, la);
  }
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

// 문자열 이스케이프 (팝업 콘텐츠 안전)
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ──────────────────────────────────────────────────────────────────────────────
// 춘천 bbox(대략값) + 타일링
function getChuncheonBounds(kakao) {
  const sw = new kakao.maps.LatLng(37.7500, 127.5500); // 남서
  const ne = new kakao.maps.LatLng(38.0300, 127.9000); // 북동
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

// 프랜차이즈 판별(강건한 정규화)
function normalizeBrand(s) {
  try {
    return (s || "").normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  } catch {
    return (s || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
  }
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

// 색상
const COLOR_FRANCHISE = "#6A4525"; // 진한 브라운
const COLOR_LOCAL = "#C9A27E";     // 연한 브라운

// ──────────────────────────────────────────────────────────────────────────────

export default function KakaoMap({
  center = { lat: 37.867, lng: 127.728 }, // 한림대 인근
  level = 5,
  theme = "beige",
  debugClickToCopy = true,
  onPlaceClick,
  onPlacesLoaded,
  style = { width: "100%", height: "360px" },
  className,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const clustererRef = useRef(null);
  const cafeMarkersRef = useRef([]);
  const overlayRef = useRef(null);          // 🔸 카드형 팝업(CustomOverlay)
  const infoWindowRef = useRef(null);       // (미사용 예비)

  // 콜백 최신화 ref
  const onPlaceClickRef = useRef(onPlaceClick);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  useEffect(() => { onPlaceClickRef.current = onPlaceClick; }, [onPlaceClick]);
  useEffect(() => { onPlacesLoadedRef.current = onPlacesLoaded; }, [onPlacesLoaded]);

  useEffect(() => {
    let unmounted = false;

    loadKakaoSdk()
      .then(async (kakao) => {
        if (unmounted) return;

        // 지도
        const centerLatLng = safeLatLng(kakao, center.lat, center.lng);
        const map = new kakao.maps.Map(containerRef.current, { center: centerLatLng, level });
        mapRef.current = map;

        // 컨트롤
        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

        // 센터 표시
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
          if (overlayRef.current) overlayRef.current.setMap(null);
        });

        // 춘천 전체 타일링 → CE7 수집
        const CHUNCHEON_BOUNDS = getChuncheonBounds(kakao);
        map.setBounds(CHUNCHEON_BOUNDS);

        const tiles = splitBounds(CHUNCHEON_BOUNDS, 4, 4, kakao);
        const places = new kakao.maps.services.Places();
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
            places.categorySearch("CE7", handle, {
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
              // eslint-disable-next-line no-await-in-loop
              dong = await coordToDong(lng, lat);
            }
            out.push({ ...p, __dong: dong });
            if (i % 10 === 0) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 50));
            }
          }
          return out;
        }

        // 타일 순차 수집
        let all = [];
        for (let i = 0; i < tiles.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          const part = await searchCE7InBounds(tiles[i]);
          all.push(...part);
          // eslint-disable-next-line no-await-in-loop
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

        // 동 이름 주석(초기 로딩을 동 기반으로)
        const withDong = await annotateDong(filtered);

        // 외부 콜백
        onPlacesLoadedRef.current && onPlacesLoadedRef.current(withDong);

        // 기존 마커/클러스터 정리
        if (cafeMarkersRef.current.length) {
          cafeMarkersRef.current.forEach((m) => m.setMap(null));
          cafeMarkersRef.current = [];
        }
        clustererRef.current?.clear();

        // 마커 + 팝업
        const markers = withDong.map((place) => {
          const lat = Number(place.y), lng = Number(place.x);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          const pos = new kakao.maps.LatLng(lat, lng);

          const franchise = isFranchiseName(place.place_name);
          const image = franchise ? pinImageFranchise : pinImageLocal;

          const m = new kakao.maps.Marker({
            position: pos,
            title: place.place_name,
            image,
            zIndex: franchise ? 2 : 1,
          });

          kakao.maps.event.addListener(m, "click", () => {
            onPlaceClickRef.current && onPlaceClickRef.current(place);

            const addr = place.road_address_name || place.address_name || "";
            const tel = place.phone || place.tel || "";
            const badge = franchise
              ? `<span class="map-popup__chip map-popup__chip--fr">프랜차이즈</span>`
              : `<span class="map-popup__chip map-popup__chip--lo">개인 카페</span>`;
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
            overlayRef.current.setPosition(m.getPosition());
            overlayRef.current.setMap(map);

            // 버튼 동작 바인딩
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
          });

          return m;
        }).filter(Boolean);

        cafeMarkersRef.current = markers;
        clustererRef.current.addMarkers(markers);

        // 결과 범위 맞춤
        const bounds = new kakao.maps.LatLngBounds();
        withDong.forEach((p) => bounds.extend(new kakao.maps.LatLng(Number(p.y), Number(p.x))));
        if (!bounds.isEmpty()) map.setBounds(bounds);

        // 디버그: 클릭 → 센터 이동 + 좌표 복사
        if (debugClickToCopy) {
          kakao.maps.event.addListener(map, "click", (e) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();
            centerMarkerRef.current?.setPosition(e.latLng);
            if (navigator.clipboard) {
              navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).catch(() => {});
            }
          });
        }
      })
      .catch((err) => console.error("Kakao SDK load failed:", err));

    return () => { unmounted = true; };
  }, [center.lat, center.lng, level, theme, debugClickToCopy]);

  const themedClass =
    "kakao-map " + (theme === "beige" ? "kakao-map--beige" : "") + (className ? ` ${className}` : "");

  // 정리
  useEffect(() => {
    return () => {
      centerMarkerRef.current?.setMap(null);
      cafeMarkersRef.current.forEach((m) => m.setMap(null));
      cafeMarkersRef.current = [];
      clustererRef.current?.clear();
      clustererRef.current?.setMap(null);
      overlayRef.current?.setMap(null);
      infoWindowRef.current?.close?.();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={themedClass}
      style={{
        width: "100%",
        height: "360px",
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
