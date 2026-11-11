import axiosClient from "./axiosClient";

export const getLocations = (params) => axiosClient.get("/admin/locations", { params });
export const getLocationById = (id) => axiosClient.get(`/admin/locations/${id}`);
export const createLocation = (data) => axiosClient.post("/admin/locations", data);
export const updateLocation = (id, data) => axiosClient.put(`/admin/locations/${id}`, data);
export const deleteLocation = (id) => axiosClient.delete(`/admin/locations/${id}`);
export const updateLocationStatus = (id, status) =>
  axiosClient.patch(`/admin/locations/${id}/status`, { status });
export const toggleFeaturedLocation = (id, featured) =>
  axiosClient.patch(`/admin/locations/${id}/featured`, { featured });
