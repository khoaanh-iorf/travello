import axiosClient from "./axiosClient";

export const getPromotions = (params) => axiosClient.get("/admin/promotions", { params });
export const createPromotion = (data) => axiosClient.post("/admin/promotions", data);
export const updatePromotion = (id, data) => axiosClient.put(`/admin/promotions/${id}`, data);
export const deletePromotion = (id) => axiosClient.delete(`/admin/promotions/${id}`);
export const updatePromotionStatus = (id, status) =>
  axiosClient.patch(`/admin/promotions/${id}/status`, { status });
