from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_cms_bp = Blueprint("admin_cms", __name__)


# ─── BANNERS ────────────────────────────────────────────────────────────────

@admin_cms_bp.route("/banners", methods=["GET"])
@admin_required
def list_banners():
    banners = list(mongo.db.banners.find({}).sort("order", 1))
    for b in banners:
        b["id"] = str(b.pop("_id"))
    return success_response(data=banners)


@admin_cms_bp.route("/banners", methods=["POST"])
@admin_required
def create_banner():
    data = request.get_json() or {}
    data.setdefault("status", "ACTIVE")
    data.setdefault("order", 99)
    data["created_at"] = datetime.now(timezone.utc)
    result = mongo.db.banners.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo banner thành công", status_code=201)


@admin_cms_bp.route("/banners/<banner_id>", methods=["PUT"])
@admin_required
def update_banner(banner_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = mongo.db.banners.update_one({"_id": ObjectId(banner_id)}, {"$set": data})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Banner không tồn tại", 404)
    return success_response(message="Cập nhật banner thành công")


@admin_cms_bp.route("/banners/<banner_id>", methods=["DELETE"])
@admin_required
def delete_banner(banner_id):
    try:
        result = mongo.db.banners.delete_one({"_id": ObjectId(banner_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Banner không tồn tại", 404)
    return success_response(message="Xóa banner thành công")


# ─── BLOGS ──────────────────────────────────────────────────────────────────

@admin_cms_bp.route("/blogs", methods=["GET"])
@admin_required
def list_blogs():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    result = paginate(mongo.db.blogs, {}, page, limit, "createdAt", -1)
    for item in result["items"]:
        item["id"] = str(item.pop("_id"))
    return success_response(data=result)


@admin_cms_bp.route("/blogs", methods=["POST"])
@admin_required
def create_blog():
    data = request.get_json() or {}
    if not data.get("title"):
        return error_response("Tiêu đề bài viết là bắt buộc", 400)
    data.setdefault("published", False)
    data["createdAt"] = datetime.now(timezone.utc)
    result = mongo.db.blogs.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo bài viết thành công", status_code=201)


@admin_cms_bp.route("/blogs/<blog_id>", methods=["PUT"])
@admin_required
def update_blog(blog_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    data["updatedAt"] = datetime.now(timezone.utc)
    try:
        result = mongo.db.blogs.update_one({"_id": ObjectId(blog_id)}, {"$set": data})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Bài viết không tồn tại", 404)
    return success_response(message="Cập nhật bài viết thành công")


@admin_cms_bp.route("/blogs/<blog_id>", methods=["DELETE"])
@admin_required
def delete_blog(blog_id):
    try:
        result = mongo.db.blogs.delete_one({"_id": ObjectId(blog_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.deleted_count == 0:
        return error_response("Bài viết không tồn tại", 404)
    return success_response(message="Xóa bài viết thành công")

