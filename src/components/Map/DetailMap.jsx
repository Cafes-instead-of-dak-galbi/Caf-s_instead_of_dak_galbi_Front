import React, { useEffect, useRef } from "react";

/**
 * 단일 마커 지도
 * props: { lat, lng, name, level=3, className, style }
 * .env:
 *   Vite  → VITE_KAKAO_JS_KEY=...
 *   CRA   → REACT_APP_KAKAO_JS_KEY=...
 */
export default function DetailMap({
  lat,
  lng,
  name = "",
  level = 3,
  className = "",
  style = {},
}) {
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;

    const ensureKakao = () =>
      new Promise((resolve, reject) => {
        if (window.kakao?.maps) {
          return window.kakao.maps.load(() => resolve(window.kakao));
        }

        const APP_KEY =
          (typeof import.meta !== "undefined" && import.meta.env?.VITE_KAKAO_JS_KEY) ||
          (typeof process !== "undefined" && process.env?.REACT_APP_KAKAO_JS_KEY);

        const exist = document.querySelector('script[data-kakao-map-sdk="true"]');
        const onLoad = () => {
          if (!window.kakao?.maps) return reject(new Error("Kakao SDK load failed"));
          window.kakao.maps.load(() => resolve(window.kakao));
        };

        if (!exist) {
          const s = document.createElement("script");
          s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY || ""}&autoload=false&libraries=services`;
          s.async = true;
          s.defer = true;
          s.dataset.kakaoMapSdk = "true";
          s.onload = onLoad;
          s.onerror = () => reject(new Error("Kakao SDK script error"));
          document.head.appendChild(s);
        } else {
          exist.addEventListener("load", onLoad, { once: true });
        }
      });

    const init = async () => {
      try {
        const kakao = await ensureKakao();
        if (!mounted || !ref.current || !isFinite(lat) || !isFinite(lng)) return;

        const center = new kakao.maps.LatLng(Number(lat), Number(lng));
        const map = new kakao.maps.Map(ref.current, { center, level });
        const marker = new kakao.maps.Marker({ position: center });
        marker.setMap(map);

        if (name) {
          const iw = new kakao.maps.InfoWindow({
            content: `<div style="padding:6px 8px;font-size:12px;white-space:nowrap;">${escapeHtml(
              name
            )}</div>`,
          });
          iw.open(map, marker);
        }

        // a11y
        ref.current.tabIndex = 0;
        ref.current.setAttribute("role", "application");
        ref.current.setAttribute("aria-label", `${name || "카페"} 위치 지도`);
      } catch (e) {
        console.error(e);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [lat, lng, name, level]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", minHeight: 360, borderRadius: 8, ...style }}
    />
  );
}

function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
