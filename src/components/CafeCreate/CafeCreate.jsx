import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../styles/components/CafeCreate.css";

function stop(e) { e.stopPropagation(); }

const defaultForm = {
  name: "",
  category: "카페",
  address: "",
  phone: "",
  hours: "",
  priceRange: "₩8000",
  imageUrl: "",
  tags: "",
  amenities: {
    parking: false,
    takeout: false,
    pet: false,
    wifi: true,
    outlet: true,
    restroom: true,
  },
  description: "",
};

export default function CafeCreate({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  closeOnOverlayClick = true,
}) {
  const [form, setForm] = useState({ ...defaultForm, ...defaultValues });
  const firstFieldRef = useRef(null);

  // 스크롤 잠금 + ESC 닫힘
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  // 최초 포커스
  useEffect(() => {
    if (isOpen && firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleAmenity = (e) => {
    const { name, checked } = e.target;
    setForm((p) => ({ ...p, amenities: { ...p.amenities, [name]: checked } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 필수값 체크
    if (!form.name.trim() || !form.address.trim()) {
      alert("카페명과 주소는 필수입니다.");
      return;
    }
    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    onSubmit?.(payload);
    onClose?.();
    setForm({ ...defaultForm });
  };

  const PreviewCard = () => (
    <aside className="cafe-modal__preview" aria-label="미리보기">
      <div className="preview__image">
        {form.imageUrl ? (
          // 이미지 URL만(가이드) — 파일 업로드는 추후
          <img src={form.imageUrl} alt={`${form.name || "카페"} 대표 이미지`} onError={(e)=>{e.currentTarget.style.display="none";}}/>
        ) : (
          <div className="preview__placeholder">대표 이미지 URL(선택)</div>
        )}
      </div>
      <div className="preview__body">
        <h3 className="preview__title">{form.name || "카페 이름"}</h3>
        <div className="preview__meta">
          <span className="chip">{form.category}</span>
          <span className="chip">{form.priceRange}</span>
          {form.amenities.wifi && <span className="chip">Wi-Fi</span>}
          {form.amenities.outlet && <span className="chip">콘센트</span>}
          {form.amenities.parking && <span className="chip">주차</span>}
          {form.amenities.pet && <span className="chip">애견동반</span>}
          {form.amenities.takeout && <span className="chip">포장</span>}
          {form.amenities.restroom && <span className="chip">화장실</span>}
        </div>
        <p className="preview__address">{form.address || "주소"}</p>
        {form.description && <p className="preview__desc">{form.description}</p>}
        {!!form.tags.trim() && (
          <div className="preview__tags">
            {form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span key={t} className="tag">#{t}</span>
              ))}
          </div>
        )}
      </div>
    </aside>
  );

  const content = (
    <div
      className="cafe-modal__overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-hidden="true"
    >
      <section
        className="cafe-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cafe-modal-title"
        onClick={stop}
      >
        <header className="cafe-modal__header">
          <h2 id="cafe-modal-title">카페 등록</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="cafe-modal__grid">
          <PreviewCard />

          <form className="cafe-modal__form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="name">카페명 *</label>
              <input
                id="name"
                name="name"
                ref={firstFieldRef}
                value={form.name}
                onChange={handleChange}
                placeholder="예) 카페 봄봄 춘천점"
                required
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="category">카테고리</label>
                <select id="category" name="category" value={form.category} onChange={handleChange}>
                  <option>카페</option>
                  <option>디저트</option>
                  <option>베이커리</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="priceRange">가격대</label>
                <select id="priceRange" name="priceRange" value={form.priceRange} onChange={handleChange}>
                  <option>₩8000</option>
                  <option>₩9000</option>
                  <option>₩10000</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="address">주소 *</label>
              <input
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="예) 강원 춘천시 ..."
                required
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="phone">전화번호</label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="예) 033-123-4567"
                />
              </div>
              <div className="field">
                <label htmlFor="hours">영업시간</label>
                <input
                  id="hours"
                  name="hours"
                  value={form.hours}
                  onChange={handleChange}
                  placeholder="예) 매일 10:00–21:00"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="imageUrl">대표 이미지 URL (선택)</label>
              <input
                id="imageUrl"
                name="imageUrl"
                value={form.imageUrl}
                onChange={handleChange}
                placeholder="이미지는 안내만: URL을 넣으면 미리보기 표시"
              />
              <small className="help">* 파일 업로드는 추후 지원. 현재는 URL 가이드만 제공합니다.</small>
            </div>

            <fieldset className="field field--checkbox">
              <legend>편의시설</legend>
              <label><input type="checkbox" name="wifi" checked={form.amenities.wifi} onChange={handleAmenity}/> Wi-Fi</label>
              <label><input type="checkbox" name="outlet" checked={form.amenities.outlet} onChange={handleAmenity}/> 콘센트</label>
              <label><input type="checkbox" name="parking" checked={form.amenities.parking} onChange={handleAmenity}/> 주차</label>
              <label><input type="checkbox" name="takeout" checked={form.amenities.takeout} onChange={handleAmenity}/> 포장</label>
              <label><input type="checkbox" name="pet" checked={form.amenities.pet} onChange={handleAmenity}/> 애견동반</label>
              <label><input type="checkbox" name="restroom" checked={form.amenities.restroom} onChange={handleAmenity}/> 화장실</label>
            </fieldset>

            <div className="field">
              <label htmlFor="tags">태그 (쉼표로 구분)</label>
              <input
                id="tags"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="예) 루프탑, 감성, 디저트맛집"
              />
            </div>

            <div className="field">
              <label htmlFor="description">소개</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="카페 한 줄 소개나 특징을 적어주세요."
                rows={4}
              />
            </div>

            <div className="actions">
              <button type="button" className="btn ghost" onClick={onClose}>취소</button>
              <button type="submit" className="btn primary">등록</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );

  return createPortal(content, document.body);
}
