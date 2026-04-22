import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export type Inquiry = {
  id: string;
  profile_id: string;
  type: "consulting" | "general";
  title: string;
  content: string;
  status: "pending" | "in_progress" | "resolved";
  has_unread_reply: boolean;
  created_at: string;
  updated_at: string;
};

export type InquiryWithProfile = Inquiry & {
  profile: { email: string; full_name: string | null; icon_image: string | null };
};

export type InquiryReply = {
  id: string;
  inquiry_id: string;
  author_role: "customer" | "admin";
  content: string;
  created_at: string;
};

export type InquiryWithReplies = Inquiry & {
  replies: InquiryReply[];
};

// 사용자 문의 목록 조회 + 자동 읽음처리
export async function getInquiriesByProfile(
  profileId: string,
  type?: "consulting" | "general",
  page: number = 1,
  limit: number = 10
) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("inquiries")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const offset = (page - 1) * limit;
  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("getInquiriesByProfile error:", error);
    return { inquiries: [], total: 0 };
  }

  // 읽음 처리: has_unread_reply=true인 모든 항목을 false로 업데이트
  if (data && data.length > 0) {
    const unreadIds = data
      .filter((item) => item.has_unread_reply)
      .map((item) => item.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("inquiries")
        .update({ has_unread_reply: false })
        .in("id", unreadIds);
    }
  }

  return {
    inquiries: (data ?? []) as Inquiry[],
    total: count ?? 0,
  };
}

// 특정 문의 상세 조회 + 답변 목록 + 읽음처리
export async function getInquiryById(id: string) {
  const supabase = createSupabaseAdminClient();

  const [inquiryRes, repliesRes] = await Promise.all([
    supabase.from("inquiries").select("*").eq("id", id).single(),
    supabase
      .from("inquiry_replies")
      .select("*")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (inquiryRes.error) {
    console.error("getInquiryById error:", inquiryRes.error);
    return null;
  }

  const inquiry = inquiryRes.data as Inquiry;
  const replies = (repliesRes.data ?? []) as InquiryReply[];

  // 읽음 처리
  if (inquiry.has_unread_reply) {
    await supabase
      .from("inquiries")
      .update({ has_unread_reply: false })
      .eq("id", id);
  }

  return { inquiry, replies };
}

// 새 문의 생성
export async function createInquiry(
  profileId: string,
  type: "consulting" | "general",
  title: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      profile_id: profileId,
      type,
      title,
      content,
      status: "pending",
      has_unread_reply: false,
    })
    .select()
    .single();

  if (error) {
    console.error("createInquiry error:", error);
    return null;
  }

  return data as Inquiry;
}

// 미읽은 알림 카운트
export async function getUnreadInquiryCount(profileId: string) {
  const supabase = createSupabaseAdminClient();

  const { count, error } = await supabase
    .from("inquiries")
    .select("*", { count: "exact" })
    .eq("profile_id", profileId)
    .eq("has_unread_reply", true);

  if (error) {
    console.error("getUnreadInquiryCount error:", error);
    return 0;
  }

  return count ?? 0;
}


// 관리자: 전체 문의 목록 조회
export async function getAllInquiries(
  type?: "consulting" | "general",
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("inquiries")
    .select("*, profile:profile_id(email, full_name, icon_image)")
    .order("updated_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  if (status === "unread") {
    query = query.eq("has_unread_reply", true);
  } else if (status) {
    query = query.eq("status", status);
  }

  const offset = (page - 1) * limit;
  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("getAllInquiries error:", error);
    return { inquiries: [], total: 0 };
  }

  return {
    inquiries: (data ?? []) as InquiryWithProfile[],
    total: count ?? 0,
  };
}

// 관리자: 문의 상세 조회 + 답변 목록
export async function getInquiryByIdAdmin(id: string) {
  const supabase = createSupabaseAdminClient();

  const [inquiryRes, repliesRes] = await Promise.all([
    supabase
      .from("inquiries")
      .select("*, profile:profile_id(email, full_name, icon_image)")
      .eq("id", id)
      .single(),
    supabase
      .from("inquiry_replies")
      .select("*")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (inquiryRes.error) {
    console.error("getInquiryByIdAdmin error:", inquiryRes.error);
    return null;
  }

  let inquiry = inquiryRes.data as InquiryWithProfile;
  const replies = (repliesRes.data ?? []) as InquiryReply[];
  const hasAdminReply = replies.some((reply) => reply.author_role === "admin");

  // 관리자 열람 시: 접수완료 + 관리자 답변 없음 상태는 자동으로 답변중 처리
  if (inquiry.status === "pending" && !hasAdminReply) {
    const { data: updatedInquiry } = await supabase
      .from("inquiries")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*, profile:profile_id(email, full_name, icon_image)")
      .single();

    if (updatedInquiry) {
      inquiry = updatedInquiry as InquiryWithProfile;
    } else {
      inquiry = { ...inquiry, status: "in_progress" };
    }
  }

  return {
    inquiry,
    replies,
  };
}

// 관리자: 답변 작성
export async function createReply(
  inquiryId: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();

  const [replyRes] = await Promise.all([
    supabase
      .from("inquiry_replies")
      .insert({
        inquiry_id: inquiryId,
        author_role: "admin",
        content,
      })
      .select()
      .single(),
    supabase
      .from("inquiries")
      .update({
        has_unread_reply: true,
        status: "resolved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId),
  ]);

  if (replyRes.error) {
    console.error("createReply error:", replyRes.error);
    return null;
  }

  return replyRes.data as InquiryReply;
}

// 관리자: 기존 답변 수정
export async function updateReplyByAdmin(
  inquiryId: string,
  replyId: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("inquiry_replies")
    .update({ content })
    .eq("id", replyId)
    .eq("inquiry_id", inquiryId)
    .eq("author_role", "admin")
    .select()
    .single();

  if (error) {
    console.error("updateReplyByAdmin error:", error);
    return null;
  }

  await supabase
    .from("inquiries")
    .update({
      has_unread_reply: true,
      status: "resolved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  return data as InquiryReply;
}

// 관리자: 기존 답변 삭제
export async function deleteReplyByAdmin(
  inquiryId: string,
  replyId: string
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("inquiry_replies")
    .delete()
    .eq("id", replyId)
    .eq("inquiry_id", inquiryId)
    .eq("author_role", "admin");

  if (error) {
    console.error("deleteReplyByAdmin error:", error);
    return false;
  }

  const { count: adminReplyCount, error: countError } = await supabase
    .from("inquiry_replies")
    .select("id", { count: "exact", head: true })
    .eq("inquiry_id", inquiryId)
    .eq("author_role", "admin");

  if (countError) {
    console.error("deleteReplyByAdmin count error:", countError);
    return false;
  }

  const updatePayload: { updated_at: string; has_unread_reply?: boolean } = {
    updated_at: new Date().toISOString(),
  };

  // 관리자 답글이 하나도 없으면 '읽지않음' 배지를 강제로 내린다.
  if ((adminReplyCount ?? 0) === 0) {
    updatePayload.has_unread_reply = false;
  }

  await supabase
    .from("inquiries")
    .update(updatePayload)
    .eq("id", inquiryId);

  return true;
}

// 사용자: 본인 문의 수정
export async function updateInquiry(
  id: string,
  title: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const [{ data: inquiryMeta, error: inquiryMetaError }, { count: adminReplyCount, error: replyCountError }] =
    await Promise.all([
      supabase
        .from("inquiries")
        .select("status")
        .eq("id", id)
        .single<{ status: Inquiry["status"] }>(),
      supabase
        .from("inquiry_replies")
        .select("id", { count: "exact", head: true })
        .eq("inquiry_id", id)
        .eq("author_role", "admin"),
    ]);

  if (inquiryMetaError) {
    console.error("updateInquiry inquiryMeta error:", inquiryMetaError);
    return null;
  }

  if (replyCountError) {
    console.error("updateInquiry replyCount error:", replyCountError);
    return null;
  }

  const hasAdminReply = (adminReplyCount ?? 0) > 0;
  const nextStatus: Inquiry["status"] = hasAdminReply
    ? "in_progress"
    : (inquiryMeta?.status ?? "pending");

  const { data, error } = await supabase
    .from("inquiries")
    .update({
      title,
      content,
      status: nextStatus,
      has_unread_reply: false,
      updated_at: nowIso,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateInquiry error:", error);
    return null;
  }

  return data as Inquiry;
}

// 사용자: 답변완료 문의에 추가문의 등록
export async function createFollowupInquiryByCustomer(
  id: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const [replyRes, inquiryRes] = await Promise.all([
    supabase
      .from("inquiry_replies")
      .insert({
        inquiry_id: id,
        author_role: "customer",
        content,
      })
      .select()
      .single(),
    supabase
      .from("inquiries")
      .update({
        status: "in_progress",
        has_unread_reply: false,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select()
      .single(),
  ]);

  if (replyRes.error) {
    console.error("createFollowupInquiryByCustomer reply error:", replyRes.error);
    return null;
  }

  if (inquiryRes.error) {
    console.error("createFollowupInquiryByCustomer inquiry error:", inquiryRes.error);
    return null;
  }

  return {
    reply: replyRes.data as InquiryReply,
    inquiry: inquiryRes.data as Inquiry,
  };
}

// 사용자: 본인 문의 삭제
export async function deleteInquiry(id: string) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("inquiries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteInquiry error:", error);
    return false;
  }

  return true;
}

// 관리자: 상태 변경
export async function updateInquiryStatus(
  id: string,
  status: "pending" | "in_progress" | "resolved"
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("inquiries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateInquiryStatus error:", error);
    return null;
  }

  const inquiry = data as Inquiry;

  // 상태가 resolved로 변경되면 알림 생성
  if (status === "resolved") {
    await createNotification(
      inquiry.profile_id,
      "consulting",
      "고객님이 작성한 글에 답변이 완료되었습니다",
      "/account/consulting",
      inquiry.id
    );
  }

  return inquiry;
}
