import re
from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_locations_bp = Blueprint("admin_locations", __name__)

# ── Hằng số ───────────────────────────────────────────────────────────────────
VALID_TYPES = {"AIRPORT", "TRAIN_STATION", "BUS_STATION", "OTHER"}
VALID_STATUSES = {"ACTIVE", "INACTIVE"}
CODE_REGEX = re.compile(r"^[A-Z0-9\-_]{2,20}$")
DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"
DEFAULT_COUNTRY = "VN"

TIMEZONES = [
    "Asia/Ho_Chi_Minh",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Seoul",
    "UTC",
]


# ── Serializer ────────────────────────────────────────────────────────────────
def serialize_location(loc):
    return {
        "id": str(loc["_id"]),
        "code": loc.get("code"),
        "external_code": loc.get("external_code"),
        "name": loc.get("name"),
        "type": loc.get("type"),
        "city": loc.get("city"),
        "country": loc.get("country", DEFAULT_COUNTRY),
        "address": loc.get("address"),
        "timezone": loc.get("timezone", DEFAULT_TIMEZONE),
        "status": loc.get("status", "ACTIVE"),
        "featured": loc.get("featured", False),
        "created_at": loc["created_at"].isoformat() if loc.get("created_at") else None,
        "updated_at": loc["updated_at"].isoformat() if loc.get("updated_at") else None,
    }


# ── Validator dùng chung ──────────────────────────────────────────────────────
def validate_and_normalize(data, loc_id=None):
    """Validate và chuẩn hóa dữ liệu địa điểm. Trả về (data_chuẩn, error_msg)."""
    # Mã nội bộ
    code = data.get("code", "").strip().upper()
    if not code:
        return None, "Mã nội bộ (code) là bắt buộc"
    if not CODE_REGEX.match(code):
        return None, "Mã nội bộ chỉ được dùng chữ in hoa, số, dấu gạch ngang/dưới (2–20 ký tự)"

    # Tên địa điểm
    name = data.get("name", "").strip()
    if not name:
        return None, "Tên địa điểm là bắt buộc"

    # Loại địa điểm
    loc_type = data.get("type", "").strip().upper()
    if not loc_type or loc_type not in VALID_TYPES:
        return None, f"Loại địa điểm không hợp lệ. Phải là: {', '.join(VALID_TYPES)}"

    # Thành phố
    city = data.get("city", "").strip()
    if not city:
        return None, "Thành phố / Tỉnh là bắt buộc"

    # Kiểm tra trùng mã nội bộ
    dup_query = {"code": code}
    if loc_id:
        try:
            dup_query["_id"] = {"$ne": ObjectId(loc_id)}
        except Exception:
            return None, "ID không hợp lệ"
    if mongo.db.locations.find_one(dup_query):
        return None, f"Mã nội bộ '{code}' đã tồn tại trong hệ thống"

    # Mã chuẩn bên ngoài (tùy chọn)
    external_code = data.get("external_code", "")
    if external_code:
        external_code = external_code.strip().upper()[:15]

    # Trạng thái
    status = data.get("status", "ACTIVE").strip().upper()
    if status not in VALID_STATUSES:
        status = "ACTIVE"

    normalized = {
        "code": code,
        "external_code": external_code or None,
        "name": name,
        "type": loc_type,
        "city": city,
        "country": data.get("country", DEFAULT_COUNTRY).strip() or DEFAULT_COUNTRY,
        "address": data.get("address", "").strip() or None,
        "timezone": data.get("timezone", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE,
        "status": status,
    }
    return normalized, None


# ── GET Danh sách ─────────────────────────────────────────────────────────────
@admin_locations_bp.route("", methods=["GET"])
@admin_required
def list_locations():
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(int(request.args.get("limit", 10)), 100)
    search = request.args.get("search", "").strip()
    loc_type = request.args.get("type", "").strip().upper()
    status = request.args.get("status", "").strip().upper()

    query = {}

    if search:
        query["$or"] = [
            {"name":          {"$regex": search, "$options": "i"}},
            {"code":          {"$regex": search, "$options": "i"}},
            {"external_code": {"$regex": search, "$options": "i"}},
            {"city":          {"$regex": search, "$options": "i"}},
            {"address":       {"$regex": search, "$options": "i"}},
        ]

    if loc_type and loc_type in VALID_TYPES:
        query["type"] = loc_type

    if status and status in VALID_STATUSES:
        query["status"] = status

    result = paginate(mongo.db.locations, query, page, limit, "created_at", -1)
    result["items"] = [serialize_location(loc) for loc in result["items"]]

    # Tổng số theo trạng thái (cho stat cards)
    total_active = mongo.db.locations.count_documents({"status": "ACTIVE"})
    total_all    = mongo.db.locations.count_documents({})

    return success_response(data=result, total_active=total_active, total_all=total_all)


# ── GET Chi tiết ──────────────────────────────────────────────────────────────
@admin_locations_bp.route("/<loc_id>", methods=["GET"])
@admin_required
def get_location(loc_id):
    try:
        loc = mongo.db.locations.find_one({"_id": ObjectId(loc_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if not loc:
        return error_response("Địa điểm không tồn tại", 404)
    return success_response(data=serialize_location(loc))


# ── POST Thêm mới ─────────────────────────────────────────────────────────────
@admin_locations_bp.route("", methods=["POST"])
@admin_required
def create_location():
    data = request.get_json() or {}
    normalized, err = validate_and_normalize(data)
    if err:
        return error_response(err, 400 if "đã tồn tại" not in err else 409)

    now = datetime.now(timezone.utc)
    normalized["featured"]   = False
    normalized["created_at"] = now
    normalized["updated_at"] = now

    result = mongo.db.locations.insert_one(normalized)
    return success_response(
        data={"id": str(result.inserted_id)},
        message="Tạo địa điểm thành công",
        status_code=201,
    )


# ── PUT Cập nhật ──────────────────────────────────────────────────────────────
@admin_locations_bp.route("/<loc_id>", methods=["PUT"])
@admin_required
def update_location(loc_id):
    try:
        ObjectId(loc_id)
    except Exception:
        return error_response("ID không hợp lệ", 400)

    existing = mongo.db.locations.find_one({"_id": ObjectId(loc_id)})
    if not existing:
        return error_response("Địa điểm không tồn tại", 404)

    data = request.get_json() or {}
    normalized, err = validate_and_normalize(data, loc_id=loc_id)
    if err:
        return error_response(err, 400 if "đã tồn tại" not in err else 409)

    normalized["updated_at"] = datetime.now(timezone.utc)
    # Giữ nguyên featured (không cho sửa qua PUT, dùng PATCH /featured)
    normalized.pop("featured", None)

    mongo.db.locations.update_one({"_id": ObjectId(loc_id)}, {"$set": normalized})
    return success_response(message="Cập nhật địa điểm thành công")


# ── PATCH Bật / Tắt trạng thái ────────────────────────────────────────────────
@admin_locations_bp.route("/<loc_id>/status", methods=["PATCH"])
@admin_required
def update_location_status(loc_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").strip().upper()
    if new_status not in VALID_STATUSES:
        return error_response("Trạng thái không hợp lệ. Dùng ACTIVE hoặc INACTIVE", 400)
    try:
        result = mongo.db.locations.update_one(
            {"_id": ObjectId(loc_id)},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Địa điểm không tồn tại", 404)
    label = "Hoạt động" if new_status == "ACTIVE" else "Tạm ngưng"
    return success_response(message=f"Đã chuyển sang trạng thái: {label}")


# ── PATCH Bật / Tắt nổi bật (Giữ nguyên cho CMS trang chủ) ───────────────────
@admin_locations_bp.route("/<loc_id>/featured", methods=["PATCH"])
@admin_required
def toggle_featured(loc_id):
    data = request.get_json() or {}
    featured = bool(data.get("featured", False))
    try:
        result = mongo.db.locations.update_one(
            {"_id": ObjectId(loc_id)},
            {"$set": {"featured": featured, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Địa điểm không tồn tại", 404)
    return success_response(message=f"Cập nhật nổi bật: {featured}")


# ── DELETE Xóa ────────────────────────────────────────────────────────────────
@admin_locations_bp.route("/<loc_id>", methods=["DELETE"])
@admin_required
def delete_location(loc_id):
    try:
        result = mongo.db.locations.delete_one({"_id": ObjectId(loc_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Địa điểm không tồn tại", 404)
    return success_response(message="Xóa địa điểm thành công")
