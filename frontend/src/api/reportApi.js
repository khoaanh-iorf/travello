import axiosClient from "./axiosClient";

export const getRevenueReport = (period = "month") =>
  axiosClient.get("/admin/reports/revenue", { params: { period } });

export const getStatsReport = () =>
  axiosClient.get("/admin/reports/stats");
