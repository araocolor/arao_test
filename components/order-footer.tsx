"use client";

import { Heart } from "lucide-react";

type OrderFooterProps = {
  onWish?: () => void;
  onBuy?: () => void;
  isWished?: boolean;
  buyDisabled?: boolean;
  buyLabel?: string;
};

export function OrderFooter({ onWish, onBuy, isWished, buyDisabled, buyLabel = "구매하기" }: OrderFooterProps) {
  return (
    <footer className="order-footer">
      <div className="order-footer-inner">
        <button
          type="button"
          className={`order-footer-wish${isWished ? " is-wished" : ""}`}
          onClick={onWish}
          aria-label="찜"
        >
          <Heart size={22} strokeWidth={2} fill={isWished ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className="order-footer-buy"
          onClick={onBuy}
          disabled={buyDisabled}
        >
          {buyLabel}
        </button>
      </div>
    </footer>
  );
}
