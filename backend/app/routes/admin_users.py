from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_users_bp = Blueprint("admin_users", __name__)


def serialize_user(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "role": u.get("role"),
        "status": u.get("status", "ACTIVE"),
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }


@admin_users_bp.route("", methods=["GET"])
@admin_required
def list_users():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "").strip()
    role = request.args.get("role", "")
    status = request.args.get("status", "")

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if role:
        query["role"] = role.upper()
    if status:
        query["status"] = status.upper()

    result = paginate(mongo.db.users, query, page, limit, "created_at", -1)
    result["items"] = [serialize_user(u) for u in result["items"]]
    total_accounts = mongo.db.users.count_documents({})

    return success_response(data=result, total_accounts=total_accounts)


@admin_users_bp.route("/<user_id>", methods=["GET"])
@admin_required
def get_user(user_id):
    try:
        u = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if not u:
        return error_response("Người dùng không tồn tại", 404)
    return success_response(data=serialize_user(u))


@admin_users_bp.route("/<user_id>/status", methods=["PATCH"])
@admin_required
def update_status(user_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    if new_status not in ("ACTIVE", "LOCKED"):
        return error_response("Trạng thái không hợp lệ. Dùng ACTIVE hoặc LOCKED", 400)
    try:
        result = mongo.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Người dùng không tồn tại", 404)
    return success_response(message=f"Đã cập nhật trạng thái thành {new_status}")

