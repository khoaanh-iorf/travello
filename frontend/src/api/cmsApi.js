import axiosClient from "./axiosClient";

export const getBanners = () => axiosClient.get("/admin/cms/banners");
export const createBanner = (data) => axiosClient.post("/admin/cms/banners", data);
export const updateBanner = (id, data) => axiosClient.put(`/admin/cms/banners/${id}`, data);
export const deleteBanner = (id) => axiosClient.delete(`/admin/cms/banners/${id}`);

export const getBlogs = (params) => axiosClient.get("/admin/cms/blogs", { params });
export const createBlog = (data) => axiosClient.post("/admin/cms/blogs", data);
export const updateBlog = (id, data) => axiosClient.put(`/admin/cms/blogs/${id}`, data);
export const deleteBlog = (id) => axiosClient.delete(`/admin/cms/blogs/${id}`);
