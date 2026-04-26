"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, ArrowUp, ArrowDown } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";
import Cropper, { Area } from "react-easy-crop";

interface Member {
  id: string;
  email: string;
  username: string | null;
  icon_image: string | null;
  created_at: string;
  tier: string | null;
  role: string;
}

type SortField = "username" | "email" | "created_at" | "tier";
type SortOrder = "asc" | "desc";

const TIER_ORDER = { premium: 0, pro: 1, general: 2 };

export function AdminMembersManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"username" | "email">("username");
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 랜덤 아바타 업로드
  const [randomAvatarIndex, setRandomAvatarIndex] = useState(1);
  const [randomCropSource, setRandomCropSource] = useState<string | null>(null);
  const [randomCrop, setRandomCrop] = useState({ x: 0, y: 0 });
  const [randomZoom, setRandomZoom] = useState(1);
  const [randomCroppedAreaPixels, setRandomCroppedAreaPixels] = useState<Area | null>(null);
  const [randomUploading, setRandomUploading] = useState(false);
  const [randomMessage, setRandomMessage] = useState<string | null>(null);
  const [randomAvatarList, setRandomAvatarList] = useState<{ name: string; url: string }[]>([]);
  const randomFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMembers();
  }, [searchQuery, searchField, offset, sortField, sortOrder]);

  useEffect(() => {
    loadRandomAvatars();
  }, []);

  async function loadRandomAvatars() {
    const res = await fetch("/api/admin/random-avatar");
    if (!res.ok) return;
    const data = (await res.json()) as { avatars: { name: string; url: string }[] };
    setRandomAvatarList(data.avatars ?? []);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "created_at" ? "desc" : "asc");
    }
    setOffset(0);
  }

  function compareStrings(a: string, b: string, reverse: boolean): number {
    const cmp = a.localeCompare(b, "ko-KR", { numeric: true });
    return reverse ? -cmp : cmp;
  }

  function sortMembers(membersToSort: Member[]): Member[] {
    const sorted = [...membersToSort];
    const isReverse = sortOrder === "desc";

    if (sortField === "username") {
      sorted.sort((a, b) => {
        const aVal = a.username || "";
        const bVal = b.username || "";
        return compareStrings(aVal, bVal, isReverse);
      });
    } else if (sortField === "email") {
      sorted.sort((a, b) => compareStrings(a.email, b.email, isReverse));
    } else if (sortField === "created_at") {
      sorted.sort((a, b) => {
        const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return isReverse ? -cmp : cmp;
      });
    } else if (sortField === "tier") {
      sorted.sort((a, b) => {
        const aVal = a.tier?.toLowerCase() || "general";
        const bVal = b.tier?.toLowerCase() || "general";
        const aOrder = TIER_ORDER[aVal as keyof typeof TIER_ORDER] ?? 999;
        const bOrder = TIER_ORDER[bVal as keyof typeof TIER_ORDER] ?? 999;
        const cmp = aOrder - bOrder;
        return isReverse ? -cmp : cmp;
      });
    }

    return sorted;
  }

  async function loadMembers() {
    try {
      setIsLoading(true);
      let url = `/api/admin/members?limit=${limit}&offset=${offset}`;

      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}&searchField=${searchField}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as {
          members: Member[];
          total: number;
        };
        const sortedMembers = sortMembers(data.members);
        setMembers(sortedMembers);
        setTotal(data.total);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ko-KR");
    } catch {
      return "날짜 오류";
    }
  }

  function handleMemberClick(member: Member) {
    setSelectedMember(member);
  }

  function handleCloseModal() {
    setSelectedMember(null);
  }

  function handleRandomFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRandomCropSource(ev.target?.result as string);
      setRandomCrop({ x: 0, y: 0 });
      setRandomZoom(1);
      setRandomCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
  }

  const onRandomCropComplete = useCallback((_: Area, pixels: Area) => {
    setRandomCroppedAreaPixels(pixels);
  }, []);

  async function buildRandomCroppedPreview(): Promise<string | null> {
    if (!randomCropSource || !randomCroppedAreaPixels) return null;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = randomCropSource;
    });
    const canvas = document.createElement("canvas");
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      image,
      randomCroppedAreaPixels.x,
      randomCroppedAreaPixels.y,
      randomCroppedAreaPixels.width,
      randomCroppedAreaPixels.height,
      0, 0, size, size
    );
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  async function submitRandomAvatar() {
    if (!randomCropSource) return;
    setRandomUploading(true);
    setRandomMessage(null);
    const dataUrl = await buildRandomCroppedPreview();
    if (!dataUrl) {
      setRandomMessage("이미지 처리 실패");
      setRandomUploading(false);
      return;
    }
    const res = await fetch("/api/admin/random-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, index: randomAvatarIndex }),
    });
    const data = (await res.json()) as { message?: string; name?: string; url?: string };
    setRandomMessage(data.message ?? "완료");
    setRandomUploading(false);
    if (res.ok) {
      setRandomCropSource(null);
      setRandomCroppedAreaPixels(null);
      if (randomFileInputRef.current) randomFileInputRef.current.value = "";
      setRandomAvatarIndex((prev) => prev + 1);
      if (data.name && data.url) {
        setRandomAvatarList((prev) => {
          const exists = prev.findIndex((a) => a.name === data.name);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = { name: data.name!, url: data.url! };
            return next.sort((a, b) => a.name.localeCompare(b.name));
          }
          return [...prev, { name: data.name!, url: data.url! }].sort((a, b) => a.name.localeCompare(b.name));
        });
      }
    }
  }

  return (
    <div className="admin-members-list-wrap">
      <div className="admin-members-search-wrap">
        <select
          value={searchField}
          onChange={(e) => {
            setSearchField(e.target.value as "username" | "email");
            setOffset(0);
            setSearchQuery("");
          }}
          className="admin-members-search-select"
        >
          <option value="username">아이디</option>
          <option value="email">이메일</option>
        </select>
        <input
          type="text"
          placeholder="검색..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOffset(0);
          }}
          className="admin-members-search-input"
        />
      </div>

      <div className="admin-members-table-wrap">
        <table className="admin-members-table">
          <thead className="admin-members-table-head">
            <tr>
              <th className="admin-members-avatar-cell">아바타</th>
              <th className="admin-members-sortable admin-members-username" onClick={() => handleSort("username")}>
                아이디
                {sortField === "username" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-sortable admin-members-date" onClick={() => handleSort("created_at")}>
                가입일
                {sortField === "created_at" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-sortable admin-members-tier" onClick={() => handleSort("tier")}>
                Tier
                {sortField === "tier" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-role">Role</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody className="admin-members-table-body">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="admin-members-loading">로딩 중...</td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-members-empty">회원이 없습니다.</td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="admin-members-table-row">
                  <td className="admin-members-avatar-cell">
                    {member.icon_image ? (
                      <img src={member.icon_image} alt={member.username || "avatar"} className="admin-members-avatar" />
                    ) : (
                      <div className="admin-members-avatar-placeholder" />
                    )}
                  </td>
                  <td className="admin-members-username">{member.username || "-"}</td>
                  <td className="admin-members-date">{formatDate(member.created_at)}</td>
                  <td className="admin-members-tier">
                    <TierBadge tier={member.tier} size={16} marginLeft={0} />
                    {!member.tier || (member.tier !== "pro" && member.tier !== "premium") ? (member.tier === "general" ? "." : (member.tier || "-")) : null}
                  </td>
                  <td className="admin-members-role">
                    {member.role === "admin" ? "admin" : "mem"}
                  </td>
                  <td className="admin-members-action">
                    <button
                      type="button"
                      className="admin-members-detail-btn"
                      onClick={() => handleMemberClick(member)}
                      aria-label="상세보기"
                    >
                      <Eye width={18} height={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-members-pagination">
        <span className="admin-members-count">총 {total}명</span>
        <div className="admin-members-pagination-buttons">
          <button
            type="button"
            className="admin-members-pagination-btn"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            이전
          </button>
          <span className="admin-members-page-info">
            {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit) || 1}
          </span>
          <button
            type="button"
            className="admin-members-pagination-btn"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
          >
            다음
          </button>
        </div>
      </div>

      {selectedMember && (
        <div className="admin-members-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-members-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="admin-members-modal-close" onClick={handleCloseModal}>✕</button>
            <div className="admin-members-detail-avatar">
              {selectedMember.icon_image ? (
                <img src={selectedMember.icon_image} alt={selectedMember.username || "avatar"} />
              ) : (
                <div className="admin-members-detail-avatar-placeholder" />
              )}
            </div>
            <div className="admin-members-detail-info">
              <div className="admin-members-detail-row">
                <span className="admin-members-label">아이디</span>
                <span className="admin-members-value">{selectedMember.username || "-"}</span>
              </div>
              <div className="admin-members-detail-row">
                <span className="admin-members-label">이메일</span>
                <span className="admin-members-value">{selectedMember.email}</span>
              </div>
              <div className="admin-members-detail-row">
                <span className="admin-members-label">가입일</span>
                <span className="admin-members-value">{formatDate(selectedMember.created_at)}</span>
              </div>
              <div className="admin-members-detail-row">
                <span className="admin-members-label">티어</span>
                <span className="admin-members-value">{selectedMember.tier || "-"}</span>
              </div>
              <div className="admin-members-detail-row">
                <span className="admin-members-label">Role</span>
                <span className="admin-members-value">{selectedMember.role === "admin" ? "admin" : "mem"}</span>
              </div>
            </div>
            <div className="admin-members-modal-footer">
              <button type="button" className="admin-members-modal-confirm" onClick={handleCloseModal}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 랜덤 아바타 업로드 섹션 */}
      <div className="random-avatar-section">
        <div className="random-avatar-section-title">랜덤 아바타 업로드</div>
        <div className="random-avatar-index-wrap">
          <span className="random-avatar-index-label">번호</span>
          <input
            type="number"
            min={1}
            max={40}
            value={randomAvatarIndex}
            onChange={(e) => setRandomAvatarIndex(Number(e.target.value))}
            className="random-avatar-index-input"
          />
          <span className="random-avatar-index-hint">→ random_{String(randomAvatarIndex).padStart(2, "0")}.jpg</span>
        </div>

        {randomCropSource && (
          <div className="random-avatar-cropper-wrap">
            <div className="random-avatar-cropper">
              <Cropper
                image={randomCropSource}
                crop={randomCrop}
                zoom={randomZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setRandomCrop}
                onZoomChange={setRandomZoom}
                onCropComplete={onRandomCropComplete}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={randomZoom}
              onChange={(e) => setRandomZoom(Number(e.target.value))}
              className="random-avatar-zoom-slider"
              aria-label="줌"
            />
          </div>
        )}

        <input
          ref={randomFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className="random-avatar-file-hidden"
          onChange={handleRandomFileChange}
        />

        <div className="random-avatar-actions">
          {!randomCropSource ? (
            <button
              type="button"
              className="random-avatar-select-btn"
              onClick={() => randomFileInputRef.current?.click()}
            >
              사진 선택
            </button>
          ) : (
            <>
              <button
                type="button"
                className="random-avatar-upload-btn"
                onClick={submitRandomAvatar}
                disabled={randomUploading}
              >
                {randomUploading ? "업로드 중..." : "업로드"}
              </button>
              <button
                type="button"
                className="random-avatar-cancel-btn"
                onClick={() => {
                  setRandomCropSource(null);
                  setRandomCroppedAreaPixels(null);
                  if (randomFileInputRef.current) randomFileInputRef.current.value = "";
                }}
              >
                취소
              </button>
            </>
          )}
        </div>

        {randomMessage && <div className="random-avatar-message">{randomMessage}</div>}

        {randomAvatarList.length > 0 && (
          <div className="random-avatar-grid">
            {randomAvatarList.map((item) => (
              <img key={item.name} src={item.url} alt={item.name} className="random-avatar-grid-item" title={item.name} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
