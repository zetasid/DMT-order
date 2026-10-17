import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, Building2, KeyRound, ShieldCheck, Store, UserRound, Users, RefreshCw } from "lucide-react";
import {
  getGetCurrentUserQueryKey,
  getGetCsrfTokenQueryKey,
  getGetTenantQueryKey,
  getListManagedUsersQueryKey,
  getListTenantsQueryKey,
  useCreateOperator,
  useCreateSeller,
  useDeactivateTenant,
  useGetCsrfToken,
  useGetTenant,
  useListManagedUsers,
  useListTenants,
  useLogin,
  useLogout,
  useUpdateManagedUserStatus,
  useUpdateTenant,
} from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().email("Masukkan email yang valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});
type LoginFields = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const csrf = useGetCsrfToken({ query: { queryKey: getGetCsrfTokenQueryKey(), staleTime: 0, refetchOnMount: "always" } });
  const login = useLogin();
  const form = useForm<LoginFields>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const submit = form.handleSubmit(values => {
    login.mutate({ data: values }, {
      onSuccess: result => {
        client.setQueryData(getGetCurrentUserQueryKey(), { user: result.user });
        client.setQueryData(getGetCsrfTokenQueryKey(), { csrfToken: result.csrfToken });
        form.reset({ email: "", password: "" });
        setLocation("/");
      },
    });
  });
  return <main className="auth-page" data-testid="page-login">
    <section className="auth-story">
      <div className="auth-brand"><span className="brand-mark"><Building2 size={18} /></span><div><b>zetas</b><small>order workspace</small></div></div>
      <div className="auth-story-copy"><span className="auth-kicker">Satu workspace. Ruang yang terjaga.</span><h1>Operasional<br />lebih tertata.</h1><p>Ruang kerja untuk tim seller Indonesia. Setiap anggota melihat toko dan aktivitas sesuai peran serta aksesnya.</p><div className="auth-roles"><span className="auth-role-chip">Owner</span><span className="auth-role-chip">Seller</span><span className="auth-role-chip">Operator</span></div></div>
      <div className="auth-foot">ZETAS · Workspace operasional seller</div>
    </section>
    <section className="auth-form-side"><div className="auth-card">
      <p className="eyebrow">Selamat datang kembali</p><h2>Masuk ke ZETAS</h2><p>Gunakan akun workspace yang diberikan oleh Owner Anda.</p>
      <Form {...form}><form onSubmit={submit} noValidate>
        <FormField control={form.control} name="email" render={({ field }) => <FormItem className="auth-field"><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" autoComplete="username" placeholder="nama@bisnis.id" data-testid="input-login-email" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="password" render={({ field }) => <FormItem className="auth-field"><FormLabel>Kata sandi</FormLabel><FormControl><Input {...field} type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" data-testid="input-login-password" /></FormControl><FormMessage /></FormItem>} />
        {csrf.isFetching && <div className="auth-notice" role="status" data-testid="status-login-security">Menyiapkan sesi aman…</div>}
        {csrf.isError && <div className="auth-notice error" role="alert" data-testid="error-login-security">Sesi keamanan belum siap. <button type="button" className="account-action" onClick={() => csrf.refetch()} data-testid="button-retry-csrf">Coba lagi</button></div>}
        {login.isError && <div className="auth-notice error" role="alert" data-testid="error-login">Email atau kata sandi tidak dapat diverifikasi. Periksa kembali lalu coba lagi.</div>}
        <button className="auth-button" type="submit" disabled={login.isPending || csrf.isFetching || csrf.isError} data-testid="button-login-submit">{login.isPending ? "Memeriksa akun…" : "Masuk ke workspace"} <ArrowRight size={15} style={{ display: "inline", verticalAlign: "middle", marginLeft: 7 }} /></button>
      </form></Form>
      <div className="info-banner" style={{ marginTop: 20 }}><ShieldCheck /><span>Workspace memisahkan data berdasarkan akun dan keanggotaan. Demo order tetap ditandai sebagai data contoh.</span></div>
    </div></section>
  </main>;
}

function QueryLoading({ label }: { label: string }) {
  return <div className="soft-card account-panel" role="status" aria-label={label} data-testid="loading-account-data"><div className="loading-lines"><span /><span /><span /></div></div>;
}

function QueryError({ label, retry }: { label: string; retry: () => void }) {
  return <div className="soft-card empty-panel" role="alert" data-testid="error-account-data"><div className="empty-icon"><RefreshCw /></div><h2>{label}</h2><p>Data belum dapat dimuat. Periksa koneksi, lalu coba lagi.</p><button type="button" className="account-action" onClick={retry} data-testid="button-retry-account">Coba lagi</button></div>;
}

export function UsersPage({ user }: { user: AuthUser }) {
  const client = useQueryClient();
  const users = useListManagedUsers();
  const tenants = useListTenants();
  const createSeller = useCreateSeller();
  const createOperator = useCreateOperator();
  const updateStatus = useUpdateManagedUserStatus();
  const [kind, setKind] = useState<"seller" | "operator">("seller");
  const [feedback, setFeedback] = useState("");
  const [errorText, setErrorText] = useState("");
  const schema = z.object({ email: z.string().email("Masukkan email yang valid."), displayName: z.string().min(1, "Nama wajib diisi.").max(120), password: z.string().min(12, "Gunakan setidaknya 12 karakter.").max(128), tenantName: z.string().optional(), tenantSlug: z.string().optional(), tenantId: z.string().optional() });
  type CreateFields = z.infer<typeof schema>;
  const form = useForm<CreateFields>({ resolver: zodResolver(schema), defaultValues: { email: "", displayName: "", password: "", tenantName: "", tenantSlug: "", tenantId: "" } });
  const createPending = createSeller.isPending || createOperator.isPending;
  const submit = form.handleSubmit(values => {
    setFeedback(""); setErrorText("");
    const onSuccess = () => {
      form.reset({ email: "", displayName: "", password: "", tenantName: "", tenantSlug: "", tenantId: "" });
      setFeedback(kind === "seller" ? "Akun Seller dan workspace toko berhasil dibuat." : "Akun Operator berhasil ditambahkan.");
      client.invalidateQueries({ queryKey: getListManagedUsersQueryKey() });
      client.invalidateQueries({ queryKey: getListTenantsQueryKey() });
    };
    if (kind === "seller") {
      const slug = values.tenantSlug?.trim().toLowerCase() ?? "";
      if (!values.tenantName?.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 48) {
        setErrorText("Isi nama toko dan slug yang valid (huruf kecil, angka, dan tanda hubung)."); return;
      }
      createSeller.mutate({ data: { email: values.email, displayName: values.displayName, password: values.password, tenantName: values.tenantName.trim(), tenantSlug: slug } }, { onSuccess, onError: () => setErrorText("Akun Seller belum berhasil dibuat. Periksa data lalu coba lagi.") });
    } else {
      if (!values.tenantId) { setErrorText("Pilih workspace untuk Operator."); return; }
      createOperator.mutate({ data: { email: values.email, displayName: values.displayName, password: values.password, tenantId: values.tenantId } }, { onSuccess, onError: () => setErrorText("Akun Operator belum berhasil dibuat. Periksa data lalu coba lagi.") });
    }
  });
  if (users.isLoading || tenants.isLoading) return <div className="page-content"><QueryLoading label="Memuat pengguna" /></div>;
  if (users.isError || tenants.isError) return <div className="page-content"><QueryError label="Pengguna belum tersedia" retry={() => { users.refetch(); tenants.refetch(); }} /></div>;
  const userRows = users.data?.users ?? [];
  const tenantList = tenants.data?.tenants ?? [];
  return <div className="page-content account-page">
    <HeadingAccount title="Pengguna workspace" subtitle="Kelola Seller dan Operator di tenant yang Anda miliki." eyebrow="Administrasi · owner" />
    <section className="soft-card account-panel" aria-labelledby="create-account-heading">
      <div className="section-head"><div><h2 id="create-account-heading">Tambahkan anggota</h2><p>Akun baru hanya dapat dibuat oleh Owner. Masuk sebagai {user.displayName}.</p></div><Users size={18} color="#80699f" /></div>
      <div className="filter-bar" role="group" aria-label="Jenis akun baru">
        <button type="button" className={`filter-chip ${kind === "seller" ? "selected" : ""}`} aria-pressed={kind === "seller"} onClick={() => { setKind("seller"); setFeedback(""); setErrorText(""); }} data-testid="button-kind-seller">Seller baru</button>
        <button type="button" className={`filter-chip ${kind === "operator" ? "selected" : ""}`} aria-pressed={kind === "operator"} onClick={() => { setKind("operator"); setFeedback(""); setErrorText(""); }} data-testid="button-kind-operator">Operator</button>
      </div>
      <Form {...form}><form onSubmit={submit} noValidate>
        <div className="account-grid">
          <FormField control={form.control} name="displayName" render={({ field }) => <FormItem className="auth-field"><FormLabel>Nama lengkap</FormLabel><FormControl><Input {...field} autoComplete="name" placeholder="Nama anggota" data-testid="input-managed-name" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="email" render={({ field }) => <FormItem className="auth-field"><FormLabel>Email masuk</FormLabel><FormControl><Input {...field} type="email" autoComplete="email" placeholder="nama@bisnis.id" data-testid="input-managed-email" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="password" render={({ field }) => <FormItem className="auth-field span-two"><FormLabel>Kata sandi awal</FormLabel><FormControl><Input {...field} type="password" autoComplete="new-password" placeholder="Minimal 12 karakter" data-testid="input-managed-password" /></FormControl><small className="help-inline">Hanya digunakan saat membuat akun dan dibersihkan setelah berhasil.</small><FormMessage /></FormItem>} />
          {kind === "seller" ? <>
            <FormField control={form.control} name="tenantName" render={({ field }) => <FormItem className="auth-field"><FormLabel>Nama workspace toko</FormLabel><FormControl><Input {...field} placeholder="Contoh: Ruang Nusa" data-testid="input-tenant-name" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="tenantSlug" render={({ field }) => <FormItem className="auth-field"><FormLabel>Slug workspace</FormLabel><FormControl><Input {...field} placeholder="ruang-nusa" autoCapitalize="none" data-testid="input-tenant-slug" /></FormControl><small className="help-inline">Huruf kecil, angka, dan tanda hubung.</small></FormItem>} />
          </> : <FormField control={form.control} name="tenantId" render={({ field }) => <FormItem className="auth-field span-two"><FormLabel>Workspace Operator</FormLabel><FormControl><select {...field} className="auth-select" data-testid="select-operator-tenant"><option value="">Pilih workspace</option>{tenantList.filter(t => t.status === "active").map(t => <option key={t.id} value={t.id}>{t.name} · {t.slug}</option>)}</select></FormControl><FormMessage /></FormItem>} />}
        </div>
        {feedback && <div className="auth-notice success" role="status" data-testid="success-create-account">{feedback}</div>}
        {errorText && <div className="auth-notice error" role="alert" data-testid="error-create-account">{errorText}</div>}
        <button className="account-action" type="submit" disabled={createPending} data-testid="button-create-account">{createPending ? "Membuat akun…" : kind === "seller" ? "Buat Seller dan workspace" : "Tambahkan Operator"}</button>
      </form></Form>
    </section>
    <section className="soft-card account-panel" aria-label="Daftar akun terkelola"><div className="section-head"><div><h2>Akun terkelola</h2><p>{userRows.length} akun · data tenant tetap terpisah.</p></div><span className="tenant-badge"><ShieldCheck size={13} />Owner view</span></div>
      {updateStatus.isError && <div className="auth-notice error" role="alert" data-testid="error-managed-user-status">Status pengguna belum dapat diperbarui. Coba kembali.</div>}
      {!userRows.length ? <div className="empty-panel" data-testid="empty-managed-users"><div className="empty-icon"><UserRound /></div><h2>Belum ada anggota</h2><p>Buat akun Seller atau Operator untuk mulai membentuk tim.</p></div> : <div className="account-table-wrap"><table className="account-table"><thead><tr><th>Anggota</th><th>Peran / workspace</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{userRows.map(row => {
        const membership = row.memberships[0];
        const isPending = updateStatus.isPending && updateStatus.variables?.userId === row.id;
        return <tr key={row.id} data-testid={`row-managed-user-${row.id}`}><td className="account-user" data-testid={`managed-user-${row.id}`}>{row.displayName}<small>{row.email}</small></td><td>{membership ? <><span className="tenant-badge">{membership.role}</span><small>{membership.tenantName}</small></> : <span className="muted">Tanpa tenant</span>}</td><td><span className={`account-status ${row.status === "disabled" ? "disabled" : ""}`} data-testid={`status-managed-user-${row.id}`}>{row.status === "active" ? "Aktif" : "Nonaktif"}</span></td><td><button type="button" className={`account-action ${row.status === "active" ? "danger" : ""}`} disabled={isPending} onClick={() => updateStatus.mutate({ userId: row.id, data: { status: row.status === "active" ? "disabled" : "active" } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListManagedUsersQueryKey() }) })} data-testid={`button-toggle-user-${row.id}`}>{isPending ? "Menyimpan…" : row.status === "active" ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}

function HeadingAccount({ title, subtitle, eyebrow }: { title: string; subtitle: string; eyebrow: string }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

export function StoresPage({ user }: { user: AuthUser }) {
  const client = useQueryClient();
  const stores = useListTenants();
  const [selectedId, setSelectedId] = useState("");
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");
  const detail = useGetTenant(selectedId, { query: { enabled: Boolean(selectedId), queryKey: getGetTenantQueryKey(selectedId) } });
  const updateTenant = useUpdateTenant();
  const deactivateTenant = useDeactivateTenant();
  if (stores.isLoading) return <div className="page-content"><QueryLoading label="Memuat workspace" /></div>;
  if (stores.isError) return <div className="page-content"><QueryError label="Workspace belum tersedia" retry={() => stores.refetch()} /></div>;
  const tenantList = stores.data?.tenants ?? [];
  const selected = detail.data;
  const canEdit = user.accountType === "owner" || user.memberships.some(m => m.tenantId === selectedId && m.role === "seller");
  return <div className="page-content account-page">
    <HeadingAccount title="Workspace toko" subtitle="Daftar hanya menampilkan tenant yang dapat Anda akses." eyebrow="Tenant · ruang kerja" />
    <section className="soft-card account-panel"><div className="section-head"><div><h2>Tenant yang terlihat</h2><p>{tenantList.length} workspace dalam cakupan akun ini.</p></div><span className="tenant-badge"><Store size={13} />Terisolasi per tenant</span></div>
      {!tenantList.length ? <div className="empty-panel" data-testid="empty-stores"><div className="empty-icon"><Building2 /></div><h2>Belum ada workspace</h2><p>Tenant yang diberikan kepada akun Anda akan muncul di sini.</p></div> : <div className="account-list">{tenantList.map(tenant => <div className="account-row" key={tenant.id} data-testid={`row-tenant-${tenant.id}`}><div className="account-user" data-testid={`tenant-name-${tenant.id}`}>{tenant.name}<small>/{tenant.slug}</small></div><div><span className={`account-status ${tenant.status === "disabled" ? "disabled" : ""}`} data-testid={`status-tenant-${tenant.id}`}>{tenant.status === "active" ? "Aktif" : "Nonaktif"}</span><small>Tenant terpisah</small></div><div><small>Dibuat</small><span>{new Date(tenant.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><button type="button" className="account-action" onClick={() => { setSelectedId(tenant.id); setEditName(tenant.name); setNotice(""); setErrorText(""); }} data-testid={`button-view-tenant-${tenant.id}`}>Lihat detail</button></div>)}</div>}
      {selectedId && <div className="tenant-detail" data-testid={`detail-tenant-${selectedId}`}>
        {detail.isLoading ? <p role="status">Memuat detail tenant…</p> : detail.isError ? <div className="auth-notice error" role="alert">Detail tidak dapat dimuat. <button type="button" className="account-action" onClick={() => detail.refetch()} data-testid="button-retry-tenant">Coba lagi</button></div> : selected && <>
          <div className="section-head"><div><h3>{selected.name}</h3><p>Slug /{selected.slug} · status {selected.status}</p></div><button type="button" className="account-action" onClick={() => setSelectedId("")} data-testid="button-close-tenant-detail">Tutup detail</button></div>
          <p>ID tenant: <strong data-testid={`tenant-id-${selected.id}`}>{selected.id}</strong></p><p>Pembaruan terakhir: {new Date(selected.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          {canEdit && selected.status === "active" && <div className="inline-edit"><input aria-label="Nama tenant baru" value={editName} onChange={e => setEditName(e.target.value)} maxLength={120} data-testid="input-edit-tenant-name" /><button type="button" className="account-action" disabled={updateTenant.isPending || !editName.trim()} onClick={() => updateTenant.mutate({ tenantId: selected.id, data: { name: editName.trim() } }, { onSuccess: () => { setNotice("Nama workspace diperbarui."); setErrorText(""); client.invalidateQueries({ queryKey: getListTenantsQueryKey() }); client.invalidateQueries({ queryKey: getGetTenantQueryKey(selected.id) }); }, onError: () => setErrorText("Nama workspace belum dapat diperbarui.") })} data-testid="button-save-tenant-name">{updateTenant.isPending ? "Menyimpan…" : "Simpan nama"}</button>{user.accountType === "owner" && <button type="button" className="account-action danger" disabled={deactivateTenant.isPending} onClick={() => { if (window.confirm(`Nonaktifkan workspace ${selected.name}?`)) deactivateTenant.mutate({ tenantId: selected.id }, { onSuccess: () => { setNotice("Workspace dinonaktifkan."); client.invalidateQueries({ queryKey: getListTenantsQueryKey() }); client.invalidateQueries({ queryKey: getGetTenantQueryKey(selected.id) }); }, onError: () => setErrorText("Workspace belum dapat dinonaktifkan.") }); }} data-testid={`button-deactivate-tenant-${selected.id}`}>{deactivateTenant.isPending ? "Memproses…" : "Nonaktifkan tenant"}</button>}</div>}
          {notice && <div className="auth-notice success" role="status" data-testid="success-tenant-update">{notice}</div>}{errorText && <div className="auth-notice error" role="alert" data-testid="error-tenant-update">{errorText}</div>}
        </>}
      </div>}
    </section>
  </div>;
}

export function ProfilePage({ user }: { user: AuthUser }) {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const logout = useLogout();
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  return <div className="page-content account-page">
    <HeadingAccount title="Profil akun" subtitle="Identitas dan akses untuk sesi Anda saat ini." eyebrow="Akun · identitas" />
    <section className="soft-card profile-card" data-testid="profile-identity">
      <div className="profile-avatar" aria-hidden="true">{initials || "ZT"}</div>
      <div><h2 data-testid="text-profile-name">{user.displayName}</h2><p data-testid="text-profile-email">{user.email}</p><span className="tenant-badge"><KeyRound size={12} />{user.accountType === "owner" ? "Owner" : user.memberships.map(m => m.role).join(" · ") || "Member"}</span></div>
      <div className="profile-meta"><div><span>Status akun</span><strong data-testid="status-profile-account">{user.status === "active" ? "Aktif" : "Nonaktif"}</strong></div><div><span>Jenis akun</span><strong>{user.accountType === "owner" ? "Owner ZETAS" : "Anggota workspace"}</strong></div></div>
    </section>
    {user.memberships.length > 0 && <section className="soft-card account-panel"><div className="section-head"><div><h2>Keanggotaan</h2><p>Akses tenant yang terhubung dengan akun ini.</p></div><Building2 size={17} color="#80699f" /></div><div className="account-list">{user.memberships.map(m => <div className="account-row" key={m.tenantId} data-testid={`profile-membership-${m.tenantId}`}><div className="account-user">{m.tenantName}<small>/{m.tenantSlug}</small></div><span className="tenant-badge">{m.role}</span><span /><Link href="/stores" className="account-action" data-testid={`link-membership-tenant-${m.tenantId}`}>Buka toko</Link></div>)}</div></section>}
    <section className="soft-card account-panel"><div className="section-head"><div><h2>Akhiri sesi</h2><p>Keluar dari workspace pada perangkat ini.</p></div></div>{logout.isError && <div role="alert" className="auth-notice error" data-testid="error-logout">Belum dapat keluar. Coba lagi.</div>}<button type="button" className="account-action danger" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => { client.removeQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation("/login"); }, onError: () => undefined })} data-testid="button-logout">{logout.isPending ? "Mengakhiri sesi…" : "Keluar dari ZETAS"}</button></section>
  </div>;
}
