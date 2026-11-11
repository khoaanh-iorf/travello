from functools import wraps
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from app.utils.response import error_response
from app.extensions import mongo


def admin_required(fn):
    """Decorator: require valid JWT + role == ADMIN + token not revoked."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return error_response("Token không hợp lệ hoặc đã hết hạn", 401)

        jti = get_jwt().get("jti")
        revoked = mongo.db.revoked_tokens.find_one({"jti": jti})
        if revoked:
            return error_response("Token đã bị thu hồi", 401)

        identity = get_jwt_identity()
        user = mongo.db.users.find_one({"email": identity})
        if not user or user.get("role") != "ADMIN":
            return error_response("Không có quyền truy cập", 403)

        return fn(*args, **kwargs)
    return wrapper

