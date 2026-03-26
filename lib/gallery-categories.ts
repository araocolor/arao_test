export const GALLERY_CATEGORIES = [
  "people", "outdoor", "indoor", "cafe",
  "summer", "fall", "winter", "spring",
  "food", "street", "life",
] as const;
export type GalleryCategory = typeof GALLERY_CATEGORIES[number];

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  people: "인물",
  outdoor: "환경야외",
  indoor: "실내",
  cafe: "카페",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
  spring: "봄",
  food: "음식",
  street: "거리",
  life: "일상",
};

export const GALLERY_CATEGORY_DEFAULTS: Record<GalleryCategory, string> = {
  people: "빛이 얼굴에 닿는 순간, 사람은 가장 솔직해진다.\n색이 정돈되면 그 감정도 선명하게 남는다.",
  outdoor: "공기의 온도가 느껴지는 색감으로, 그 자리의 시간을 붙잡는다.\n자연광 아래서만 보이는 결을 그대로 살려냈다.",
  indoor: "창가의 빛과 따뜻한 공기가 사진 속에 조용히 스며든다.\n공간이 가진 분위기를 색으로 다시 한번 정리했다.",
  cafe: "커피 한 잔의 온도가 사진에도 머문다.\n일상의 작은 자리를 조금 더 오래 기억하게 만든다.",
  summer: "강렬한 빛 속에서도 색은 흐트러지지 않는다.\n뜨거운 공기와 선명한 그림자가 한 장에 담긴다.",
  fall: "바래지는 것들 사이에서 색은 오히려 깊어진다.\n가을의 끝자락을 붙잡듯, 한 톤 낮게 가라앉힌다.",
  winter: "차가운 공기가 경계를 더 선명하게 만든다.\n빛이 적은 계절일수록 색의 무게가 달라진다.",
  spring: "연하고 흐릿한 것들이 차츰 제 색을 찾아간다.\n봄의 첫 빛은 항상 예상보다 조금 더 따뜻하다.",
  food: "먹기 전에 눈이 먼저 기억하는 색이 있다.\n온도와 질감이 느껴지는 톤으로 정직하게 담는다.",
  street: "지나치는 것들 속에 남는 것은 결국 색이다.\n도시의 빛과 그늘이 만드는 결을 그대로 살린다.",
  life: "특별하지 않은 순간일수록 색은 더 오래 남는다.\n일상의 온도를 있는 그대로, 조용히 붙잡는다.",
};
