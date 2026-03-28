import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationItem = {
  id: string;
  type: "settings" | "order_shipped" | "order_cancelled" | "consulting" | "review_reply" | "gallery_like";
  title: string;
  link: string;
  source_id?: string;
  is_read: boolean;
  created_at: string;
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

  // 1. settings 알림: username, password_hash, phone이 모두 없으면 표시 (항상 맨 위)
  if (!profile.username || !profile.password_hash || !profile.phone) {
    items.push({
      id: "settings-notif",
      type: "settings",
      title: "사용자 아이디, 비밀번호, 전화번호를 모두 등록하세요",
      link: "/account/general",
      is_read: false,
      created_at: new Date().toISOString(),
    });
    unreadCount++;
  }

  // 2. notifications 테이블에서 모든 알림 조회 (orders, reviews, gallery)
  const { data: dbNotifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getNotificationsForProfile db notifications error:", error);
  } else if (dbNotifications) {
    items.push(
      ...dbNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        link: n.link,
        source_id: n.source_id,
        is_read: n.is_read,
        created_at: n.created_at,
      }))
    );
    unreadCount += dbNotifications.filter((n) => !n.is_read).length;
  }

  // 3. consulting 알림: inquiries.has_unread_reply = true
  const { data: inquiries, error: inquiriesError } = await supabase
    .from("inquiries")
    .select("id, type, title, status, has_unread_reply, updated_at")
    .eq("profile_id", profileId)
    .eq("has_unread_reply", true)
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
        is_read: false,
        created_at: inq.updated_at,
      }))
    );
    unreadCount += inquiries.length;
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
  sourceId?: string
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
