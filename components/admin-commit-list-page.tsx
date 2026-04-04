"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CommitReportSection = {
  title: string;
  bullets: string[];
};

type CommitReportItem = {
  id: string;
  menu: string;
  heading: string;
  displayDateTime: string;
  displayTime: string;
  year: number;
  month: number;
  day: number;
  aiAgent: string;
  originalReview: string;
  meta?: string;
  keywords: string[];
  sections: CommitReportSection[];
};

type WorkLogApiRow = {
  id: string;
  commit_hash: string;
  title: string;
  summary: string;
  details: string | null;
  original_review: string | null;
  status: "draft" | "done" | "rollback";
  report_url: string | null;
  deployed_at: string | null;
  author_name_snapshot: string;
  created_at: string;
  updated_at: string;
};

const YEAR_OPTIONS = [2026, 2027] as const;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 || 12;
  return `${year}/${month}/${day} ${hour12}:${minute}${period}`;
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

function linesToBullets(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function textToParagraphs(input: string): string[] {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const withBreaks = normalized
    .replace(/\s+(?=\d+[).]\s)/g, "\n")
    .replace(/\s+(?=[•\-]\s)/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return withBreaks
    .split(/\n{2,}|\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDateParts(iso: string | null): { year: number; month: number; day: number } {
  if (!iso) {
    return { year: 0, month: 0, day: 0 };
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { year: 0, month: 0, day: 0 };
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  return {
    year,
    month,
    day,
  };
}

function toReportItem(row: WorkLogApiRow): CommitReportItem {
  const summary = row.summary?.trim() ?? "";
  const details = row.details?.trim() ?? "";
  const originalReview = row.original_review?.trim() || details || summary || "원본 리뷰가 아직 없습니다.";
  const menu = `${row.commit_hash} - ${row.title}`;
  const sourceIso = row.deployed_at ?? row.updated_at ?? row.created_at;
  const dateParts = parseDateParts(sourceIso);

  const sections: CommitReportSection[] = [];
  if (summary) {
    sections.push({
      title: "간략 리뷰",
      bullets: [summary],
    });
  }
  if (details) {
    sections.push({
      title: "상세 리뷰",
      bullets: linesToBullets(details),
    });
  }
  if (sections.length === 0) {
    sections.push({
      title: "내용",
      bullets: ["등록된 요약/상세 내용이 없습니다."],
    });
  }

  const metaParts: string[] = [
    `커밋: ${row.commit_hash}`,
    `상태: ${row.status}`,
  ];
  if (row.report_url) {
    metaParts.push(`링크: ${row.report_url}`);
  }

  return {
    id: row.id,
    menu,
    heading: row.title,
    displayDateTime: formatDateTime(sourceIso),
    displayTime: formatTimeOnly(sourceIso),
    year: dateParts.year,
    month: dateParts.month,
    day: dateParts.day,
    aiAgent: row.author_name_snapshot?.trim() || "Unknown",
    originalReview,
    meta: metaParts.join(" / "),
    keywords: [
      row.commit_hash,
      row.title,
      summary,
      details,
      originalReview,
      row.author_name_snapshot,
      row.status,
    ].filter(Boolean),
    sections,
  };
}

export function AdminCommitListPage() {
  const router = useRouter();
  const today = new Date();
  const initialYear = today.getFullYear() === 2027 ? "2027" : "2026";
  const initialMonth = String(Math.min(Math.max(today.getMonth() + 1, 1), 12));
  const initialDay = String(Math.min(Math.max(today.getDate(), 1), 31));

  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [items, setItems] = useState<CommitReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/work-logs?limit=1000");
      const data = (await response.json()) as { items?: WorkLogApiRow[]; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "작업 이력을 불러오지 못했습니다.");
      }
      const rows = Array.isArray(data.items) ? data.items : [];
      setItems(rows.map(toReportItem));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "작업 이력 조회 중 오류가 발생했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(item: CommitReportItem) {
    if (deletingItemId) return;
    if (!window.confirm(`'${item.heading}' 항목을 삭제할까요?`)) return;
    setDeletingItemId(item.id);
    try {
      const response = await fetch(`/api/admin/work-logs/${item.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        window.alert(payload?.message ?? "삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (openId === item.id) setOpenId(null);
      if (detailItemId === item.id) setDetailItemId(null);
      await loadItems();
    } catch {
      window.alert("삭제 중 네트워크 오류가 발생했습니다.");
    } finally {
      setDeletingItemId(null);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("work_list_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    try {
      window.localStorage.setItem("work_list_theme", theme);
    } catch {
      // no-op
    }
  }, [theme]);

  useEffect(() => {
    const pageRoot = document.querySelector<HTMLElement>(".admin-work-list-page");
    if (!pageRoot) return;
    if (theme === "dark") {
      pageRoot.dataset.reportTheme = "dark";
      return () => {
        pageRoot.removeAttribute("data-report-theme");
      };
    }
    if (theme === "light") {
      pageRoot.dataset.reportTheme = "light";
      return () => {
        pageRoot.removeAttribute("data-report-theme");
      };
    }
    pageRoot.removeAttribute("data-report-theme");
    return () => {
      pageRoot.removeAttribute("data-report-theme");
    };
  }, [theme]);

  const dateFilteredItems = useMemo(() => {
    return items.filter((item) => {
      return (
        item.year === Number(selectedYear) &&
        item.month === Number(selectedMonth) &&
        item.day === Number(selectedDay)
      );
    });
  }, [items, selectedYear, selectedMonth, selectedDay]);

  const filteredItems = useMemo(() => {
    const normalized = normalizeQuery(query);
    if (!normalized) return dateFilteredItems;
    return dateFilteredItems.filter((item) => {
      const text = `${item.menu} ${item.heading} ${item.meta ?? ""} ${item.keywords.join(" ")}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [dateFilteredItems, query]);

  useEffect(() => {
    if (!openId) return;
    if (filteredItems.some((item) => item.id === openId)) return;
    setOpenId(null);
  }, [openId, filteredItems]);

  useEffect(() => {
    if (!detailItemId) return;
    if (items.some((item) => item.id === detailItemId)) return;
    setDetailItemId(null);
  }, [detailItemId, items]);

  const detailItem = detailItemId ? items.find((item) => item.id === detailItemId) ?? null : null;
  const detailItemOriginalParagraphs = detailItem ? textToParagraphs(detailItem.originalReview) : [];

  return (
    <div className="admin-commit-report" data-theme={theme ?? undefined}>
      <div className={`admin-commit-report-stage${detailItem ? " is-detail-open" : ""}`}>
        <div className="admin-commit-report-screen admin-commit-report-screen-main">
          <div className="admin-commit-report-top">
            <div className="admin-commit-report-head">
              <div className="admin-commit-report-top-actions">
                <Link href="/" className="admin-commit-report-home-link">
                  홈
                </Link>
                <button
                  type="button"
                  className="admin-commit-report-nav-button"
                  onClick={() => router.back()}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="admin-commit-report-theme-btn admin-commit-report-theme-btn-compact"
                  onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                >
                  테마
                </button>
              </div>
            </div>

            <div className="admin-commit-report-top-main">
              <input
                className="admin-commit-report-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="검색어: 커밋명, 제목, 리뷰"
              />
            </div>

            <div className="admin-commit-report-date-filters">
              <select
                className="admin-commit-report-select admin-commit-report-select-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}년
                  </option>
                ))}
              </select>

              <select
                className="admin-commit-report-select admin-commit-report-select-month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={String(month)}>
                    {month}월
                  </option>
                ))}
              </select>

              <select
                className="admin-commit-report-select admin-commit-report-select-day"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
              >
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={String(day)}>
                    {day}일
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-commit-report-list-head">
            <h1>작업 목록</h1>
            <span>{loading ? "로딩..." : `${filteredItems.length}건`}</span>
          </div>

          {loadError ? <p className="admin-commit-report-empty">{loadError}</p> : null}

          {!loadError && filteredItems.length === 0 ? (
            <p className="admin-commit-report-empty">
              {loading ? "작업 이력을 불러오는 중입니다." : "등록된 작업 이력이 없습니다."}
            </p>
          ) : (
            <ul className="admin-commit-report-rows">
              {filteredItems.map((item) => {
                const expanded = item.id === openId;
                return (
                  <li key={item.id} className="admin-commit-report-row">
                    <button
                      type="button"
                      className={`admin-commit-report-row-trigger${expanded ? " active" : ""}`}
                      onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                      aria-expanded={expanded}
                      aria-controls={`report-panel-${item.id}`}
                    >
                      <span className="admin-commit-report-row-main">
                        <span className="admin-commit-report-row-commit">{item.displayTime}</span>
                        <span className="admin-commit-report-row-divider">/</span>
                        <span className="admin-commit-report-row-title">{item.heading}</span>
                        <span className="admin-commit-report-row-divider">/</span>
                        <span className="admin-commit-report-row-model">{item.aiAgent}</span>
                      </span>
                      <span className="admin-commit-report-row-icon" aria-hidden="true">
                        {expanded ? "−" : "+"}
                      </span>
                    </button>

                    {expanded ? (
                      <div id={`report-panel-${item.id}`} className="admin-commit-report-row-body">
                        <div className="admin-commit-report-title-row">
                          <h2>{item.heading}</h2>
                          <div className="admin-commit-report-title-actions">
                            <span className="admin-commit-report-datetime">{item.displayDateTime}</span>
                            <button
                              type="button"
                              className="admin-commit-report-detail-btn"
                              onClick={() => setDetailItemId(item.id)}
                            >
                              상세보기
                            </button>
                            <button
                              type="button"
                              className="admin-commit-report-detail-btn admin-commit-report-delete-btn"
                              onClick={() => void handleDeleteItem(item)}
                              disabled={deletingItemId === item.id}
                            >
                              {deletingItemId === item.id ? "삭제중..." : "삭제"}
                            </button>
                          </div>
                        </div>
                        <p className="admin-commit-report-meta">작업 AI: {item.aiAgent}</p>
                        {item.meta ? <p className="admin-commit-report-meta">{item.meta}</p> : null}
                        {item.sections.map((section) => (
                          <div key={`${item.id}-${section.title}`}>
                            <p className="admin-commit-report-section-title">{section.title}</p>
                            {section.title === "상세 리뷰" ? (
                              <div className="admin-commit-report-paragraphs">
                                {textToParagraphs(section.bullets.join("\n")).map((paragraph, index) => (
                                  <p key={`${item.id}-${section.title}-${index}`} className="admin-commit-report-paragraph">
                                    {paragraph}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <ul>
                                {section.bullets.map((bullet) => (
                                  <li key={bullet}>{bullet}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="admin-commit-report-screen admin-commit-report-screen-detail">
          {detailItem ? (
            <section className="admin-commit-report-detail-view">
              <button
                type="button"
                className="admin-commit-report-back-btn"
                onClick={() => setDetailItemId(null)}
                aria-label="작업 리스트로 돌아가기"
              >
                ← 돌아가기
              </button>

              <div className="admin-commit-report-detail-content">
                <h2>{detailItem.heading}</h2>
                <p className="admin-commit-report-meta">{detailItem.displayDateTime}</p>
                <p className="admin-commit-report-section-title">원본 리뷰</p>
                <div className="admin-commit-report-original-text">
                  {detailItemOriginalParagraphs.length > 0
                    ? detailItemOriginalParagraphs.map((paragraph, index) => (
                        <p key={`${detailItem.id}-original-${index}`} className="admin-commit-report-paragraph">
                          {paragraph}
                        </p>
                      ))
                    : (
                      <p className="admin-commit-report-paragraph">{detailItem.originalReview}</p>
                    )}
                </div>
              </div>
            </section>
          ) : (
            <div className="admin-commit-report-detail-placeholder" />
          )}
        </div>
      </div>
    </div>
  );
}
