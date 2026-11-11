from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_suppliers_bp = Blueprint("admin_suppliers", __name__)


def serialize_provider(p):
    return {
        "id": str(p["_id"]),
        "providerId": p.get("providerId"),
        "name": p.get("name"),
        "type": p.get("type"),          # BUS | FLIGHT | TRAIN
        "logo": p.get("logo"),
        "phone": p.get("phone"),
        "email": p.get("email"),
        "address": p.get("address"),
        "status": p.get("status", "ACTIVE"),
        "created_at": p.get("created_at").isoformat() if p.get("created_at") else None,
    }


@admin_suppliers_bp.route("", methods=["GET"])
@admin_required
def list_providers():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "").strip()
    ptype = request.args.get("type", "")

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if ptype:
        query["type"] = ptype.upper()

    result = paginate(mongo.db.providers, query, page, limit)
    result["items"] = [serialize_provider(p) for p in result["items"]]
    return success_response(data=result)


@admin_suppliers_bp.route("", methods=["POST"])
@admin_required
def create_provider():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("type"):
        return error_response("Tên và loại nhà cung cấp là bắt buộc", 400)
    data["status"] = "ACTIVE"
    data["created_at"] = datetime.now(timezone.utc)
    result = mongo.db.providers.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo nhà cung cấp thành công", status_code=201)


@admin_suppliers_bp.route("/<provider_id>", methods=["PUT"])
@admin_required
def update_provider(provider_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = mongo.db.providers.update_one({"_id": ObjectId(provider_id)}, {"$set": data})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    return success_response(message="Cập nhật thành công")


@admin_suppliers_bp.route("/<provider_id>", methods=["DELETE"])
@admin_required
def delete_provider(provider_id):
    try:
        result = mongo.db.providers.delete_one({"_id": ObjectId(provider_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    return success_response(message="Xóa thành công")


@admin_suppliers_bp.route("/<provider_id>/status", methods=["PATCH"])
@admin_required
def update_status(provider_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    if new_status not in ("ACTIVE", "INACTIVE"):
        return error_response("Trạng thái không hợp lệ", 400)
    try:
        result = mongo.db.providers.update_one(
            {"_id": ObjectId(provider_id)},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    return success_response(message=f"Cập nhật trạng thái thành {new_status}")

