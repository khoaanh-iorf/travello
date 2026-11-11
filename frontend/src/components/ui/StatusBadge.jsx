export default function StatusBadge({ status }) {
  const map = {
    ACTIVE:      "badge-active",
    ĐANG_HOẠT_ĐỘNG: "badge-active",
    LOCKED:      "badge-locked",
    ĐÃ_KHÓA:    "badge-locked",
    PENDING:     "badge-pending",
    PAID:        "badge-active",
    EXPIRED:     "badge-locked",
    CANCELLED:   "badge-locked",
    OPEN:        "badge-pending",
    IN_PROGRESS: "badge-admin",
    RESOLVED:    "badge-active",
    CLOSED:      "badge-locked",
    ADMIN:       "badge-admin",
    CUSTOMER:    "badge-customer",
    INACTIVE:    "badge-locked",
    APPROVED:    "badge-active",
    REJECTED:    "badge-locked",
  };

  const labelMap = {
    ACTIVE:      "Đang hoạt động",
    LOCKED:      "Đã khóa",
    PENDING:     "Chờ xử lý",
    PAID:        "Đã thanh toán",
    EXPIRED:     "Hết hạn",
    CANCELLED:   "Đã hủy",
    OPEN:        "Mở",
    IN_PROGRESS: "Đang xử lý",
    RESOLVED:    "Đã giải quyết",
    CLOSED:      "Đã đóng",
    ADMIN:       "ADMIN",
    CUSTOMER:    "CUSTOMER",
    INACTIVE:    "Không hoạt động",
    APPROVED:    "Đã duyệt",
    REJECTED:    "Từ chối",
  };

  const cls = map[status] || "badge-customer";
  const label = labelMap[status] || status;

  return <span className={cls}>{label}</span>;
}

