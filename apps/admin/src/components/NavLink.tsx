"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavLink({ href, children, badge }: { href: string; children: React.ReactNode; badge?: number }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [path, query] = href.split("?");
  const active = path === "/" ? pathname === "/" : pathname.startsWith(path!) && (!query || search.toString() === query);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <span>{children}</span>
      {badge ? <span className="badge">{badge}</span> : null}
    </Link>
  );
}
