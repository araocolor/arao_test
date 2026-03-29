import Image from "next/image";
import Link from "next/link";

export function SimpleHeader() {
  return (
    <div className="header header-full">
      <div className="simple-header-inner">
        <Link href="/" className="simple-header-logo">
          <Image src="/logo.svg" alt="ARAO logo" width={80} height={28} priority />
        </Link>
      </div>
    </div>
  );
}
