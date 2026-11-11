import axiosClient from "./axiosClient";

export const loginAdmin = (data) => axiosClient.post("/auth/admin/login", data);
export const logoutAdmin = () => axiosClient.post("/auth/logout");

