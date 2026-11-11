import axiosClient from "./axiosClient";

export const getBookings = (params) => axiosClient.get("/admin/bookings", { params });
export const getBookingById = (id) => axiosClient.get(`/admin/bookings/${id}`);

