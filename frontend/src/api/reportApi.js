import axiosClient from "./axiosClient";

export const getRevenueReport = (period = "month", supplierId = "") =>
  axiosClient.get("/admin/reports/revenue", {
    params: {
      period,
      ...(supplierId ? { supplierId } : {}),
    },
  });

export const getStatsReport = () =>
  axiosClient.get("/admin/reports/stats");
