from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_promotions_bp = Blueprint("admin_promotions", __name__)


def serialize_promo(p):
    return {
        "id": str(p["_id"]),
        "code": p.get("code"),
        "type": p.get("type"),              # PERCENT | FIXED
        "value": p.get("value", 0),
        "minOrderAmount": p.get("minOrderAmount", 0),
        "maxDiscount": p.get("maxDiscount"),
        "startDate": p.get("startDate").isoformat() if p.get("startDate") else None,
        "endDate": p.get("endDate").isoformat() if p.get("endDate") else None,
        "usageLimit": p.get("usageLimit"),
        "usedCount": p.get("usedCount", 0),
        "status": p.get("status", "ACTIVE"),
        "description": p.get("description"),
    }


@admin_promotions_bp.route("", methods=["GET"])
@admin_required
def list_promotions():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "")

    query = {}
    if search:
        query["code"] = {"$regex": search, "$options": "i"}
    if status:
        query["status"] = status.upper()

    result = paginate(mongo.db.promotions, query, page, limit)
    result["items"] = [serialize_promo(p) for p in result["items"]]
    return success_response(data=result)


@admin_promotions_bp.route("", methods=["POST"])
@admin_required
def create_promotion():
    data = request.get_json() or {}
    if not data.get("code") or not data.get("type") or data.get("value") is None:
        return error_response("Mã, loại và giá trị giảm là bắt buộc", 400)
    existing = mongo.db.promotions.find_one({"code": data["code"].upper()})
    if existing:
        return error_response("Mã giảm giá đã tồn tại", 409)
    data["code"] = data["code"].upper()
    data.setdefault("status", "ACTIVE")
    data.setdefault("usedCount", 0)
    data["created_at"] = datetime.now(timezone.utc)
    result = mongo.db.promotions.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo mã giảm giá thành công", status_code=201)


@admin_promotions_bp.route("/<promo_id>", methods=["PUT"])
@admin_required
def update_promotion(promo_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = mongo.db.promotions.update_one({"_id": ObjectId(promo_id)}, {"$set": data})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Mã giảm giá không tồn tại", 404)
    return success_response(message="Cập nhật thành công")


@admin_promotions_bp.route("/<promo_id>", methods=["DELETE"])
@admin_required
def delete_promotion(promo_id):
    try:
        result = mongo.db.promotions.delete_one({"_id": ObjectId(promo_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Mã giảm giá không tồn tại", 404)
    return success_response(message="Xóa thành công")


@admin_promotions_bp.route("/<promo_id>/status", methods=["PATCH"])
@admin_required
def update_status(promo_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    if new_status not in ("ACTIVE", "INACTIVE"):
        return error_response("Trạng thái không hợp lệ", 400)
    try:
        result = mongo.db.promotions.update_one(
            {"_id": ObjectId(promo_id)},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Mã không tồn tại", 404)
    return success_response(message=f"Cập nhật trạng thái thành {new_status}")

