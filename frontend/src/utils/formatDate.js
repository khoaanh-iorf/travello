import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

export const formatDate = (dateStr, fmt = "dd/MM/yyyy") => {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), fmt, { locale: vi });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => formatDate(dateStr, "HH:mm:ss dd/MM/yyyy");

