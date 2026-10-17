import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, BadgeCheck, Box,
  ChevronRight, CircleHelp, Clock3, CreditCard, Gauge, Home, Info, Layers3,
  Link2, MessageSquareText, Monitor, PackageCheck, Search,
  Settings2, ShoppingBag, Store, Users,
} from "lucide-react";
import { demoActivity, demoCounts, demoOrders, formatRupiah, type DemoOrder, type OrderStatus } from "./data/demo-fixtures";

const navigation = [
  { label: "Overview", entries: [
    { href: "/", title: "Dashboard", icon: Gauge },
    { href: "/orders", title: "Pesanan", icon: ShoppingBag },
    { href: "/chat", title: "Percakapan", icon: MessageSquareText },
  ]},
  { label: "Workspace", entries: [
    { href: "/stores", title: "Toko", icon: Store },
    { href: "/sellers", title: "Seller", icon: Layers3 },
    { href: "/users", title: "Pengguna", icon: Users },
  ]},
  { label: "Pengaturan", entries: [
    { href: "/integrations", title: "Integrasi", icon: Link2 },
    { href: "/settings", title: "Preferensi", icon: Settings2 },
    { href: "/profile", title: "Profil", icon: CircleHelp },
  ]},
];
const mobileItems = [
  { href: "/", title: "Beranda", icon: Home },
  { href: "/orders", title: "Pesanan", icon: ShoppingBag },
  { href: "/chat", title: "Chat", icon: MessageSquareText },
  { href: "/stores", title: "Toko", icon: Store },
  { href: "/sellers", title: "Seller", icon: Users },
  { href: "/users", title: "Pengguna", icon: Users },
  { href: "/integrations", title: "Integrasi", icon: Link2 },
  { href: "/settings", title: "Preferensi", icon: Settings2 },
  { href: "/profile", title: "Profil", icon: CircleHelp },
];
const pageNames: Record<string, string> = {
  "/": "Dashboard", "/orders": "Pesanan", "/chat": "Percakapan", "/stores": "Toko",
  "/sellers": "Seller", "/users": "Pengguna", "/integrations": "Integrasi",
  "/settings": "Preferensi", "/profile": "Profil",
};

function Brand() {
  return <div className="brand" aria-label="ZETAS workspace"><span className="brand-mark"><Layers3 size={18} strokeWidth={2.1} /></span><div><div className="brand-name">zetas</div><div className="brand-sub">order workspace</div></div></div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const active = location.startsWith("/orders/") ? "/orders" : location;
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      {navigation.map(group => <div key={group.label}>
        <div className="nav-label">{group.label}</div>
        <nav className="nav-list" aria-label={group.label}>
          {group.entries.map(item => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`nav-link ${active === item.href ? "active" : ""}`} aria-current={active === item.href ? "page" : undefined} data-testid={`link-nav-${item.title.toLowerCase()}`}><Icon aria-hidden="true" /><span>{item.title}</span></Link>;
          })}
        </nav>
      </div>)}
      <div className="sidebar-bottom"><strong>Workspace demo</strong><p>Contoh tampilan ZETAS. Tidak terhubung ke toko atau transaksi nyata.</p></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <Link href="/" className="mobile-menu" aria-label="ZETAS beranda"><span className="brand-mark"><Layers3 size={15} /></span><span>zetas</span></Link>
        <div className="crumb" aria-label="Lokasi saat ini">Workspace <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {pageNames[active] ?? "Detail pesanan"}</div>
        <div className="top-actions"><span className="demo-pill"><span className="demo-dot" />DEMO ENVIRONMENT</span><div className="avatar" aria-label="Profil demo">ZD</div></div>
      </header>
      {children}
    </main>
    <nav className="mobile-nav" aria-label="Navigasi utama seluler">{mobileItems.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""} aria-current={active === item.href ? "page" : undefined} data-testid={`mobile-nav-${item.title.toLowerCase()}`}><Icon aria-hidden="true" /><span>{item.title}</span></Link>; })}</nav>
  </div>;
}

function Heading({ eyebrow = "Ruang kerja", title, subtitle, children }: { eyebrow?: string; title: string; subtitle: string; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}

function Dashboard() {
  const stats = [
    { label: "Total pesanan", value: demoCounts.total, note: "Contoh untuk 19 Juni", icon: ShoppingBag, wash: "rgba(230,223,240,.55)", color: "#806ca1" },
    { label: "Belum dibayar", value: demoCounts.unpaid, note: "Contoh status pembayaran", icon: CreditCard, wash: "rgba(250,239,220,.7)", color: "#a7844e" },
    { label: "Perlu diproses", value: demoCounts.processing, note: "Contoh antrean seller", icon: Clock3, wash: "rgba(240,232,246,.7)", color: "#79649b" },
    { label: "Selesai", value: demoCounts.completed, note: "Contoh order terkirim", icon: BadgeCheck, wash: "rgba(225,241,235,.8)", color: "#5d8a78" },
  ];
  return <div className="page-content">
    <Heading eyebrow="Rabu, 19 Juni 2024 · Data contoh" title="Ringkasan aktivitas" subtitle="Pantau alur order digital dari satu ruang kerja yang lebih tenang." />
    <div className="stat-grid" aria-label="Ringkasan pesanan demo">
      {stats.map(item => { const Icon = item.icon; return <article className="soft-card stat-card" key={item.label} data-testid={`stat-${item.label.toLowerCase().replaceAll(" ", "-")}`} style={{ "--wash": item.wash, "--icon": item.color } as CSSProperties}>
        <div className="stat-top"><span>{item.label}</span><span className="stat-icon"><Icon /></span></div>
        <div className="stat-number">{item.value}</div><div className="stat-note"><span className="empty-demo-label">DEMO</span> · {item.note}</div>
      </article>; })}
    </div>
    <div className="dashboard-grid">
      <section className="soft-card section-card" aria-labelledby="recent-orders-heading">
        <div className="section-head"><div><h2 id="recent-orders-heading">Order terbaru</h2><p>Aktivitas contoh, bukan transaksi aktual.</p></div><Link href="/orders" className="text-link" data-testid="link-all-orders">Lihat semua <ArrowRight size={13} /></Link></div>
        <div>{demoOrders.slice(0, 4).map(order => <div className="order-mini" key={order.id} data-testid={`dashboard-order-${order.id}`}>
          <strong className="order-id">{order.number.slice(-8)}</strong><span className="muted">{order.product}</span><span>{order.channel}</span><Status status={order.status} /><span className="empty-demo-label">DEMO</span>
        </div>)}</div>
      </section>
      <section className="soft-card section-card" aria-labelledby="recent-activity-heading">
        <div className="section-head"><div><h2 id="recent-activity-heading">Aktivitas terkini</h2><p>Linimasa pesanan demo</p></div><Activity size={17} color="#8976a2" /></div>
        <div className="activity-list">{demoActivity.map(item => <div className="activity-row" key={item.order} data-testid={`activity-${item.order}`}>
          <span className="activity-symbol"><ArrowDownLeft /></span><div className="activity-main">{item.text}<small>{item.detail} · DEMO</small></div><span className="activity-time">{item.time}</span>
        </div>)}</div>
      </section>
    </div>
  </div>;
}

function Status({ status }: { status: OrderStatus }) {
  const style = status === "Selesai" ? "green" : status === "Belum dibayar" ? "amber" : status === "Dibatalkan" ? "red" : "purple";
  return <span className={`status status-${style}`} data-testid={`status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function OrderList() {
  const [filter, setFilter] = useState<"Semua" | OrderStatus>("Semua");
  const [query, setQuery] = useState("");
  const visibleOrders = useMemo(() => demoOrders.filter(order => (filter === "Semua" || order.status === filter) && `${order.number} ${order.product} ${order.customer}`.toLowerCase().includes(query.toLowerCase())), [filter, query]);
  const filters: Array<"Semua" | OrderStatus> = ["Semua", "Belum dibayar", "Perlu diproses", "Selesai", "Dibatalkan"];
  return <div className="page-content">
    <Heading eyebrow="Order digital · data contoh" title="Pesanan" subtitle="Tinjau pesanan demo dari berbagai marketplace." />
    <div className="filter-bar" role="group" aria-label="Filter status pesanan">{filters.map(value => <button key={value} type="button" className={`filter-chip ${filter === value ? "selected" : ""}`} onClick={() => setFilter(value)} aria-pressed={filter === value} data-testid={`filter-order-${value.toLowerCase().replaceAll(" ", "-")}`}>{value}{value === "Semua" ? ` · ${demoOrders.length}` : ` · ${demoOrders.filter(o => o.status === value).length}`}</button>)}</div>
    <label className="soft-card search-box" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 44, maxWidth: 410, marginBottom: 15, color: "#9b95a3" }}>
      <Search size={16} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor order atau produk" aria-label="Cari pesanan demo" data-testid="input-search-orders" style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "#514b5b", fontSize: 12 }} />
    </label>
    <section className="soft-card orders-table" aria-label="Daftar pesanan demo">
      <div className="table-head"><span>Nomor order</span><span>Produk</span><span>Marketplace</span><span>Status</span><span>Nilai digital</span></div>
      {visibleOrders.length ? visibleOrders.map(order => <OrderRow key={order.id} order={order} />) : <div className="empty-panel"><div className="empty-icon"><Search /></div><h2>Tidak ada pesanan yang cocok</h2><p>Coba ubah kata kunci atau pilih kategori status lain.</p></div>}
    </section>
    <div className="info-banner"><Info /><span>Seluruh nomor, produk, status, dan nilai pada halaman ini adalah data DEMO. Tidak mewakili pesanan nyata.</span></div>
  </div>;
}

function OrderRow({ order }: { order: DemoOrder }) {
  return <Link href={`/orders/${order.id}`} className="table-row" data-testid={`link-order-${order.id}`} aria-label={`Buka pesanan demo ${order.number}`}>
    <span className="order-id">{order.number}<small style={{ display: "block", fontWeight: 400, color: "#9b95a2", marginTop: 4 }}>DEMO · {order.date}</small></span>
    <span className="table-product"><strong>{order.product}</strong><small>{order.sku}</small></span><span>{order.channel}</span><Status status={order.status} /><span className="order-amount">{formatRupiah(order.amount)}<small style={{ display: "block", color: "#9b95a2", fontWeight: 400, marginTop: 4 }}>nilai demo</small></span>
  </Link>;
}

function OrderDetail({ id }: { id?: string }) {
  const order = demoOrders.find(item => item.id === id);
  if (!order) return <div className="page-content"><div className="soft-card empty-panel"><div className="empty-icon"><Box /></div><h2>Pesanan demo tidak ditemukan</h2><p>ID ini tidak ada di daftar contoh. Gunakan kembali ke pesanan untuk memilih order demo yang tersedia.</p><Link className="subtle-button" href="/orders" style={{ marginTop: 18 }} data-testid="link-back-orders"><ArrowLeft /> Kembali ke pesanan</Link></div></div>;
  return <div className="page-content">
    <Heading eyebrow="Detail order · demo" title="Detail pesanan" subtitle={order.number}><Link className="subtle-button" href="/orders" data-testid="link-back-orders"><ArrowLeft /> Kembali</Link></Heading>
    <div className="detail-grid">
      <section className="soft-card detail-card" aria-labelledby="detail-order-heading">
        <div className="detail-title"><h2 id="detail-order-heading">{order.number}</h2><span className="demo-pill">DEMO RECORD</span></div>
        <DetailLine label="Produk digital" value={order.product} />
        <DetailLine label="SKU" value={order.sku} />
        <DetailLine label="Nilai digital" value={formatRupiah(order.amount)} />
        <DetailLine label="Pembeli contoh" value={order.customer} />
        <DetailLine label="Marketplace" value={order.channel} />
        <DetailLine label="Dibuat" value={order.date} />
      </section>
      <div>
        <section className="soft-card detail-card"><div className="detail-title"><h2>Status pesanan</h2><PackageCheck size={17} color="#8976a2" /></div>
          <DetailLine label="Pembayaran" value={order.payment} />
          <DetailLine label="Pemrosesan" value={order.status} />
          <div className="info-banner"><Info /><span>Status di atas adalah contoh untuk demonstrasi antarmuka. Tidak ada proses pengiriman atau perubahan order.</span></div>
        </section>
      </div>
    </div>
  </div>;
}

function DetailLine({ label, value }: { label: string; value: string }) { return <div className="detail-line"><span>{label}</span><strong data-testid={`detail-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</strong></div>; }

type EmptyKind = "chat" | "stores" | "sellers" | "users" | "integrations" | "profile";
const emptyPages: Record<EmptyKind, { eyebrow: string; title: string; subtitle: string; icon: typeof MessageSquareText; heading: string; body: string }> = {
  chat: { eyebrow: "Pesan", title: "Percakapan", subtitle: "Ruang percakapan tersedia saat alur kerja siap digunakan.", icon: MessageSquareText, heading: "Belum ada percakapan", body: "Belum ada data percakapan untuk ditampilkan. Pengiriman chat belum dikonfigurasi pada fondasi demo ini." },
  stores: { eyebrow: "Marketplace", title: "Toko", subtitle: "Lihat ruang untuk toko marketplace dalam satu tampilan.", icon: Store, heading: "Belum ada toko terhubung", body: "Daftar toko akan muncul di sini setelah koneksi marketplace tersedia. Tidak ada koneksi aktif dalam demo." },
  sellers: { eyebrow: "Tim operasional", title: "Seller", subtitle: "Ruang pengelolaan seller untuk alur order digital.", icon: Users, heading: "Belum ada seller", body: "Belum ada seller contoh untuk ditampilkan. Pengelolaan akun dan perubahan data belum tersedia." },
  users: { eyebrow: "Workspace", title: "Pengguna & operator", subtitle: "Ruang pengguna yang membantu mengelola operasional.", icon: Users, heading: "Belum ada pengguna", body: "Daftar operator belum disiapkan. Halaman ini tidak membuat atau mengubah akun." },
  integrations: { eyebrow: "Pengaturan teknis", title: "Integrasi", subtitle: "Status koneksi layanan untuk workspace ZETAS.", icon: Link2, heading: "Integrasi belum dikonfigurasi", body: "Belum ada API marketplace yang tersambung. Kredensial dan tombol koneksi sengaja tidak disediakan pada tahap fondasi ini. Arsitektur berikutnya akan mengisolasi kredensial per instalasi." },
  profile: { eyebrow: "Akun", title: "Informasi akun", subtitle: "Ringkasan identitas workspace yang sedang ditampilkan.", icon: CircleHelp, heading: "Akun demo", body: "ZETAS tidak sedang menampilkan sesi pengguna sungguhan. Informasi akun dan pengaturan profil belum dikonfigurasi." },
};
function EmptyPage({ kind }: { kind: EmptyKind }) {
  const page = emptyPages[kind]; const Icon = page.icon;
  return <div className="page-content"><Heading eyebrow={page.eyebrow} title={page.title} subtitle={page.subtitle} />
    <section className="soft-card empty-panel" data-testid={`empty-${kind}`}><div className="empty-icon"><Icon /></div><h2>{page.heading}</h2><p>{page.body}</p><span className="empty-demo-label" style={{ marginTop: 15 }}>STATUS · BELUM TERSEDIA</span></section>
    <div className="info-banner"><Info /><span>Ini adalah shell antarmuka untuk tahap awal. Tidak ada data backend atau aksi koneksi yang berjalan.</span></div>
  </div>;
}

function Settings() {
  const [compact, setCompact] = useState(false);
  const [updates, setUpdates] = useState(true);
  return <div className={`page-content ${compact ? "compact-mode" : ""}`}><Heading eyebrow="Preferensi perangkat" title="Preferensi tampilan" subtitle="Pengaturan lokal untuk cara Anda melihat workspace ini." />
    <div className="settings-layout"><aside className="soft-card setting-nav" aria-label="Bagian preferensi"><span className="active">Tampilan</span></aside>
      <section className="soft-card section-card" aria-label="Preferensi tampilan">
        <div className="section-head"><div><h2>Pengalaman workspace</h2><p>Perubahan hanya berlaku di layar ini selama sesi demo.</p></div><Monitor size={18} color="#8a76a3" /></div>
        <div className="setting-row"><div><strong>Bahasa antarmuka</strong><small>Bahasa Indonesia · pilihan tampilan saat ini</small></div><span className="demo-pill">ID</span></div>
        <div className="setting-row"><div><strong>Ruang yang lebih ringkas</strong><small>Kurangi jarak antar baris data</small></div><button type="button" className="toggle" role="switch" aria-checked={compact} aria-label="Ruang ringkas" onClick={() => setCompact(value => !value)} data-testid="toggle-compact" /></div>
        <div className="setting-row"><div><strong>Petunjuk workspace</strong><small>Tampilkan pengingat bahwa data bersifat demo</small></div><button type="button" className="toggle" role="switch" aria-checked={updates} aria-label="Petunjuk workspace" onClick={() => setUpdates(value => !value)} data-testid="toggle-demo-hints" /></div>
        {updates && <div className="info-banner"><Info /><span>Preferensi ini hanya state sementara di browser. Tidak disimpan ke server atau profil pengguna.</span></div>}
      </section>
    </div>
  </div>;
}

function NotFound() { return <div className="page-content"><div className="soft-card not-found"><div className="empty-icon" style={{ margin: "0 auto 15px" }}><Search /></div><p className="eyebrow">Halaman tidak ditemukan</p><h1>Jalur ini belum tersedia</h1><p>Periksa alamat, atau kembali ke ringkasan workspace.</p><Link href="/" className="subtle-button" style={{ marginTop: 14 }} data-testid="link-not-found-home"><Home /> Ke dashboard</Link></div></div>; }

function Router() {
  return <Shell><Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/orders" component={OrderList} />
    <Route path="/orders/:id">{params => <OrderDetail id={params.id} />}</Route>
    <Route path="/chat"><EmptyPage kind="chat" /></Route>
    <Route path="/stores"><EmptyPage kind="stores" /></Route>
    <Route path="/sellers"><EmptyPage kind="sellers" /></Route>
    <Route path="/users"><EmptyPage kind="users" /></Route>
    <Route path="/integrations"><EmptyPage kind="integrations" /></Route>
    <Route path="/settings" component={Settings} />
    <Route path="/profile"><EmptyPage kind="profile" /></Route>
    <Route component={NotFound} />
  </Switch></Shell>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter>;
}

export default App;
