#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();

function loadEnvFile(fileName) {
  const filePath = path.join(cwd, fileName);
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function git(command) {
  return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function firstLine(input) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function parseCommitTitle(title) {
  const match = title.match(/^([a-zA-Z]+)(\(([^)]+)\))?:\s*(.+)$/);
  if (!match) {
    return {
      type: "general",
      scope: "",
      subject: title.trim(),
    };
  }
  return {
    type: match[1].toLowerCase(),
    scope: (match[3] || "").trim(),
    subject: (match[4] || title).trim(),
  };
}

function typeToKorean(type) {
  if (type === "feat") return "기능 추가";
  if (type === "fix") return "오류 수정";
  if (type === "perf") return "성능 개선";
  if (type === "refactor") return "구조 개선";
  if (type === "docs") return "문서 정리";
  if (type === "test") return "테스트 보강";
  if (type === "chore") return "운영 작업";
  return "변경 작업";
}

function compactFiles(files, maxCount = 6) {
  if (files.length <= maxCount) return files;
  return [...files.slice(0, maxCount), `외 ${files.length - maxCount}개 파일`];
}

function generateKoreanSummaryAndDetails({ title, files, gitBody }) {
  const parsed = parseCommitTitle(title);
  const typeLabel = typeToKorean(parsed.type);
  const scopeLabel = parsed.scope ? `${parsed.scope} 영역` : "대상 영역";
  const summary = `${scopeLabel}의 ${typeLabel} 작업을 반영했습니다.`;

  const fileList = compactFiles(files)
    .map((file) => `- ${file}`)
    .join("\n");

  const bodyLines = gitBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");

  const detailsLines = [
    `적용 커밋: ${title}`,
    `작업 분류: ${typeLabel}`,
    bodyLines ? `커밋 본문 요약:\n${bodyLines}` : "",
    fileList ? `주요 변경 파일:\n${fileList}` : "",
    "결과: 보고서 페이지에서 변경사항을 확인할 수 있도록 반영했습니다.",
  ].filter(Boolean);

  return {
    summary,
    details: detailsLines.join("\n"),
  };
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const args = parseArgs(process.argv);
  if (args.help === "true") {
    console.log("Usage:");
    console.log(
      "  npm run report:push -- [--commit HEAD] [--title \"...\"] [--summary \"...\"] [--details \"...\"] [--original \"...\"] [--status done] [--model \"GPT-5 Codex\"] [--report-url \"/admin/work-list\"] [--dry-run]"
    );
    process.exit(0);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  }

  const commitRef = args.commit || "HEAD";
  const commitHash = args.hash || git(`git rev-parse --short=12 ${commitRef}`);
  const gitTitle = git(`git log -1 --pretty=%s ${commitRef}`);
  const gitBody = git(`git log -1 --pretty=%b ${commitRef}`);
  const commitDate = git(`git log -1 --pretty=%cI ${commitRef}`);
  const changedFilesRaw = git(`git show --name-only --pretty=format: ${commitRef}`);
  const changedFiles = changedFilesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const title = (args.title || gitTitle || "").trim();
  if (!title) {
    throw new Error("title을 결정할 수 없습니다. --title 옵션을 지정하세요.");
  }

  const generated = generateKoreanSummaryAndDetails({
    title: gitTitle,
    files: changedFiles,
    gitBody,
  });

  const summary = (args.summary || generated.summary || firstLine(gitBody) || gitTitle).trim();
  const details = (args.details || generated.details || gitBody || "").trim();
  const originalReview = (args.original || details || summary).trim();
  const status = args.status || "done";
  const model = (args.model || "GPT-5 Codex").trim();
  const reportUrl = (args["report-url"] || "/admin/work-list").trim();
  const deployedAt = (args["deployed-at"] || commitDate || new Date().toISOString()).trim();

  if (!["draft", "done", "rollback"].includes(status)) {
    throw new Error("status는 draft | done | rollback 중 하나여야 합니다.");
  }

  const payload = {
    commit_hash: commitHash,
    title,
    summary,
    details: details || null,
    original_review: originalReview || null,
    status,
    report_url: reportUrl || null,
    deployed_at: deployedAt || null,
    author_profile_id: null,
    author_name_snapshot: model || "GPT-5 Codex",
    updated_at: new Date().toISOString(),
  };

  if (args["dry-run"] === "true") {
    console.log("[report:push] dry-run payload");
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("work_logs")
    .upsert(payload, { onConflict: "commit_hash", ignoreDuplicates: false })
    .select("id, commit_hash, title, status, author_name_snapshot, updated_at")
    .single();

  if (error) {
    throw new Error(`work_logs upsert 실패: ${error.message}`);
  }

  console.log("[report:push] 완료");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("[report:push] 실패");
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (
    message.includes("Could not find the table 'public.work_logs'") ||
    message.includes("relation \"work_logs\" does not exist")
  ) {
    console.error(
      "안내: Supabase SQL Editor에서 supabase/schema.sql의 work_logs/work_log_memos 생성 쿼리를 먼저 실행하세요."
    );
  }
  process.exit(1);
});
