from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt, jwt_required
import bcrypt
from datetime import datetime, timezone
from pymongo.errors import PyMongoError
from app.extensions import mongo
from app.utils.response import success_response, error_response

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return error_response("Email và mật khẩu không được để trống", 400)

    try:
        user = mongo.db.users.find_one({"email": email})
    except PyMongoError:
        current_app.logger.exception("MongoDB lookup failed during admin login")
        return error_response("Dịch vụ dữ liệu tạm thời không khả dụng", 503)
    if not user:
        return error_response("Email hoặc mật khẩu không đúng", 401)

    if user.get("role") != "ADMIN":
        return error_response("Tài khoản không có quyền quản trị", 403)

    if user.get("status") == "LOCKED":
        return error_response("Tài khoản đã bị khóa", 403)

    stored_pw = user.get("password", "")
    if isinstance(stored_pw, str):
        stored_pw = stored_pw.encode("utf-8")
    if not bcrypt.checkpw(password.encode("utf-8"), stored_pw):
        return error_response("Email hoặc mật khẩu không đúng", 401)

    token = create_access_token(identity=email)
    return success_response(
        data={
            "token": token,
            "admin": {
                "id": str(user["_id"]),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role"),
            },
        },
        message="Đăng nhập thành công",
    )


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt().get("jti")
    mongo.db.revoked_tokens.insert_one({
        "jti": jti,
        "created_at": datetime.now(timezone.utc),
    })
    return success_response(message="Đăng xuất thành công")
