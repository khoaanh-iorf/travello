import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Plane, Eye, EyeOff } from "lucide-react";
import { loginAdmin } from "../../api/authApi";
import { useAuthStore } from "../../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError("");
    setLoading(true);
    try {
      const res = await loginAdmin(data);
      const { token, admin } = res.data.data;
      setAuth(token, admin);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Plane size={20} className="text-primary" />
          </div>
          <span className="font-bold text-primary tracking-widest uppercase text-sm">
            Travel Mini Admin
          </span>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">
          Đăng nhập quản trị
        </h1>
        <p className="text-center text-gray-400 text-sm mb-8">
          Dành cho tài khoản quản trị viên được cấp quyền.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Địa chỉ email
            </label>
            <input
              type="email"
              placeholder="admin@example.com"
              className="input-field"
              {...register("email", { required: "Vui lòng nhập email" })}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                className="input-field pr-16"
                {...register("password", { required: "Vui lòng nhập mật khẩu" })}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-medium flex items-center gap-1 hover:text-blue-700"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPw ? "Ẩn" : "Hiện"}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập quản trị"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">
          Tài khoản admin chỉ được tạo bởi quản trị hệ thống.
        </p>
      </div>
    </div>
  );
}

