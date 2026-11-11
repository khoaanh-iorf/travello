export const formatCurrency = (amount, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(amount || 0);

export const formatNumber = (n) =>
  new Intl.NumberFormat("vi-VN").format(n || 0);

