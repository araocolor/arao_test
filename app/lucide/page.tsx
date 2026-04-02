"use client";

import {
  Home, User, Settings, Search, Heart, Star, MessageSquare, Bell, ShoppingCart, ShoppingBag,
  Camera, Image, File, Share2, Pencil, Trash2, X, Menu, ChevronLeft, LogOut,
  ChevronRight, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, Plus, Minus, Check,
  AlertCircle, Info, HelpCircle, Eye, EyeOff, Lock, Unlock, Mail, Phone, MapPin,
  Calendar, Clock, Download, Upload, Link, ExternalLink, Bookmark, Tag, Filter,
  Grid, List, Layers, Play, Pause, Volume2, VolumeX, Mic, Video,
  Sun, Moon, Cloud, Zap, Flame, Globe, Car, Plane, Map, Flag, Trophy,
  Music, Headphones, Monitor, Smartphone, Laptop, Wifi,
  Package, Folder, FileText, Clipboard, Database, Server,
  Users, UserPlus, Shield, Key, CreditCard, Gift, Percent,
  BarChart, TrendingUp, Activity, RefreshCw, Loader, Power,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const icons: { Icon: LucideIcon; name: string; desc: string }[] = [
  { Icon: Home, name: "Home", desc: "홈" },
  { Icon: User, name: "User", desc: "사람/유저" },
  { Icon: Settings, name: "Settings", desc: "설정" },
  { Icon: Search, name: "Search", desc: "검색" },
  { Icon: Heart, name: "Heart", desc: "하트" },
  { Icon: Star, name: "Star", desc: "별" },
  { Icon: MessageSquare, name: "MessageSquare", desc: "채팅" },
  { Icon: Bell, name: "Bell", desc: "알림" },
  { Icon: ShoppingCart, name: "ShoppingCart", desc: "장바구니" },
  { Icon: ShoppingBag, name: "ShoppingBag", desc: "쇼핑백" },
  { Icon: Camera, name: "Camera", desc: "카메라" },
  { Icon: Image, name: "Image", desc: "이미지" },
  { Icon: File, name: "File", desc: "파일" },
  { Icon: Share2, name: "Share2", desc: "공유" },
  { Icon: Pencil, name: "Pencil", desc: "수정" },
  { Icon: Trash2, name: "Trash2", desc: "삭제" },
  { Icon: X, name: "X", desc: "닫기" },
  { Icon: Menu, name: "Menu", desc: "메뉴" },
  { Icon: ChevronLeft, name: "ChevronLeft", desc: "꺽쇠 좌" },
  { Icon: LogOut, name: "LogOut", desc: "로그아웃" },
  { Icon: ChevronRight, name: "ChevronRight", desc: "꺽쇠 우" },
  { Icon: ChevronUp, name: "ChevronUp", desc: "꺽쇠 위" },
  { Icon: ChevronDown, name: "ChevronDown", desc: "꺽쇠 아래" },
  { Icon: ArrowLeft, name: "ArrowLeft", desc: "화살표 좌" },
  { Icon: ArrowRight, name: "ArrowRight", desc: "화살표 우" },
  { Icon: Plus, name: "Plus", desc: "추가" },
  { Icon: Minus, name: "Minus", desc: "빼기" },
  { Icon: Check, name: "Check", desc: "체크" },
  { Icon: AlertCircle, name: "AlertCircle", desc: "경고" },
  { Icon: Info, name: "Info", desc: "정보" },
  { Icon: HelpCircle, name: "HelpCircle", desc: "도움말" },
  { Icon: Eye, name: "Eye", desc: "보기" },
  { Icon: EyeOff, name: "EyeOff", desc: "숨기기" },
  { Icon: Lock, name: "Lock", desc: "잠금" },
  { Icon: Unlock, name: "Unlock", desc: "잠금해제" },
  { Icon: Mail, name: "Mail", desc: "메일" },
  { Icon: Phone, name: "Phone", desc: "전화" },
  { Icon: MapPin, name: "MapPin", desc: "위치" },
  { Icon: Calendar, name: "Calendar", desc: "달력" },
  { Icon: Clock, name: "Clock", desc: "시계" },
  { Icon: Download, name: "Download", desc: "다운로드" },
  { Icon: Upload, name: "Upload", desc: "업로드" },
  { Icon: Link, name: "Link", desc: "링크" },
  { Icon: ExternalLink, name: "ExternalLink", desc: "외부링크" },
  { Icon: Bookmark, name: "Bookmark", desc: "북마크" },
  { Icon: Tag, name: "Tag", desc: "태그" },
  { Icon: Filter, name: "Filter", desc: "필터" },
  { Icon: Grid, name: "Grid", desc: "그리드" },
  { Icon: List, name: "List", desc: "리스트" },
  { Icon: Layers, name: "Layers", desc: "레이어" },
  { Icon: Play, name: "Play", desc: "재생" },
  { Icon: Pause, name: "Pause", desc: "일시정지" },
  { Icon: Volume2, name: "Volume2", desc: "소리" },
  { Icon: VolumeX, name: "VolumeX", desc: "음소거" },
  { Icon: Mic, name: "Mic", desc: "마이크" },
  { Icon: Video, name: "Video", desc: "비디오" },
  { Icon: Sun, name: "Sun", desc: "태양" },
  { Icon: Moon, name: "Moon", desc: "달" },
  { Icon: Cloud, name: "Cloud", desc: "구름" },
  { Icon: Zap, name: "Zap", desc: "번개" },
  { Icon: Flame, name: "Flame", desc: "불꽃" },
  { Icon: Globe, name: "Globe", desc: "지구" },
  { Icon: Car, name: "Car", desc: "자동차" },
  { Icon: Plane, name: "Plane", desc: "비행기" },
  { Icon: Map, name: "Map", desc: "지도" },
  { Icon: Flag, name: "Flag", desc: "깃발" },
  { Icon: Trophy, name: "Trophy", desc: "트로피" },
  { Icon: Music, name: "Music", desc: "음악" },
  { Icon: Headphones, name: "Headphones", desc: "헤드폰" },
  { Icon: Monitor, name: "Monitor", desc: "모니터" },
  { Icon: Smartphone, name: "Smartphone", desc: "스마트폰" },
  { Icon: Laptop, name: "Laptop", desc: "노트북" },
  { Icon: Wifi, name: "Wifi", desc: "와이파이" },
  { Icon: Package, name: "Package", desc: "패키지" },
  { Icon: Folder, name: "Folder", desc: "폴더" },
  { Icon: FileText, name: "FileText", desc: "문서" },
  { Icon: Clipboard, name: "Clipboard", desc: "클립보드" },
  { Icon: Database, name: "Database", desc: "데이터베이스" },
  { Icon: Server, name: "Server", desc: "서버" },
  { Icon: Users, name: "Users", desc: "여러사람" },
  { Icon: UserPlus, name: "UserPlus", desc: "사용자추가" },
  { Icon: Shield, name: "Shield", desc: "보안" },
  { Icon: Key, name: "Key", desc: "열쇠" },
  { Icon: CreditCard, name: "CreditCard", desc: "카드/결제" },
  { Icon: Gift, name: "Gift", desc: "선물" },
  { Icon: Percent, name: "Percent", desc: "할인" },
  { Icon: BarChart, name: "BarChart", desc: "막대그래프" },
  { Icon: TrendingUp, name: "TrendingUp", desc: "상승" },
  { Icon: Activity, name: "Activity", desc: "활동" },
  { Icon: RefreshCw, name: "RefreshCw", desc: "새로고침" },
  { Icon: Loader, name: "Loader", desc: "로딩" },
  { Icon: Power, name: "Power", desc: "전원" },
];

export default function LucidePage() {
  return (
    <main style={{ padding: "24px", maxWidth: "960px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "4px" }}>Lucide 아이콘 목록</h1>
      <p style={{ color: "#888", fontSize: "14px", marginBottom: "24px" }}>
        아이콘 이름을 그대로 요청하시면 됩니다.
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: "10px",
      }}>
        {icons.map(({ Icon, name, desc }) => (
          <div key={name} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            padding: "14px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            background: "#fafafa",
          }}>
            <Icon size={22} strokeWidth={1.7} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#111", textAlign: "center" }}>{desc}</span>
            <span style={{ fontSize: "9px", color: "#aaa", fontFamily: "monospace", textAlign: "center" }}>{name}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
