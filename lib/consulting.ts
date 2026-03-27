import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Inquiry = {
  id: string;
  profile_id: string;
  type: "consulting" | "general";
  title: string;
  content: string;
  status: "pending" | "in_progress" | "resolved" | "closed";
  has_unread_reply: boolean;
  created_at: string;
  updated_at: string;
};

export type InquiryWithProfile = Inquiry & {
  profile: { email: string; full_name: string | null };
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
    .select("*, profile:profile_id(email, full_name)")
    .order("updated_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  if (status) {
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
      .select("*, profile:profile_id(email, full_name)")
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

  return {
    inquiry: inquiryRes.data as InquiryWithProfile,
    replies: (repliesRes.data ?? []) as InquiryReply[],
  };
}

// 관리자: 답변 작성
export async function createReply(
  inquiryId: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();

  const [replyRes, updateRes] = await Promise.all([
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
        status: "in_progress",
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

// 사용자: 본인 문의 수정
export async function updateInquiry(
  id: string,
  title: string,
  content: string
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("inquiries")
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateInquiry error:", error);
    return null;
  }

  return data as Inquiry;
}

// 관리자: 상태 변경
export async function updateInquiryStatus(
  id: string,
  status: "pending" | "in_progress" | "resolved" | "closed"
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

  return data as Inquiry;
}
