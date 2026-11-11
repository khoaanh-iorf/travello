import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "Xác nhận", danger = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? "bg-red-100" : "bg-yellow-100"}`}>
            <AlertTriangle size={20} className={danger ? "text-red-500" : "text-yellow-500"} />
          </div>
          <p className="text-gray-800 font-medium">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">Hủy</button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-yellow-500 hover:bg-yellow-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

