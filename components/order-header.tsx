"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

type ColorOrderHeaderProps = {
  onBack?: () => void;
};

export function ColorOrderHeader({ onBack }: ColorOrderHeaderProps) {
  const router = useRouter();

  return (
    <header className="color-order-header">
      <div className="color-order-header-inner">
        <button
          type="button"
          className="color-order-header-back"
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            router.back();
          }}
          aria-label="뒤로가기"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <Link href="/" className="color-order-header-logo">
          <Image src="/logo.svg" alt="ARAO" width={72} height={26} priority />
        </Link>
        <button type="button" className="color-order-header-cart" aria-label="장바구니">
          <ShoppingCart size={20} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
