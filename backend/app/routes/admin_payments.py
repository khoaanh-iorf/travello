import csv
import re
from datetime import datetime
from io import StringIO

from flask import Blueprint, make_response, request
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import error_response, success_response

admin_payments_bp = Blueprint("admin_payments", __name__)

PAYMENT_STATUSES = {"PENDING", "PAID", "FAILED"}
PAYMENT_SERVICES = {"BUS", "FLIGHT", "TRAIN"}
CSV_FIELDS = (
    "transactionCode",
    "bookingCode",
    "orderType",
    "provider",
    "userId",
    "amount",
    "currency",
    "status",
    "createdAt",
    "paidAt",
)


def build_payment_query():
    query = {}
    status = request.args.get("status", "ALL").upper()
    service = request.args.get("service", "ALL").upper()
    search = request.args.get("search", "").strip()

    if status != "ALL":
        if status not in PAYMENT_STATUSES:
            return None, error_response("Trạng thái thanh toán không hợp lệ", 400)
        query["status"] = status

    if service != "ALL":
        if service not in PAYMENT_SERVICES:
            return None, error_response("Loại dịch vụ không hợp lệ", 400)
        query["orderType"] = service

    if search:
        pattern = re.escape(search)
        query["$or"] = [
            {"bookingCode": {"$regex": pattern, "$options": "i"}},
            {"transactionCode": {"$regex": pattern, "$options": "i"}},
            {"provider": {"$regex": pattern, "$options": "i"}},
            {"userId": {"$regex": pattern, "$options": "i"}},
        ]

    return query, None


def serialize_payment(payment):
    def serialize_date(value):
        return value.isoformat() if isinstance(value, datetime) else value

    return {
        "id": str(payment.get("_id", "")),
        "transactionCode": payment.get("transactionCode"),
        "bookingCode": payment.get("bookingCode"),
        "orderType": payment.get("orderType"),
        "provider": payment.get("provider"),
        "userId": payment.get("userId"),
        "amount": payment.get("amount", payment.get("finalAmount")),
        "currency": payment.get("currency"),
        "status": payment.get("status"),
        "createdAt": serialize_date(payment.get("createdAt")),
        "paidAt": serialize_date(payment.get("paidAt")),
    }


def payment_summary(collection):
    paid = collection.count_documents({"status": "PAID"})
    pending = collection.count_documents({"status": "PENDING"})
    failed = collection.count_documents({"status": "FAILED"})
    revenue_rows = list(collection.aggregate([
        {"$match": {"status": "PAID"}},
        {"$group": {
            "_id": None,
            "revenue": {
                "$sum": {"$ifNull": ["$amount", {"$ifNull": ["$finalAmount", 0]}]}
            },
        }},
    ]))

    return {
        "total": collection.count_documents({}),
        "revenue": revenue_rows[0]["revenue"] if revenue_rows else 0,
        "pending": pending,
        "failed": failed,
        "paid": paid,
    }


@admin_payments_bp.route("", methods=["GET"])
@admin_required
def list_payments():
    query, error = build_payment_query()
    if error:
        return error

    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
    except ValueError:
        return error_response("Trang và số dòng mỗi trang phải là số nguyên", 400)

    if page < 1 or limit < 1 or limit > 100:
        return error_response("Trang phải lớn hơn 0 và số dòng mỗi trang từ 1 đến 100", 400)

    collection = mongo.db.payments
    total = collection.count_documents(query)
    items = list(
        collection.find(query)
        .sort("createdAt", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    return success_response(data={
        "items": [serialize_payment(payment) for payment in items],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "summary": payment_summary(collection),
    })


@admin_payments_bp.route("/export", methods=["GET"])
@admin_required
def export_payments():
    query, error = build_payment_query()
    if error:
        return error

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_FIELDS)
    payments = mongo.db.payments.find(query).sort("createdAt", -1)
    for payment in payments:
        serialized = serialize_payment(payment)
        writer.writerow([serialized[field] for field in CSV_FIELDS])

    response = make_response("\ufeff" + output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = 'attachment; filename="payments.csv"'
    return response
