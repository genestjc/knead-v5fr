import Link from "next/link";

export function AdminSidebar() {
  return (
    <nav
      style={{
        padding: 24,
        borderRight: "1px solid #eee",
        minHeight: "100vh",
      }}
    >
      <h2 style={{ fontFamily: "Adonis, serif" }}>
        Admin Panel
      </h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li>
          <Link href="/admin/create-space">
            Create Space
          </Link>
        </li>
        <li>
          <Link href="/admin/spaces">Manage Spaces</Link>
        </li>
        <li>
          <Link href="/admin/users">Manage Users</Link>
        </li>
        <li>
          <Link href="/admin/moderation">Moderation</Link>
        </li>
        <li>
          <Link href="/admin/treasury">Treasury</Link>
        </li>
        <li>
          <Link href="/admin/open-periods">
            Open Periods
          </Link>
        </li>
      </ul>
    </nav>
  );
}
