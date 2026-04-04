"use client";

import { useEffect, useMemo, useState } from "react";

type WorkLogStatus = "draft" | "done" | "rollback";

type WorkLog = {
  id: string;
  commit_hash: string;
  title: string;
  summary: string;
  details: string | null;
  status: WorkLogStatus;
  report_url: string | null;
  deployed_at: string | null;
  author_profile_id: string | null;
  author_name_snapshot: string;
  created_at: string;
  updated_at: string;
};

type WorkLogMemo = {
  id: string;
  work_log_id: string;
  memo: string;
  created_by_profile_id: string | null;
  created_by_name_snapshot: string;
  created_at: string;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export function AdminWorkLogsManager() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | WorkLogStatus>("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const [newCommitHash, setNewCommitHash] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedLog = useMemo(
    () => logs.find((item) => item.id === selectedId) ?? null,
    [logs, selectedId]
  );

  const [editCommitHash, setEditCommitHash] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editStatus, setEditStatus] = useState<WorkLogStatus>("done");
  const [editReportUrl, setEditReportUrl] = useState("");
  const [editDeployedAt, setEditDeployedAt] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  const [memos, setMemos] = useState<WorkLogMemo[]>([]);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  async function loadLogs(preferId?: string | null) {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "120");
      const response = await fetch(`/api/admin/work-logs?${params.toString()}`);
      const data = (await response.json()) as { items?: WorkLog[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "작업 이력을 불러오지 못했습니다.");

      const nextItems = Array.isArray(data.items) ? data.items : [];
      setLogs(nextItems);
      setSelectedId((prev) => {
        if (preferId && nextItems.some((item) => item.id === preferId)) return preferId;
        if (prev && nextItems.some((item) => item.id === prev)) return prev;
        return nextItems[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 이력 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function loadMemos(workLogId: string) {
    setLoadingMemos(true);
    try {
      const response = await fetch(`/api/admin/work-logs/${workLogId}/memos`);
      const data = (await response.json()) as { items?: WorkLogMemo[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "메모를 불러오지 못했습니다.");
      setMemos(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메모 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingMemos(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [statusFilter, query]);

  useEffect(() => {
    if (!selectedLog) return;
    setEditCommitHash(selectedLog.commit_hash);
    setEditTitle(selectedLog.title);
    setEditSummary(selectedLog.summary);
    setEditDetails(selectedLog.details ?? "");
    setEditStatus(selectedLog.status);
    setEditReportUrl(selectedLog.report_url ?? "");
    setEditDeployedAt(toLocalInputValue(selectedLog.deployed_at));
  }, [selectedLog?.id]);

  useEffect(() => {
    if (!selectedId) {
      setMemos([]);
      return;
    }
    void loadMemos(selectedId);
  }, [selectedId]);

  async function handleCreateLog() {
    const commitHash = newCommitHash.trim();
    const title = newTitle.trim();
    if (!commitHash || !title) {
      setMessage("커밋 해시와 제목을 입력해주세요.");
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/work-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitHash,
          title,
          summary: newSummary.trim(),
          status: "done",
        }),
      });
      const data = (await response.json()) as { item?: WorkLog; message?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.message ?? "작업 이력을 저장하지 못했습니다.");
      }

      setNewCommitHash("");
      setNewTitle("");
      setNewSummary("");
      setMessage("작업 이력을 저장했습니다.");
      await loadLogs(data.item.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 이력 저장 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveDetail() {
    if (!selectedLog) return;

    const commitHash = editCommitHash.trim();
    const title = editTitle.trim();
    if (!commitHash || !title) {
      setMessage("커밋 해시와 제목은 비워둘 수 없습니다.");
      return;
    }

    setSavingDetail(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/work-logs/${selectedLog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitHash,
          title,
          summary: editSummary,
          details: editDetails,
          status: editStatus,
          reportUrl: editReportUrl.trim() || null,
          deployedAt: fromLocalInputValue(editDeployedAt),
        }),
      });
      const data = (await response.json()) as { item?: WorkLog; message?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.message ?? "작업 이력을 수정하지 못했습니다.");
      }

      setMessage("작업 이력을 수정했습니다.");
      await loadLogs(data.item.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 이력 수정 중 오류가 발생했습니다.");
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleAddMemo() {
    if (!selectedLog) return;
    const memo = memoInput.trim();
    if (!memo) return;

    setSavingMemo(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/work-logs/${selectedLog.id}/memos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo }),
      });
      const data = (await response.json()) as { item?: WorkLogMemo; message?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.message ?? "메모를 저장하지 못했습니다.");
      }

      setMemoInput("");
      setMemos((prev) => [data.item as WorkLogMemo, ...prev]);
      setMessage("메모를 추가했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메모 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingMemo(false);
    }
  }

  return (
    <div className="admin-worklog-shell">
      <div className="admin-worklog-create-line">
        <input
          className="admin-input"
          value={newCommitHash}
          onChange={(event) => setNewCommitHash(event.target.value)}
          placeholder="커밋 해시"
        />
        <input
          className="admin-input"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="작업 제목"
        />
        <input
          className="admin-input"
          value={newSummary}
          onChange={(event) => setNewSummary(event.target.value)}
          placeholder="요약"
        />
        <button
          type="button"
          className="admin-save-button"
          onClick={handleCreateLog}
          disabled={creating}
        >
          {creating ? "저장 중..." : "작업 등록"}
        </button>
      </div>

      <div className="admin-worklog-filter-line">
        <select
          className="admin-input"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | WorkLogStatus)}
        >
          <option value="all">전체 상태</option>
          <option value="done">완료</option>
          <option value="draft">초안</option>
          <option value="rollback">롤백</option>
        </select>
        <input
          className="admin-input"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="검색어(커밋/제목/요약/작성자)"
          onKeyDown={(event) => {
            if (event.key === "Enter") setQuery(queryInput.trim());
          }}
        />
        <button type="button" className="admin-save-button" onClick={() => setQuery(queryInput.trim())}>
          검색
        </button>
        <button
          type="button"
          className="admin-save-button admin-save-button-disabled"
          onClick={() => {
            setQueryInput("");
            setQuery("");
          }}
        >
          초기화
        </button>
      </div>

      {message ? <p className="admin-worklog-message">{message}</p> : null}

      <div className="admin-worklog-grid">
        <aside className="admin-worklog-list">
          <div className="admin-worklog-list-head">
            <span>작업 목록</span>
            <span>{loadingLogs ? "로딩..." : `${logs.length}건`}</span>
          </div>
          <div className="admin-worklog-list-body">
            {logs.length === 0 ? (
              <p className="admin-worklog-empty">등록된 작업 이력이 없습니다.</p>
            ) : (
              logs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-worklog-item${item.id === selectedId ? " active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <p className="admin-worklog-item-title">{item.title}</p>
                  <p className="admin-worklog-item-meta">
                    <span>{item.commit_hash}</span>
                    <span>{item.status}</span>
                    <span>{item.author_name_snapshot || "-"}</span>
                  </p>
                  <p className="admin-worklog-item-time">{formatDate(item.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="admin-worklog-detail">
          {!selectedLog ? (
            <p className="admin-worklog-empty">좌측에서 작업을 선택해주세요.</p>
          ) : (
            <>
              <div className="admin-worklog-detail-line">
                <label>커밋 해시</label>
                <input
                  className="admin-input"
                  value={editCommitHash}
                  onChange={(event) => setEditCommitHash(event.target.value)}
                />
              </div>
              <div className="admin-worklog-detail-line">
                <label>제목</label>
                <input
                  className="admin-input"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </div>
              <div className="admin-worklog-detail-line">
                <label>상태</label>
                <select
                  className="admin-input"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as WorkLogStatus)}
                >
                  <option value="done">완료</option>
                  <option value="draft">초안</option>
                  <option value="rollback">롤백</option>
                </select>
              </div>
              <div className="admin-worklog-detail-line">
                <label>보고서 URL</label>
                <input
                  className="admin-input"
                  value={editReportUrl}
                  onChange={(event) => setEditReportUrl(event.target.value)}
                  placeholder="/my/work_List_withgpt.html"
                />
              </div>
              <div className="admin-worklog-detail-line">
                <label>배포 시각</label>
                <input
                  type="datetime-local"
                  className="admin-input"
                  value={editDeployedAt}
                  onChange={(event) => setEditDeployedAt(event.target.value)}
                />
              </div>
              <div className="admin-worklog-detail-line">
                <label>요약</label>
                <textarea
                  className="admin-textarea"
                  value={editSummary}
                  onChange={(event) => setEditSummary(event.target.value)}
                />
              </div>
              <div className="admin-worklog-detail-line">
                <label>상세</label>
                <textarea
                  className="admin-textarea"
                  value={editDetails}
                  onChange={(event) => setEditDetails(event.target.value)}
                />
              </div>

              <div className="admin-worklog-detail-meta-line">
                <span>작성자: {selectedLog.author_name_snapshot || "-"}</span>
                <span>생성: {formatDate(selectedLog.created_at)}</span>
                <span>수정: {formatDate(selectedLog.updated_at)}</span>
              </div>

              <div className="admin-worklog-detail-actions">
                <button
                  type="button"
                  className="admin-save-button"
                  onClick={handleSaveDetail}
                  disabled={savingDetail}
                >
                  {savingDetail ? "저장 중..." : "작업 저장"}
                </button>
              </div>

              <div className="admin-worklog-memo-head">
                <strong>메모</strong>
                <span>{loadingMemos ? "로딩..." : `${memos.length}개`}</span>
              </div>
              <div className="admin-worklog-memo-list">
                {memos.length === 0 ? (
                  <p className="admin-worklog-empty">메모가 없습니다.</p>
                ) : (
                  memos.map((memo) => (
                    <div key={memo.id} className="admin-worklog-memo-item">
                      <p>{memo.memo}</p>
                      <p className="admin-worklog-memo-meta">
                        <span>{memo.created_by_name_snapshot || "-"}</span>
                        <span>{formatDate(memo.created_at)}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="admin-worklog-memo-write">
                <textarea
                  className="admin-textarea"
                  value={memoInput}
                  onChange={(event) => setMemoInput(event.target.value)}
                  placeholder="간단 메모를 입력하세요."
                />
                <button
                  type="button"
                  className="admin-save-button"
                  onClick={handleAddMemo}
                  disabled={savingMemo}
                >
                  {savingMemo ? "저장 중..." : "메모 추가"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
