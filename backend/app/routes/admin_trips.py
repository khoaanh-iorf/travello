"""
admin_trips.py — Quản lý chuyến chạy / lịch chạy (Trip Management)
Hỗ trợ 3 loại: BUS (trips), FLIGHT (flight_trips), TRAIN (rail_trips)
"""

import re
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, request

from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.pagination import paginate
from app.utils.response import error_response, success_response

admin_trips_bp = Blueprint("admin_trips", __name__)

VALID_SERVICE_TYPES = {"BUS", "FLIGHT", "TRAIN"}
VALID_STATUSES = {"SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"}

# Mapping collection: serviceType → (trip_col, booking_col)
TRIP_COLLECTIONS = {
    "BUS":    ("trips",        "bookings"),
    "FLIGHT": ("flight_trips", "flight_bookings"),
    "TRAIN":  ("rail_trips",   "rail_bookings"),
}

# Trạng thái hợp lệ có thể chuyển sang
STATUS_TRANSITIONS = {
    "SCHEDULED":  {"RUNNING", "CANCELLED"},
    "RUNNING":    {"COMPLETED"},
    "COMPLETED":  set(),
    "CANCELLED":  set(),
}

# Các trường được bảo vệ khi đã có vé xác nhận
PROTECTED_FIELDS = {"departureTime", "arrivalTime", "routeId", "vehicleId", "basePrice"}

BOOKING_CONFIRMED_STATUSES = {"CONFIRMED", "PAID"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError, ValueError):
        return None


def id_variants(value):
    """Trả về cả dạng string và ObjectId để tìm cả hai format trong MongoDB."""
    parsed = to_object_id(value)
    return [value, parsed] if parsed is not None else [value]


def get_trip_col(service_type):
    return TRIP_COLLECTIONS[service_type][0]


def get_booking_col(service_type):
    return TRIP_COLLECTIONS[service_type][1]


def count_confirmed_bookings(service_type, trip_id_str):
    """Đếm booking CONFIRMED/PAID, hỗ trợ cả field tripId và trip_id."""
    booking_col = get_booking_col(service_type)
    id_vars = id_variants(trip_id_str)
    count = mongo.db[booking_col].count_documents({
        "$or": [
            {"tripId": {"$in": id_vars}, "status": {"$in": list(BOOKING_CONFIRMED_STATUSES)}},
            {"trip_id": {"$in": id_vars}, "status": {"$in": list(BOOKING_CONFIRMED_STATUSES)}},
        ]
    })
    return count


def count_total_bookings(service_type, trip_id_str):
    """Đếm tổng booking (mọi trạng thái), hỗ trợ cả tripId và trip_id."""
    booking_col = get_booking_col(service_type)
    id_vars = id_variants(trip_id_str)
    return mongo.db[booking_col].count_documents({
        "$or": [
            {"tripId": {"$in": id_vars}},
            {"trip_id": {"$in": id_vars}},
        ]
    })


def count_confirmed_seats(service_type, trip_id_str):
    """Count reserved seats, not booking documents, for confirmed bookings."""
    booking_col = get_booking_col(service_type)
    id_vars = id_variants(trip_id_str)
    passenger_count = {
        "$cond": [
            {"$isArray": "$passengers"},
            {
                "$cond": [
                    {"$gt": [{"$size": "$passengers"}, 0]},
                    {"$size": "$passengers"},
                    1,
                ]
            },
            1,
        ]
    }
    seat_count = {
        "$cond": [
            {"$isArray": "$seatIds"},
            {
                "$cond": [
                    {"$gt": [{"$size": "$seatIds"}, 0]},
                    {"$size": "$seatIds"},
                    passenger_count,
                ]
            },
            passenger_count,
        ]
    }
    rows = list(mongo.db[booking_col].aggregate([
        {"$match": {
            "$or": [
                {"tripId": {"$in": id_vars}, "status": {"$in": list(BOOKING_CONFIRMED_STATUSES)}},
                {"trip_id": {"$in": id_vars}, "status": {"$in": list(BOOKING_CONFIRMED_STATUSES)}},
            ]
        }},
        {"$project": {
            "seatCount": seat_count
        }},
        {"$group": {"_id": None, "total": {"$sum": "$seatCount"}}},
    ]))
    return rows[0]["total"] if rows else 0


def get_trip_code(trip):
    """Lấy mã/số hiệu chuyến bất kể loại."""
    return (
        trip.get("tripCode")
        or trip.get("flightNumber")
        or trip.get("trainNumber")
        or ""
    )


def auto_generate_trip_code(service_type, route):
    """Tự sinh mã chuyến BUS dạng BUS-ORIG-DEST-YYYYMMDD-SEQ."""
    if service_type != "BUS":
        return None

    origin_id = route.get("originLocationId", "")
    dest_id = route.get("destinationLocationId", "")

    origin = mongo.db.locations.find_one({"_id": to_object_id(origin_id)}) if to_object_id(origin_id) else None
    dest = mongo.db.locations.find_one({"_id": to_object_id(dest_id)}) if to_object_id(dest_id) else None

    orig_code = (origin.get("code") if origin else None) or origin_id[:4].upper()
    dest_code = (dest.get("code") if dest else None) or dest_id[:4].upper()
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"BUS-{orig_code}-{dest_code}-{date_str}"

    # Tìm SEQ cao nhất hiện tại
    pattern = re.compile(f"^{re.escape(prefix)}-")
    existing = mongo.db.trips.find({"tripCode": pattern}, {"tripCode": 1})
    seqs = []
    for doc in existing:
        code = doc.get("tripCode", "")
        parts = code.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            seqs.append(int(parts[1]))
    next_seq = (max(seqs) + 1) if seqs else 1
    return f"{prefix}-{next_seq:03d}"


def serialize_trip(trip, service_type, include_bookings=False):
    """Chuyển document MongoDB thành dict JSON-safe."""
    trip_id_str = str(trip["_id"])
    trip_col, booking_col = TRIP_COLLECTIONS[service_type]

    booked_count = count_confirmed_seats(service_type, trip_id_str)
    seat_capacity = trip.get("seatCapacity", 0)
    remaining = max(seat_capacity - booked_count, 0)

    # Lấy thông tin tuyến
    route_id = trip.get("routeId", "")
    route = mongo.db.routes.find_one({"_id": to_object_id(route_id)}) if to_object_id(route_id) else None

    # Lấy tên điểm đầu/cuối
    origin_name = None
    dest_name = None
    if route:
        origin = mongo.db.locations.find_one({"_id": to_object_id(str(route.get("originLocationId", "")))})
        dest = mongo.db.locations.find_one({"_id": to_object_id(str(route.get("destinationLocationId", "")))})
        origin_name = origin.get("name") if origin else None
        dest_name = dest.get("name") if dest else None

    # Lấy tên nhà cung cấp
    provider_id = trip.get("providerId", "")
    provider = mongo.db.providers.find_one({"_id": to_object_id(provider_id)}) if to_object_id(provider_id) else None
    dep = trip.get("departureTime")
    arr = trip.get("arrivalTime")

    data = {
        "id": trip_id_str,
        "serviceType": service_type,
        "tripCode": get_trip_code(trip),
        "routeId": route_id,
        "originName": origin_name,
        "destinationName": dest_name,
        "providerId": provider_id,
        "providerName": provider.get("name") if provider else None,
        "vehicleId": trip.get("vehicleId"),
        "departureTime": dep.isoformat() if hasattr(dep, "isoformat") else dep,
        "arrivalTime": arr.isoformat() if hasattr(arr, "isoformat") else arr,
        "basePrice": trip.get("basePrice", 0),
        "seatCapacity": seat_capacity,
        "bookedCount": booked_count,
        "remaining": remaining,
        "status": trip.get("status", "SCHEDULED"),
        "createdAt": trip["createdAt"].isoformat() if trip.get("createdAt") else None,
        "updatedAt": trip["updatedAt"].isoformat() if trip.get("updatedAt") else None,
    }

    if include_bookings:
        id_vars = id_variants(trip_id_str)
        raw_bookings = list(mongo.db[booking_col].find({
            "$or": [
                {"tripId": {"$in": id_vars}},
                {"trip_id": {"$in": id_vars}},
            ]
        }).sort("createdAt", -1).limit(50))

        bookings_out = []
        for b in raw_bookings:
            bookings_out.append({
                "id": str(b["_id"]),
                "bookingCode": b.get("bookingCode") or b.get("booking_code") or str(b["_id"])[:8].upper(),
                "passengerName": b.get("passengerName") or b.get("passenger_name") or b.get("contactName"),
                "phone": b.get("phone") or b.get("contactPhone"),
                "status": b.get("status"),
                "finalAmount": b.get("finalAmount") or b.get("final_amount") or b.get("totalAmount") or 0,
                "createdAt": b["createdAt"].isoformat() if b.get("createdAt") else None,
            })
        data["bookings"] = bookings_out
        data["totalBookings"] = count_total_bookings(service_type, trip_id_str)

    return data


def build_query(args):
    """Xây dựng MongoDB query từ request args."""
    query = {}

    status = args.get("status", "").strip().upper()
    if status:
        if status not in VALID_STATUSES:
            return None, "Trạng thái chuyến không hợp lệ"
        query["status"] = status

    route_id = args.get("routeId", "").strip()
    if route_id:
        query["routeId"] = {"$in": id_variants(route_id)}

    provider_id = args.get("supplierId", "").strip()
    if provider_id:
        query["providerId"] = {"$in": id_variants(provider_id)}

    date_from = args.get("dateFrom", "").strip()
    date_to = args.get("dateTo", "").strip()
    if date_from or date_to:
        date_filter = {}
        parsed_from = None
        parsed_to = None
        if date_from:
            try:
                parsed_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                return None, "Ngày bắt đầu phải có định dạng YYYY-MM-DD"
        if date_to:
            try:
                parsed_to = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                return None, "Ngày kết thúc phải có định dạng YYYY-MM-DD"
        if parsed_from and parsed_to and parsed_from > parsed_to:
            return None, "Ngày bắt đầu không được sau ngày kết thúc"
        if parsed_from:
            date_filter["$gte"] = parsed_from
        if parsed_to:
            date_filter["$lt"] = parsed_to + timedelta(days=1)
        if date_filter:
            query["departureTime"] = date_filter

    search = args.get("search", "").strip()
    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"tripCode": pattern},
            {"flightNumber": pattern},
            {"trainNumber": pattern},
        ]

    return query, None


# ---------------------------------------------------------------------------
# GET /api/admin/trips — Danh sách chuyến
# ---------------------------------------------------------------------------

@admin_trips_bp.route("", methods=["GET"])
@admin_required
def list_trips():
    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = min(max(int(request.args.get("limit", 10)), 1), 100)
    except ValueError:
        return error_response("Trang và số dòng mỗi trang phải là số nguyên", 400)
    service_type = request.args.get("serviceType", "").strip().upper()
    if service_type and service_type not in VALID_SERVICE_TYPES:
        return error_response("Loại phương tiện không hợp lệ", 400)

    query, error = build_query(request.args)
    if error:
        return error_response(error, 400)

    if service_type and service_type in VALID_SERVICE_TYPES:
        # Lấy từ đúng collection
        trip_col = get_trip_col(service_type)
        result = paginate(mongo.db[trip_col], query, page, limit, "departureTime", 1)
        result["items"] = [serialize_trip(t, service_type) for t in result["items"]]
    else:
        # Fetch enough sorted records from each collection for an accurate merged page.
        offset = (page - 1) * limit
        fetch_limit = offset + limit
        all_trips = []
        total = 0
        for stype in ["BUS", "FLIGHT", "TRAIN"]:
            col = get_trip_col(stype)
            collection = mongo.db[col]
            total += collection.count_documents(query)
            trips = list(collection.find(query).sort("departureTime", 1).limit(fetch_limit))
            all_trips.extend((trip, stype) for trip in trips)

        all_trips.sort(key=lambda item: (
            item[0].get("departureTime").isoformat()
            if hasattr(item[0].get("departureTime"), "isoformat")
            else str(item[0].get("departureTime") or "")
        ))
        page_trips = all_trips[offset:offset + limit]
        result = {
            "items": [serialize_trip(trip, stype) for trip, stype in page_trips],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max((total + limit - 1) // limit, 1),
        }

    return success_response(data=result)


# ---------------------------------------------------------------------------
# POST /api/admin/trips — Tạo chuyến mới
# ---------------------------------------------------------------------------

@admin_trips_bp.route("", methods=["POST"])
@admin_required
def create_trip():
    data = request.get_json() or {}

    service_type = str(data.get("serviceType", "")).strip().upper()
    if service_type not in VALID_SERVICE_TYPES:
        return error_response("Loại phương tiện không hợp lệ. Dùng BUS, FLIGHT hoặc TRAIN", 400)

    # Validate routeId
    route_id = str(data.get("routeId", "")).strip()
    route_oid = to_object_id(route_id)
    if not route_oid:
        return error_response("routeId không hợp lệ", 400)
    route = mongo.db.routes.find_one({"_id": route_oid})
    if not route:
        return error_response("Tuyến không tồn tại", 404)
    if route.get("status") != "ACTIVE":
        return error_response("Tuyến đang tạm ngừng, không thể tạo chuyến", 400)
    if route.get("serviceType") != service_type:
        return error_response("Loại phương tiện không khớp với tuyến đã chọn", 400)

    # Validate supplierId
    provider_id = str(data.get("supplierId", "")).strip()
    provider_oid = to_object_id(provider_id)
    if not provider_oid:
        return error_response("supplierId không hợp lệ", 400)
    provider = mongo.db.providers.find_one({"_id": provider_oid})
    if not provider or provider.get("status") != "ACTIVE":
        return error_response("Nhà cung cấp không tồn tại hoặc đang tạm ngừng", 400)
    if str(provider.get("type", "")).upper() != service_type:
        return error_response("Loại nhà cung cấp không khớp với loại phương tiện", 400)
    if str(route.get("supplierId", "")) != provider_id:
        return error_response("Nhà cung cấp không khớp với tuyến đã chọn", 400)

    # Validate thời gian
    dep_raw = data.get("departureTime")
    arr_raw = data.get("arrivalTime")
    if not dep_raw or not arr_raw:
        return error_response("Vui lòng nhập giờ khởi hành và giờ đến", 400)
    try:
        dep_dt = datetime.fromisoformat(str(dep_raw).replace("Z", "+00:00"))
        arr_dt = datetime.fromisoformat(str(arr_raw).replace("Z", "+00:00"))
    except ValueError:
        return error_response("Định dạng thời gian không hợp lệ (dùng ISO 8601)", 400)
    if dep_dt >= arr_dt:
        return error_response("Giờ khởi hành phải trước giờ đến", 400)

    # Validate giá và sức chứa
    try:
        base_price = float(data.get("basePrice", 0))
        seat_capacity = int(data.get("seatCapacity", 0))
    except (TypeError, ValueError):
        return error_response("Giá hoặc sức chứa không hợp lệ", 400)
    if base_price <= 0:
        return error_response("Giá cơ bản phải lớn hơn 0", 400)
    if seat_capacity <= 0:
        return error_response("Sức chứa phải lớn hơn 0", 400)

    now = datetime.now(timezone.utc)
    doc = {
        "routeId": route_id,
        "providerId": provider_id,
        "departureTime": dep_dt,
        "arrivalTime": arr_dt,
        "basePrice": base_price,
        "seatCapacity": seat_capacity,
        "status": "SCHEDULED",
        "createdAt": now,
        "updatedAt": now,
    }

    # Trường riêng theo loại
    if service_type == "BUS":
        doc["tripCode"] = auto_generate_trip_code("BUS", route)
        # vehicleId: optional
        vehicle_id = str(data.get("vehicleId", "")).strip()
        if vehicle_id:
            doc["vehicleId"] = vehicle_id
        # Mã nội bộ nhà xe (optional, tách biệt tripCode)
        provider_code = str(data.get("providerTripCode", "")).strip()
        if provider_code:
            doc["providerTripCode"] = provider_code

    elif service_type == "FLIGHT":
        flight_number = str(data.get("flightNumber", "")).strip()
        if not flight_number:
            return error_response("Vui lòng nhập số hiệu chuyến bay", 400)
        doc["flightNumber"] = flight_number.upper()

    elif service_type == "TRAIN":
        train_number = str(data.get("trainNumber", "")).strip()
        if not train_number:
            return error_response("Vui lòng nhập số hiệu tàu", 400)
        doc["trainNumber"] = train_number.upper()

    trip_col = get_trip_col(service_type)
    result = mongo.db[trip_col].insert_one(doc)
    new_id = str(result.inserted_id)

    return success_response(
        data={"id": new_id, "tripCode": get_trip_code(doc)},
        message="Tạo chuyến thành công",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# GET /api/admin/trips/<id> — Chi tiết chuyến
# ---------------------------------------------------------------------------

@admin_trips_bp.route("/<trip_id>", methods=["GET"])
@admin_required
def get_trip(trip_id):
    service_type = request.args.get("serviceType", "").strip().upper()
    parsed_id = to_object_id(trip_id)
    if not parsed_id:
        return error_response("ID chuyến không hợp lệ", 400)

    if service_type in VALID_SERVICE_TYPES:
        trip_col = get_trip_col(service_type)
        trip = mongo.db[trip_col].find_one({"_id": parsed_id})
        if trip:
            return success_response(data=serialize_trip(trip, service_type, include_bookings=True))

    # Tìm trong cả 3 collection nếu không có serviceType
    for stype in ["BUS", "FLIGHT", "TRAIN"]:
        trip = mongo.db[get_trip_col(stype)].find_one({"_id": parsed_id})
        if trip:
            return success_response(data=serialize_trip(trip, stype, include_bookings=True))

    return error_response("Chuyến không tồn tại", 404)


# ---------------------------------------------------------------------------
# PUT /api/admin/trips/<id> — Sửa thông tin chuyến
# ---------------------------------------------------------------------------

@admin_trips_bp.route("/<trip_id>", methods=["PUT"])
@admin_required
def update_trip(trip_id):
    data = request.get_json() or {}
    service_type = str(data.get("serviceType", "")).strip().upper()
    if service_type not in VALID_SERVICE_TYPES:
        return error_response("Vui lòng cung cấp serviceType hợp lệ (BUS/FLIGHT/TRAIN)", 400)

    parsed_id = to_object_id(trip_id)
    if not parsed_id:
        return error_response("ID chuyến không hợp lệ", 400)

    trip_col = get_trip_col(service_type)
    trip = mongo.db[trip_col].find_one({"_id": parsed_id})
    if not trip:
        return error_response("Chuyến không tồn tại", 404)

    if trip.get("status") in {"COMPLETED", "CANCELLED"}:
        return error_response("Không thể sửa chuyến đã hoàn thành hoặc đã hủy", 400)

    confirmed = count_confirmed_bookings(service_type, trip_id)
    blocked = []
    updates = {}

    # Kiểm tra từng trường được bảo vệ
    for field in PROTECTED_FIELDS:
        if field in data and confirmed > 0:
            blocked.append(field)

    if blocked:
        return error_response(
            f"Không thể sửa các trường sau vì đã có {confirmed} vé xác nhận: {', '.join(blocked)}. "
            "Vui lòng hủy hoặc xử lý booking trước.",
            409,
        )

    # Các trường có thể sửa tự do
    free_fields = {
        "FLIGHT": ["flightNumber"],
        "TRAIN": ["trainNumber"],
        "BUS": ["providerTripCode"],
    }
    for field in free_fields.get(service_type, []):
        if field in data:
            val = str(data[field]).strip()
            if val:
                updates[field] = val.upper() if field in {"flightNumber", "trainNumber"} else val

    # Các trường được bảo vệ: chỉ cập nhật nếu không có confirmed booking
    if confirmed == 0:
        if "departureTime" in data:
            try:
                updates["departureTime"] = datetime.fromisoformat(
                    str(data["departureTime"]).replace("Z", "+00:00")
                )
            except ValueError:
                return error_response("Định dạng departureTime không hợp lệ", 400)

        if "arrivalTime" in data:
            try:
                updates["arrivalTime"] = datetime.fromisoformat(
                    str(data["arrivalTime"]).replace("Z", "+00:00")
                )
            except ValueError:
                return error_response("Định dạng arrivalTime không hợp lệ", 400)

        # Validate dep < arr
        dep = updates.get("departureTime", trip.get("departureTime"))
        arr = updates.get("arrivalTime", trip.get("arrivalTime"))
        if dep and arr and dep >= arr:
            return error_response("Giờ khởi hành phải trước giờ đến", 400)

        if "basePrice" in data:
            try:
                price = float(data["basePrice"])
            except (TypeError, ValueError):
                return error_response("Giá không hợp lệ", 400)
            if price <= 0:
                return error_response("Giá phải lớn hơn 0", 400)
            updates["basePrice"] = price

        if "seatCapacity" in data:
            try:
                cap = int(data["seatCapacity"])
            except (TypeError, ValueError):
                return error_response("Sức chứa không hợp lệ", 400)
            if cap <= 0:
                return error_response("Sức chứa phải lớn hơn 0", 400)
            updates["seatCapacity"] = cap

        if "routeId" in data:
            rid = str(data["routeId"]).strip()
            route_oid = to_object_id(rid)
            if not route_oid:
                return error_response("routeId không hợp lệ", 400)
            route = mongo.db.routes.find_one({"_id": route_oid})
            if not route or route.get("status") != "ACTIVE":
                return error_response("Tuyến không tồn tại hoặc đang tạm ngừng", 400)
            if route.get("serviceType") != service_type:
                return error_response("Tuyến không khớp loại phương tiện", 400)
            if str(route.get("supplierId", "")) != str(trip.get("providerId", "")):
                return error_response("Tuyến không thuộc nhà cung cấp của chuyến", 400)
            updates["routeId"] = rid

        if "vehicleId" in data and service_type == "BUS":
            updates["vehicleId"] = str(data["vehicleId"]).strip() or None

    if not updates:
        return error_response("Không có thông tin nào để cập nhật", 400)

    updates["updatedAt"] = datetime.now(timezone.utc)
    mongo.db[trip_col].update_one({"_id": parsed_id}, {"$set": updates})

    return success_response(message="Cập nhật chuyến thành công")


# ---------------------------------------------------------------------------
# PATCH /api/admin/trips/<id>/status — Đổi trạng thái chuyến
# ---------------------------------------------------------------------------

@admin_trips_bp.route("/<trip_id>/status", methods=["PATCH"])
@admin_required
def update_trip_status(trip_id):
    data = request.get_json() or {}
    service_type = str(data.get("serviceType", "")).strip().upper()
    if service_type not in VALID_SERVICE_TYPES:
        return error_response("Vui lòng cung cấp serviceType hợp lệ", 400)

    new_status = str(data.get("status", "")).strip().upper()
    if new_status not in VALID_STATUSES:
        return error_response(f"Trạng thái không hợp lệ. Dùng: {', '.join(VALID_STATUSES)}", 400)

    parsed_id = to_object_id(trip_id)
    if not parsed_id:
        return error_response("ID chuyến không hợp lệ", 400)

    trip_col = get_trip_col(service_type)
    trip = mongo.db[trip_col].find_one({"_id": parsed_id})
    if not trip:
        return error_response("Chuyến không tồn tại", 404)

    current_status = trip.get("status", "SCHEDULED")
    allowed_next = STATUS_TRANSITIONS.get(current_status, set())

    if new_status not in allowed_next:
        if not allowed_next:
            return error_response(f"Chuyến đang ở trạng thái '{current_status}', không thể thay đổi nữa", 400)
        return error_response(
            f"Không thể chuyển từ '{current_status}' sang '{new_status}'. "
            f"Trạng thái hợp lệ tiếp theo: {', '.join(allowed_next)}",
            400,
        )

    confirmed = count_confirmed_bookings(service_type, trip_id)
    mongo.db[trip_col].update_one(
        {"_id": parsed_id},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}},
    )

    extra = {}
    if new_status == "CANCELLED" and confirmed > 0:
        extra["warning"] = f"Có {confirmed} vé đã xác nhận. Vui lòng xử lý hoàn tiền cho khách hàng."
        extra["confirmedBookingCount"] = confirmed

    return success_response(message=f"Đã chuyển trạng thái sang '{new_status}'", **extra)
