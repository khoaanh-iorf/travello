import axiosClient from "./axiosClient";

export const getSupportTickets = (params) => axiosClient.get("/admin/support", { params });
export const getSupportTicketById = (id) => axiosClient.get(`/admin/support/${id}`);
export const updateTicketStatus = (id, status) =>
  axiosClient.patch(`/admin/support/${id}/status`, { status });
export const replyTicket = (id, message) =>
  axiosClient.post(`/admin/support/${id}/reply`, { message });
