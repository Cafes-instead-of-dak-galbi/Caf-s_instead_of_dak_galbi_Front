import { useEffect, useRef } from "react";
import "../../styles/components/Map.css";

/**
 * 사용법 예시
 * <KakaoMap
 *   center={{ lat: 37.867, lng: 127.728 }}  // 기본 중심 좌표
 *   level={5}
 *   radius={4000}
 *   theme="beige"                            // "beige" | "none"
 *   debugClickToCopy={true}                  // 지도 클릭 시 좌표 표시+복사
 *   onPlaceClick={(p) => console.log(p)}     // 마커 클릭 시 콜백(선택)
 *   onPlacesLoaded={(list) => setList(list)} // 검색결과 목록 콜백(선택)
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
  // 위도가 90을 넘고 경도가 90 이하인 등, 뒤바뀐 패턴이면 스왑
  if (Math.abs(la) > 90 && Math.abs(lo) <= 90) {
    return new kakao.maps.LatLng(lo, la);
  }
  return new kakao.maps.LatLng(la, lo);
}

// 브라운 핀 마커 이미지
function makePinImage(kakao, color = "#7b5b3a") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path fill="${color}" d="M14 0c7.18 0 13 5.58 13 12.46C27 20.5 14 36 14 36S1 20.5 1 12.46C1 5.58 6.82 0 14 0z"/>
    <circle cx="14" cy="12" r="4" fill="#fff" opacity=".95"/>
  </svg>`;
  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  // 핀 끝(바닥중앙)에 맞도록 오프셋 미세 조정
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(28, 36), {
    offset: new kakao.maps.Point(14, 35),
  });
}

// 중앙 링(센터 마커) 이미지
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

// ──────────────────────────────────────────────────────────────────────────────

export default function KakaoMap({
  center = { lat: 37.867, lng: 127.728 }, // ✅ 기본 중심
  level = 5,
  radius = 4000, // m
  theme = "beige",
  debugClickToCopy = true,
  onPlaceClick,
  onPlacesLoaded,
  style = { width: "100%", height: "360px" },
  className,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const clustererRef = useRef(null);
  const cafeMarkersRef = useRef([]);
  const infoWindowRef = useRef(null);

  useEffect(() => {
    let unmounted = false;

    loadKakaoSdk()
      .then((kakao) => {
        if (unmounted) return;

        // 지도 생성
        const centerLatLng = safeLatLng(kakao, center.lat, center.lng);
        const map = new kakao.maps.Map(containerRef.current, {
          center: centerLatLng,
          level,
        });
        mapRef.current = map;

        // 컨트롤(우측)
        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

        // 공용 인포윈도우
        infoWindowRef.current = new kakao.maps.InfoWindow({ zIndex: 3 });

        // 센터 마커(작은 링)
        centerMarkerRef.current = new kakao.maps.Marker({
          position: centerLatLng,
          map,
          image: makeCenterDotImage(kakao),
          title: "Center",
        });

        // 반경 원(시각 확인용)
        circleRef.current = new kakao.maps.Circle({
          center: centerLatLng,
          radius,
          strokeWeight: 2,
          strokeColor: "#7b5b3a",
          strokeOpacity: 0.6,
          strokeStyle: "solid",
          fillColor: "#7b5b3a",
          fillOpacity: 0.08,
        });
        circleRef.current.setMap(map);

        // 클러스터러(브라운 배지)
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          styles: [
            {
              width: "36px",
              height: "36px",
              background: "rgba(123, 91, 58, 0.92)",
              color: "#fff",
              textAlign: "center",
              borderRadius: "50%",
              lineHeight: "36px",
              fontWeight: "700",
              boxShadow: "0 2px 8px rgba(0,0,0,.15)",
            },
          ],
        });

        // 카페 검색(CE7) — 중심 좌표 기준
        const places = new kakao.maps.services.Places();
        places.categorySearch(
          "CE7",
          (data, status) => {
            if (status !== kakao.maps.services.Status.OK) return;

            // 춘천 필터(주소에 '춘천' 포함)
            const result = data.filter((p) => {
              const addr = p.road_address_name || p.address_name || "";
              return addr.includes("춘천");
            });
            if (typeof onPlacesLoaded === "function") onPlacesLoaded(result);

            const pinImage = makePinImage(kakao);
            const markers = result
              .map((place) => {
                const lat = Number(place.y); // 위도
                const lng = Number(place.x); // 경도
                if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
                const pos = new kakao.maps.LatLng(lat, lng);

                const m = new kakao.maps.Marker({
                  position: pos,
                  title: place.place_name,
                  image: pinImage,
                });

                kakao.maps.event.addListener(m, "click", () => {
                  if (typeof onPlaceClick === "function") onPlaceClick(place);

                  const addr = place.road_address_name || place.address_name || "";
                  const content = `
                    <div style="padding:10px;min-width:220px">
                      <div style="font-weight:700;margin-bottom:6px">${place.place_name}</div>
                      <div style="font-size:12px;color:#6b5b52">${addr}</div>
                      <div style="margin-top:8px">
                        <a href="https://map.kakao.com/link/to/${encodeURIComponent(
                          place.place_name
                        )},${place.y},${place.x}" target="_blank" rel="noreferrer">
                          길찾기 열기
                        </a>
                      </div>
                    </div>`;
                  infoWindowRef.current.setContent(content);
                  infoWindowRef.current.open(map, m);
                });

                return m;
              })
              .filter(Boolean);

            cafeMarkersRef.current = markers;
            clustererRef.current.addMarkers(markers);

            // 바운즈(센터 포함)
            const bounds = new kakao.maps.LatLngBounds();
            bounds.extend(centerLatLng);
            markers.forEach((mm) => bounds.extend(mm.getPosition()));
            map.setBounds(bounds);
          },
          {
            location: centerLatLng,
            radius: Math.min(Math.max(radius, 100), 20000),
            sort: kakao.maps.services.SortBy.DISTANCE,
          }
        );

        // 디버그: 클릭 → 센터마커 이동 + 좌표표시/복사
        if (debugClickToCopy) {
          kakao.maps.event.addListener(map, "click", (e) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();

            if (centerMarkerRef.current) {
              centerMarkerRef.current.setPosition(e.latLng);
            }
            if (circleRef.current) {
              circleRef.current.setPosition(e.latLng);
            }

            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(
                `<div style="padding:6px 8px;font-size:12px">lat ${lat.toFixed(
                  6
                )}, lng ${lng.toFixed(6)}</div>`
              );
              infoWindowRef.current.open(map, centerMarkerRef.current);
            }

            console.log("[CLICK]", lat, lng);
            if (navigator.clipboard) {
              navigator.clipboard
                .writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                .catch(() => {});
            }
          });
        }

        // 리사이즈 대응
        const onResize = () => {
          map.relayout();
          map.setCenter(centerLatLng);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
      })
      .catch((err) => console.error("Kakao SDK load failed:", err));

    // center/level/radius가 바뀌면 재초기화(간단·확실)
  }, [center.lat, center.lng, level, radius, theme, debugClickToCopy]);

  // 테마 클래스
  const themedClass =
    "kakao-map " + (theme === "beige" ? "kakao-map--beige" : "") + (className ? ` ${className}` : "");

  // 정리
  useEffect(() => {
    return () => {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
        centerMarkerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      if (cafeMarkersRef.current.length) {
        cafeMarkersRef.current.forEach((m) => m.setMap(null));
        cafeMarkersRef.current = [];
      }
      if (clustererRef.current) {
        clustererRef.current.clear();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
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
