import axiosClient from "./axiosClient";

/**
 * tripApi.js — API client cho Quản lý chuyến chạy
 * Backend: /api/admin/trips
 */

/**
 * Lấy danh sách chuyến chạy
 * @param {Object} params - { serviceType, routeId, supplierId, status, dateFrom, dateTo, search, page, limit }
 */
export const getTrips = (params = {}) =>
  axiosClient.get("/admin/trips", { params });

/**
 * Lấy chi tiết một chuyến (kèm danh sách booking)
 * @param {string} id - Trip ObjectId
 * @param {string} serviceType - BUS | FLIGHT | TRAIN
 */
export const getTripById = (id, serviceType) =>
  axiosClient.get(`/admin/trips/${id}`, { params: { serviceType } });

/**
 * Tạo chuyến mới
 * @param {Object} data - { serviceType, routeId, supplierId, departureTime, arrivalTime, basePrice, seatCapacity, ... }
 */
export const createTrip = (data) =>
  axiosClient.post("/admin/trips", data);

/**
 * Sửa thông tin chuyến (PUT — gửi toàn bộ thay đổi)
 * @param {string} id - Trip ObjectId
 * @param {Object} data - kèm serviceType
 */
export const updateTrip = (id, data) =>
  axiosClient.put(`/admin/trips/${id}`, data);

/**
 * Đổi trạng thái chuyến
 * @param {string} id - Trip ObjectId
 * @param {string} serviceType - BUS | FLIGHT | TRAIN
 * @param {string} status - SCHEDULED | RUNNING | COMPLETED | CANCELLED
 */
export const updateTripStatus = (id, serviceType, status) =>
  axiosClient.patch(`/admin/trips/${id}/status`, { serviceType, status });

