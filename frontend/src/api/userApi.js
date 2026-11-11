import axiosClient from "./axiosClient";

export const getUsers = (params) => axiosClient.get("/admin/users", { params });
export const getUserById = (id) => axiosClient.get(`/admin/users/${id}`);
export const updateUserStatus = (id, status) =>
  axiosClient.patch(`/admin/users/${id}/status`, { status });

