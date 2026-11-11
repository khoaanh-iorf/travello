from flask import Flask
from flask_cors import CORS
from config import Config
from app.extensions import jwt, mongo
from app.routes.auth import auth_bp
from app.routes.admin_users import admin_users_bp
from app.routes.admin_bookings import admin_bookings_bp
from app.routes.admin_suppliers import admin_suppliers_bp
from app.routes.admin_locations import admin_locations_bp
from app.routes.admin_promotions import admin_promotions_bp
from app.routes.admin_reports import admin_reports_bp
from app.routes.admin_support import admin_support_bp
from app.routes.admin_cms import admin_cms_bp
from app.routes.admin_payments import admin_payments_bp
from app.middleware.error_handler import register_error_handlers


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Extensions — allow all origins in development
    CORS(app, origins="*", supports_credentials=False)
    jwt.init_app(app)
    mongo.init_app(app, serverSelectionTimeoutMS=10000)

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_users_bp, url_prefix="/api/admin/users")
    app.register_blueprint(admin_bookings_bp, url_prefix="/api/admin/bookings")
    app.register_blueprint(admin_suppliers_bp, url_prefix="/api/admin/suppliers")
    app.register_blueprint(admin_locations_bp, url_prefix="/api/admin/locations")
    app.register_blueprint(admin_promotions_bp, url_prefix="/api/admin/promotions")
    app.register_blueprint(admin_reports_bp, url_prefix="/api/admin/reports")
    app.register_blueprint(admin_support_bp, url_prefix="/api/admin/support")
    app.register_blueprint(admin_cms_bp, url_prefix="/api/admin/cms")
    app.register_blueprint(admin_payments_bp, url_prefix="/api/admin/payments")

    register_error_handlers(app)

    return app
