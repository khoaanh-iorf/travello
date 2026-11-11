import axiosClient from "./axiosClient";

export const getPayments = (params, config) =>
  axiosClient.get("/admin/payments", { params, ...config });

export const exportPayments = (params) =>
  axiosClient.get("/admin/payments/export", { params, responseType: "blob" });
