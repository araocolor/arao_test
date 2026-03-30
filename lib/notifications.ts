import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationItem = {
  id: string;
  type: "settings" | "order_shipped" | "order_cancelled" | "consulting" | "review_reply" | "gallery_like";
  title: string;
  link: string;
  source_id?: string;
  is_read: boolean;
  created_at: string;
  sender_icon?: string | null;
};

/**
 * 모든 알림 소스에서 집계 (settings, consulting, notifications 테이블)
 * 반환: 합쳐진 items (최신순) + unreadCount
 */
export async function getNotificationsForProfile(
  profileId: string,
  profile: { username: string | null; password_hash: string | null; phone: string | null }
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const supabase = createSupabaseAdminClient();
  const items: NotificationItem[] = [];
  let unreadCount = 0;

  // 1. settings 알림: username 또는 password_hash가 없을 때 표시 (항상 맨 위)
  if (!profile.username || !profile.password_hash) {
    items.push({
      id: "settings-notif",
      type: "settings",
      title: "사용자 아이디와 비밀번호를 등록하세요",
      link: "/account/general",
      is_read: false,
      created_at: new Date().toISOString(),
    });
    unreadCount++;
  }

  // 2. notifications 테이블에서 알림 조회 (consulting 제외 — inquiries 쿼리에서 별도 처리)
  const { data: dbNotifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .neq("type", "consulting")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getNotificationsForProfile db notifications error:", error);
  } else if (dbNotifications) {
    // 알림 제목에서 발신자 이름(username/email) 추출 후 프로필 아이콘 조회
    const senderNames = new Set<string>();
    for (const n of dbNotifications) {
      const idx = n.title.indexOf("님이");
      if (idx > 0) {
        const name = n.title.slice(0, idx);
        if (name !== "고객" && name !== "사용자" && name !== "누군가") {
          senderNames.add(name);
        }
      }
    }

    const senderIconMap: Record<string, string | null> = {};
    if (senderNames.size > 0) {
      const names = Array.from(senderNames);
      const orFilter = names.map((n) => `username.eq.${n},email.eq.${n}`).join(",");
      const { data: senderProfiles } = await supabase
        .from("profiles")
        .select("username, email, icon_image")
        .or(orFilter);
      for (const p of senderProfiles ?? []) {
        if (p.username) senderIconMap[p.username] = p.icon_image ?? null;
        if (p.email) senderIconMap[p.email] = p.icon_image ?? null;
      }
    }

    items.push(
      ...dbNotifications.map((n) => {
        const idx = n.title.indexOf("님이");
        const senderName = idx > 0 ? n.title.slice(0, idx) : null;
        const senderIcon = senderName ? (senderIconMap[senderName] ?? null) : null;
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          link: n.link,
          source_id: n.source_id,
          is_read: n.is_read,
          created_at: n.created_at,
          sender_icon: senderIcon,
        };
      })
    );
    unreadCount += dbNotifications.filter((n) => !n.is_read).length;
  }

  // 3. consulting 알림: 답변이 있는 모든 inquiries (읽음 여부 포함)
  const { data: inquiries, error: inquiriesError } = await supabase
    .from("inquiries")
    .select("id, type, title, status, has_unread_reply, updated_at")
    .eq("profile_id", profileId)
    .in("status", ["in_progress", "resolved", "closed"])
    .order("updated_at", { ascending: false });

  if (inquiriesError) {
    console.error("getNotificationsForProfile consulting error:", inquiriesError);
  } else if (inquiries) {
    items.push(
      ...inquiries.map((inq) => ({
        id: `consulting-${inq.id}`,
        type: "consulting" as const,
        title: "고객님이 작성한 글에 답변이 완료되었습니다",
        link: "/account/consulting",
        source_id: inq.id,
        is_read: !inq.has_unread_reply,
        created_at: inq.updated_at,
      }))
    );
    unreadCount += inquiries.filter((inq) => inq.has_unread_reply).length;
  }

  // items를 created_at 기준으로 정렬 (settings는 이미 맨 위)
  items.sort((a, b) => {
    if (a.type === "settings") return -1;
    if (b.type === "settings") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { items, unreadCount };
}

/**
 * notifications 테이블에 알림 생성 (중복 체크)
 * source_id + type이 이미 있으면 생성하지 않음
 */
export async function createNotification(
  profileId: string,
  type: string,
  title: string,
  link: string,
  sourceId?: string,
  senderIcon?: string | null
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // 중복 체크 (source_id + type)
  if (sourceId) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("profile_id", profileId)
      .eq("type", type)
      .eq("source_id", sourceId);

    if (count && count > 0) {
      return; // 이미 존재하면 생성 안 함
    }
  }

  const { error } = await supabase.from("notifications").insert({
    profile_id: profileId,
    type,
    title,
    link,
    source_id: sourceId,
    is_read: false,
    sender_icon: senderIcon ?? null,
  });

  if (error) {
    console.error("createNotification error:", error);
  }
}

/**
 * 알림을 읽음 처리
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("markNotificationRead error:", error);
  }
}
