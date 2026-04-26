"use client";

import { useEffect, useState } from "react";
import { Eye, ArrowUp, ArrowDown } from "lucide-react";

interface Member {
  id: string;
  email: string;
  username: string | null;
  icon_image: string | null;
  created_at: string;
  tier: string | null;
  role: string;
}

type View = "list" | "detail";
type SortField = "username" | "email" | "created_at" | "tier";
type SortOrder = "asc" | "desc";

const TIER_ORDER = { premium: 0, pro: 1, general: 2 };

export function AdminMembersManager() {
  const [view, setView] = useState<View>("list");
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

  useEffect(() => {
    loadMembers();
  }, [searchQuery, searchField, offset, sortField, sortOrder]);

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
    setView("detail");
  }

  function handleBackToList() {
    setView("list");
    setSelectedMember(null);
  }

  if (view === "detail" && selectedMember) {
    return (
      <div className="admin-members-detail">
        <button
          type="button"
          className="admin-members-back-btn"
          onClick={handleBackToList}
        >
          {"< 목록으로"}
        </button>
        <div className="admin-members-detail-card">
          <div className="admin-members-detail-avatar">
            {selectedMember.icon_image ? (
              <img src={selectedMember.icon_image} alt={selectedMember.username || "avatar"} />
            ) : (
              <div className="admin-members-avatar-placeholder" />
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
              <span className="admin-members-value admin-members-role">
                {selectedMember.role === "admin" ? "admin" : "mem"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
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
              <th>아바타</th>
              <th className="admin-members-sortable" onClick={() => handleSort("username")}>
                아이디
                {sortField === "username" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-sortable" onClick={() => handleSort("email")}>
                이메일
                {sortField === "email" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-sortable" onClick={() => handleSort("created_at")}>
                가입일
                {sortField === "created_at" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th className="admin-members-sortable" onClick={() => handleSort("tier")}>
                티어
                {sortField === "tier" && (
                  sortOrder === "asc" ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />
                )}
              </th>
              <th>Role</th>
              <th>상세보기</th>
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
                  <td className="admin-members-email">{member.email}</td>
                  <td className="admin-members-date">{formatDate(member.created_at)}</td>
                  <td className="admin-members-tier">{member.tier || "-"}</td>
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
    </div>
  );
}
