# Arao — 프로젝트 문서

## 앱 이식 시 체크리스트

### 아이콘 라이브러리 교체
- 현재 웹에서는 `lucide-react` 사용 중
- 앱 이식 시 **`@phosphor-icons/react-native`** 로 교체 권장
  - 이유: Phosphor는 React Native 공식 지원, 웹과 동일한 아이콘 이름 사용 가능
  - 현재 사용 중인 아이콘: `User`, `MessageSquare`, `ShoppingBag`, `Sun`, `LogOut` (5개)
  - 교체 방법: import 경로만 변경하면 됨 (`lucide-react` → `@phosphor-icons/react-native`)
