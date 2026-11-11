import axiosClient from "./axiosClient";

export const getRoutes = (params) => axiosClient.get("/admin/routes", { params });
export const getRouteById = (id) => axiosClient.get(`/admin/routes/${id}`);
export const createRoute = (data) => axiosClient.post("/admin/routes", data);
export const updateRoute = (id, data) => axiosClient.put(`/admin/routes/${id}`, data);
export const updateRouteStatus = (id, status) =>
  axiosClient.patch(`/admin/routes/${id}/status`, { status });
