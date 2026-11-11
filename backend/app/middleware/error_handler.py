from app.utils.response import error_response
from pymongo.errors import PyMongoError


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        return error_response("Không tìm thấy tài nguyên", 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("Phương thức không được hỗ trợ", 405)

    @app.errorhandler(500)
    def internal_error(e):
        if isinstance(getattr(e, "original_exception", None), PyMongoError):
            app.logger.error("MongoDB request failed")
            return error_response("Dịch vụ dữ liệu tạm thời không khả dụng", 503)
        return error_response("Lỗi máy chủ nội bộ", 500)
