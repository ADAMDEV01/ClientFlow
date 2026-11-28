"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "Overview" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/clients", label: "Clients" },
  { href: "/app/team", label: "Team" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
];

export function TeamNavigation() {
  const pathname = usePathname();

  return (
    <div aria-label="Team navigation" className="flex flex-wrap items-center gap-1">
      {links.map((link) => {
        const active =
          link.href === "/app"
            ? pathname === "/app"
            : pathname === link.href || pathname.startsWith(link.href + "/");

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-lg border-b-2 px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm " +
              (active
                ? "border-indigo-600 bg-indigo-50/80 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
