export type OrderStatus = "Belum dibayar" | "Perlu diproses" | "Selesai" | "Dibatalkan";

export type DemoOrder = {
  id: string;
  number: string;
  customer: string;
  product: string;
  sku: string;
  amount: number;
  payment: "Menunggu pembayaran" | "Lunas" | "Dikembalikan";
  status: OrderStatus;
  date: string;
  channel: string;
};

export const demoOrders: DemoOrder[] = [
  { id: "ord-1048", number: "ZT-240619-1048", customer: "Nadia P.", product: "Saldo game — 86 Diamonds", sku: "ML-86-ID", amount: 21900, payment: "Lunas", status: "Perlu diproses", date: "19 Jun 2024, 14.32", channel: "Shopee" },
  { id: "ord-1047", number: "ZT-240619-1047", customer: "Rizky A.", product: "Voucher Google Play", sku: "GP-ID-100K", amount: 108500, payment: "Lunas", status: "Selesai", date: "19 Jun 2024, 13.58", channel: "Tokopedia" },
  { id: "ord-1046", number: "ZT-240619-1046", customer: "Fira N.", product: "Pulsa Telkomsel 50K", sku: "TSEL-50", amount: 52250, payment: "Menunggu pembayaran", status: "Belum dibayar", date: "19 Jun 2024, 13.21", channel: "Shopee" },
  { id: "ord-1045", number: "ZT-240619-1045", customer: "Bagas D.", product: "Saldo game — 172 Diamonds", sku: "ML-172-ID", amount: 43200, payment: "Lunas", status: "Selesai", date: "19 Jun 2024, 12.47", channel: "TikTok Shop" },
  { id: "ord-1044", number: "ZT-240619-1044", customer: "Intan S.", product: "Paket data 25 GB", sku: "XL-DATA-25", amount: 68400, payment: "Dikembalikan", status: "Dibatalkan", date: "19 Jun 2024, 11.16", channel: "Tokopedia" },
];

export const demoActivity = [
  { order: "ZT-240619-1048", text: "Order baru perlu diproses", detail: "Saldo game — 86 Diamonds · Shopee", time: "14.32" },
  { order: "ZT-240619-1047", text: "Order ditandai selesai", detail: "Voucher Google Play · Tokopedia", time: "13.58" },
  { order: "ZT-240619-1046", text: "Menunggu konfirmasi pembayaran", detail: "Pulsa Telkomsel 50K · Shopee", time: "13.21" },
];

export const demoCounts = {
  total: demoOrders.length,
  unpaid: demoOrders.filter(order => order.status === "Belum dibayar").length,
  processing: demoOrders.filter(order => order.status === "Perlu diproses").length,
  completed: demoOrders.filter(order => order.status === "Selesai").length,
};

export const formatRupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
