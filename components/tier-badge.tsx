import { BadgeCheck } from "lucide-react";

type TierBadgeProps = {
  tier: string | null | undefined;
  size?: number;
  marginLeft?: number;
};

export function TierBadge({ tier, size = 14, marginLeft = 4 }: TierBadgeProps) {
  if (tier !== "pro" && tier !== "premium") return null;
  const fill = tier === "premium" ? "#D4AF37" : "#1D9BF0";
  return (
    <BadgeCheck
      width={size}
      height={size}
      strokeWidth={2}
      color="#fff"
      fill={fill}
      style={{ marginLeft, verticalAlign: "middle" }}
    />
  );
}
