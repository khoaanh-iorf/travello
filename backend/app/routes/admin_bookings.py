from flask import Blueprint, request
from bson import ObjectId
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_bookings_bp = Blueprint("admin_bookings", __name__)


def serialize_booking(b, service_type="bus"):
    return {
        "id": str(b.get("_id", "")),
        "bookingCode": b.get("bookingCode") or b.get("booking_code"),
        "orderType": b.get("orderType") or service_type.upper(),
        "tripId": b.get("tripId") or b.get("trip_id"),
        "provider": b.get("provider"),
        "providerId": b.get("providerId"),
        "tripSnapshot": b.get("tripSnapshot") or b.get("trip_snapshot", {}),
        "passengers": b.get("passengers", []),
        "seatIds": b.get("seatIds", []),
        "subtotal": b.get("subtotal", 0),
        "discountAmount": b.get("discountAmount", 0),
        "finalAmount": b.get("finalAmount", 0),
        "currency": b.get("currency", "VND"),
        "status": b.get("status"),
        "createdAt": b.get("createdAt").isoformat() if b.get("createdAt") else None,
        "serviceType": service_type,
    }


@admin_bookings_bp.route("", methods=["GET"])
@admin_required
def list_bookings():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    service = request.args.get("service", "").lower()   # bus | flight | train | all
    status = request.args.get("status", "")
    search = request.args.get("search", "").strip()

    def build_query():
        q = {}
        if status:
            q["status"] = status.upper()
        if search:
            q["$or"] = [
                {"bookingCode": {"$regex": search, "$options": "i"}},
                {"provider": {"$regex": search, "$options": "i"}},
            ]
        return q

    query = build_query()
    items = []

    if service in ("", "all", "bus"):
        bus = list(mongo.db.bookings.find(query).sort("createdAt", -1))
        items += [serialize_booking(b, "bus") for b in bus]

    if service in ("", "all", "flight"):
        flight = list(mongo.db.flight_bookings.find(query).sort("createdAt", -1))
        items += [serialize_booking(b, "flight") for b in flight]

    if service in ("", "all", "train"):
        train = list(mongo.db.rail_bookings.find(query).sort("createdAt", -1))
        items += [serialize_booking(b, "train") for b in train]

    # Sort merged list by createdAt desc
    items.sort(key=lambda x: x.get("createdAt") or "", reverse=True)
    total = len(items)
    start = (page - 1) * limit
    paged = items[start: start + limit]

    return success_response(data={
        "items": paged,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    })


@admin_bookings_bp.route("/<booking_id>", methods=["GET"])
@admin_required
def get_booking(booking_id):
    for col, svc in [("bookings", "bus"), ("flight_bookings", "flight"), ("rail_bookings", "train")]:
        try:
            b = mongo.db[col].find_one({"_id": ObjectId(booking_id)})
        except Exception:
            b = mongo.db[col].find_one({"bookingCode": booking_id})
        if b:
            data = serialize_booking(b, svc)
            # Attach tickets
            tickets = list(mongo.db.tickets.find({"bookingId": str(b["_id"])}))
            data["tickets"] = [{
                "ticketCode": t.get("ticketCode"),
                "seatId": t.get("seatId"),
                "seatNumber": t.get("seatNumber"),
                "passenger": t.get("passenger"),
                "status": t.get("status"),
                "issuedAt": t.get("issuedAt").isoformat() if t.get("issuedAt") else None,
            } for t in tickets]
            return success_response(data=data)
    return error_response("Booking không tồn tại", 404)

