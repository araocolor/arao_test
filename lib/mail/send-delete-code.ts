import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendDeleteVerificationEmail(to: string, code: string) {
  if (!resend) {
    return { ok: false, message: "메일 서비스가 설정되지 않았습니다." };
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">회원탈퇴 인증번호</h2>
      <p style="color: #444; line-height: 1.6;">
        아래 6자리 인증번호를 입력하시면 회원탈퇴가 진행됩니다.<br>
        본인이 신청하지 않으셨다면 이 메일은 무시해주세요.
      </p>
      <div style="margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
      </div>
      <p style="color: #888; font-size: 13px;">
        이 인증번호는 10분간 유효합니다.
      </p>
    </div>
  `;

  const result = await resend.emails.send({
    from: fromEmail,
    to,
    subject: "[ARAO] 회원탈퇴 인증번호",
    html,
  });

  if (result.error) {
    return { ok: false, message: result.error.message };
  }

  return { ok: true };
}
