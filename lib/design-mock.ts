/**
 * 디자인 모드 더미 데이터
 * NEXT_PUBLIC_DESIGN_MODE=true일 때만 사용됨
 * Clerk 로그인/DB 없이 디자인 확인용
 */

import type { Order } from './orders';
import type { Inquiry } from './consulting';

export const isDesignMode = process.env.NEXT_PUBLIC_DESIGN_MODE === 'true';

export const mockOrders: Order[] = [
  {
    id: 'order-001',
    user_id: 'mock-user',
    status: '결제완료',
    total_amount: 250000,
    currency: 'KRW',
    payment_provider: '신한카드',
    created_at: '2026-03-20T14:30:00Z',
  },
  {
    id: 'order-002',
    user_id: 'mock-user',
    status: '환불완료',
    total_amount: 180000,
    currency: 'KRW',
    payment_provider: '삼성카드',
    created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'order-003',
    user_id: 'mock-user',
    status: '환불진행중',
    total_amount: 320000,
    currency: 'KRW',
    payment_provider: '네이버페이',
    created_at: '2026-03-10T09:00:00Z',
  },
];

export const mockInquiries: Inquiry[] = [
  {
    id: 'inq-001',
    profile_id: 'mock-user',
    type: 'consulting',
    title: 'ARAO 사용법이 궁금합니다',
    content: 'ARAO 소프트 버전을 구매했는데, 정확한 사용법이 궁금합니다. 특히 프리셋 설정 방법을 알려주세요.',
    status: 'in_progress',
    has_unread_reply: false,
    created_at: '2026-03-18',
    updated_at: '2026-03-18',
  },
  {
    id: 'inq-002',
    profile_id: 'mock-user',
    type: 'general',
    title: '환불 절차에 대해 문의합니다',
    content: '구매한 상품에 대한 환불 절차를 알고 싶습니다. 얼마나 소요되나요?',
    status: 'resolved',
    has_unread_reply: false,
    created_at: '2026-03-15',
    updated_at: '2026-03-16',
  },
];

export const mockGeneralProfile = {
  email: 'kimcheolsu@example.com',
  fullName: '김철수',
  username: 'kimcheolsu',
  hasPassword: true,
  phone: '01012345678',
};
