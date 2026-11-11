from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_locations_bp = Blueprint("admin_locations", __name__)


def serialize_location(loc):
    return {
        "id": str(loc["_id"]),
        "code": loc.get("code"),
        "name": loc.get("name"),
        "city": loc.get("city"),
        "country": loc.get("country", "VN"),
        "type": loc.get("type"),        # airport | station | city
        "featured": loc.get("featured", False),
        "status": loc.get("status", "ACTIVE"),
    }


@admin_locations_bp.route("", methods=["GET"])
@admin_required
def list_locations():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "").strip()
    loc_type = request.args.get("type", "")

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]
    if loc_type:
        query["type"] = loc_type

    result = paginate(mongo.db.locations, query, page, limit)
    result["items"] = [serialize_location(l) for l in result["items"]]
    return success_response(data=result)


@admin_locations_bp.route("", methods=["POST"])
@admin_required
def create_location():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("code"):
        return error_response("Tên và mã địa điểm là bắt buộc", 400)
    data.setdefault("status", "ACTIVE")
    data.setdefault("featured", False)
    data["created_at"] = datetime.now(timezone.utc)
    result = mongo.db.locations.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo địa điểm thành công", status_code=201)


@admin_locations_bp.route("/<loc_id>", methods=["PUT"])
@admin_required
def update_location(loc_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = mongo.db.locations.update_one({"_id": ObjectId(loc_id)}, {"$set": data})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Địa điểm không tồn tại", 404)
    return success_response(message="Cập nhật thành công")


@admin_locations_bp.route("/<loc_id>", methods=["DELETE"])
@admin_required
def delete_location(loc_id):
    try:
        result = mongo.db.locations.delete_one({"_id": ObjectId(loc_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Địa điểm không tồn tại", 404)
    return success_response(message="Xóa thành công")


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
    return success_response(message=f"Cập nhật featured = {featured}")

