import axiosClient from "./axiosClient";

export const getSuppliers = (params) => axiosClient.get("/admin/suppliers", { params });
export const createSupplier = (data) => axiosClient.post("/admin/suppliers", data);
export const updateSupplier = (id, data) => axiosClient.put(`/admin/suppliers/${id}`, data);
export const deleteSupplier = (id) => axiosClient.delete(`/admin/suppliers/${id}`);
export const updateSupplierStatus = (id, status) =>
  axiosClient.patch(`/admin/suppliers/${id}/status`, { status });
