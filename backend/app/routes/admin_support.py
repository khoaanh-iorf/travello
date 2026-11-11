from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_support_bp = Blueprint("admin_support", __name__)


def serialize_ticket(t):
    return {
        "id": str(t["_id"]),
        "ticketCode": t.get("ticketCode"),
        "userId": str(t.get("userId", "")),
        "subject": t.get("subject"),
        "message": t.get("message"),
        "status": t.get("status", "OPEN"),    # OPEN | IN_PROGRESS | RESOLVED | CLOSED
        "replies": t.get("replies", []),
        "createdAt": t.get("createdAt").isoformat() if t.get("createdAt") else None,
        "updatedAt": t.get("updatedAt").isoformat() if t.get("updatedAt") else None,
    }


@admin_support_bp.route("", methods=["GET"])
@admin_required
def list_tickets():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    status = request.args.get("status", "")
    search = request.args.get("search", "").strip()

    query = {}
    if status:
        query["status"] = status.upper()
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"ticketCode": {"$regex": search, "$options": "i"}},
        ]

    result = paginate(mongo.db.support_tickets, query, page, limit, "createdAt", -1)
    result["items"] = [serialize_ticket(t) for t in result["items"]]
    return success_response(data=result)


@admin_support_bp.route("/<ticket_id>", methods=["GET"])
@admin_required
def get_ticket(ticket_id):
    try:
        t = mongo.db.support_tickets.find_one({"_id": ObjectId(ticket_id)})
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if not t:
        return error_response("Ticket không tồn tại", 404)
    return success_response(data=serialize_ticket(t))


@admin_support_bp.route("/<ticket_id>/status", methods=["PATCH"])
@admin_required
def update_status(ticket_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    valid = ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
    if new_status not in valid:
        return error_response(f"Trạng thái phải là: {', '.join(valid)}", 400)
    try:
        result = mongo.db.support_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}},
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Ticket không tồn tại", 404)
    return success_response(message=f"Cập nhật trạng thái thành {new_status}")


@admin_support_bp.route("/<ticket_id>/reply", methods=["POST"])
@admin_required
def reply_ticket(ticket_id):
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    if not message:
        return error_response("Nội dung phản hồi không được để trống", 400)
    reply = {
        "sender": "ADMIN",
        "message": message,
        "sentAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        result = mongo.db.support_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"replies": reply},
                "$set": {"status": "IN_PROGRESS", "updatedAt": datetime.now(timezone.utc)},
            },
        )
    except Exception:
        return error_response("ID không hợp lệ", 400)
    if result.matched_count == 0:
        return error_response("Ticket không tồn tại", 404)
    return success_response(message="Phản hồi đã được gửi")

