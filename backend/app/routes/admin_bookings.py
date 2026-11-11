import re
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request
from bson import ObjectId
from bson.errors import InvalidId
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_bookings_bp = Blueprint("admin_bookings", __name__)

BOOKING_COLLECTIONS = {
    "bus": ("bookings", "trips"),
    "flight": ("flight_bookings", "flight_trips"),
    "train": ("rail_bookings", "rail_trips"),
}


def id_variants(value):
    try:
        return [value, ObjectId(value)]
    except (InvalidId, TypeError, ValueError):
        return [value]


def parse_date_range(date_from, date_to):
    date_filter = {}
    try:
        if date_from:
            parsed_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$gte"] = parsed_from
        if date_to:
            parsed_to = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            date_filter["$lt"] = parsed_to + timedelta(days=1)
    except ValueError:
        return None, "Ngày phải có định dạng YYYY-MM-DD"
    if date_from and date_to and date_from > date_to:
        return None, "Ngày bắt đầu không được sau ngày kết thúc"
    return date_filter, None


def serialize_booking(b, service_type="bus"):
    trip_id = b.get("tripId") or b.get("trip_id")
    return {
        "id": str(b.get("_id", "")),
        "bookingCode": b.get("bookingCode") or b.get("booking_code"),
        "orderType": b.get("orderType") or service_type.upper(),
        "tripId": str(trip_id) if trip_id is not None else None,
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


def serialize_booking_payment(booking):
    conditions = []
    booking_code = booking.get("bookingCode") or booking.get("booking_code")
    if booking_code:
        conditions.append({"bookingCode": booking_code})
    booking_id = str(booking.get("_id", ""))
    if booking_id:
        conditions.extend([
            {"bookingId": booking_id},
            {"booking_id": booking_id},
        ])
        parsed_id = ObjectId(booking_id) if ObjectId.is_valid(booking_id) else None
        if parsed_id is not None:
            conditions.extend([
                {"bookingId": parsed_id},
                {"booking_id": parsed_id},
            ])
    if not conditions:
        return None

    payment = mongo.db.payments.find_one({"$or": conditions}, sort=[("createdAt", -1)])
    if not payment:
        return None

    def serialize_date(value):
        return value.isoformat() if hasattr(value, "isoformat") else value

    return {
        "transactionCode": payment.get("transactionCode"),
        "status": payment.get("status"),
        "amount": payment.get("amount", payment.get("finalAmount")),
        "currency": payment.get("currency", "VND"),
        "createdAt": serialize_date(payment.get("createdAt")),
        "paidAt": serialize_date(payment.get("paidAt")),
    }


def booking_totals_by_service():
    totals = {
        service: mongo.db[booking_collection].count_documents({})
        for service, (booking_collection, _) in BOOKING_COLLECTIONS.items()
    }
    totals["all"] = sum(totals.values())
    return totals


@admin_bookings_bp.route("", methods=["GET"])
@admin_required
def list_bookings():
    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = min(max(int(request.args.get("limit", 10)), 1), 100)
    except ValueError:
        return error_response("Trang và số dòng mỗi trang phải là số nguyên", 400)
    service = request.args.get("service", "").lower()   # bus | flight | train | all
    status = request.args.get("status", "")
    search = request.args.get("search", "").strip()
    trip_id = request.args.get("tripId", "").strip()
    route_id = request.args.get("routeId", "").strip()
    date_from = request.args.get("dateFrom", "").strip()
    date_to = request.args.get("dateTo", "").strip()

    date_filter, date_error = parse_date_range(date_from, date_to)
    if date_error:
        return error_response(date_error, 400)
    if trip_id and not ObjectId.is_valid(trip_id):
        return error_response("Mã chuyến không hợp lệ", 400)
    if route_id and not ObjectId.is_valid(route_id):
        return error_response("Mã tuyến không hợp lệ", 400)

    trip_filter_active = bool(trip_id or route_id or date_filter)
    matching_trip_ids = []
    if trip_filter_active:
        services = [service] if service in BOOKING_COLLECTIONS else list(BOOKING_COLLECTIONS)
        for trip_service in services:
            _, trip_collection = BOOKING_COLLECTIONS[trip_service]
            trip_query = {}
            if trip_id:
                trip_query["_id"] = {"$in": id_variants(trip_id)}
            if route_id:
                trip_query["routeId"] = {"$in": id_variants(route_id)}
            if date_filter:
                trip_query["departureTime"] = date_filter
            matching_trip_ids.extend(
                trip["_id"] for trip in mongo.db[trip_collection].find(trip_query, {"_id": 1})
            )
        if not matching_trip_ids:
            return success_response(data={
                "items": [], "total": 0, "page": page, "limit": limit, "total_pages": 0,
                "totals_by_service": booking_totals_by_service(),
            })

    def build_query():
        clauses = []
        if status:
            clauses.append({"status": status.upper()})
        if search:
            pattern = re.escape(search)
            clauses.append({"$or": [
                {"bookingCode": {"$regex": pattern, "$options": "i"}},
                {"booking_code": {"$regex": pattern, "$options": "i"}},
                {"provider": {"$regex": pattern, "$options": "i"}},
            ]})
        if trip_filter_active:
            booking_trip_ids = []
            for matched_trip_id in matching_trip_ids:
                booking_trip_ids.extend(id_variants(str(matched_trip_id)))
            clauses.append({"$or": [
                {"tripId": {"$in": booking_trip_ids}},
                {"trip_id": {"$in": booking_trip_ids}},
            ]})
        return {"$and": clauses} if clauses else {}

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
        "totals_by_service": booking_totals_by_service(),
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
            data["payment"] = serialize_booking_payment(b)
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
