import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, request
from pymongo.errors import DuplicateKeyError

from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.pagination import paginate
from app.utils.response import error_response, success_response

admin_routes_bp = Blueprint("admin_routes", __name__)

VALID_SERVICE_TYPES = {"BUS", "FLIGHT", "TRAIN"}
VALID_STATUSES = {"ACTIVE", "INACTIVE"}
LOCATION_TYPES_BY_SERVICE = {
    "BUS": {"BUS_STATION", "OTHER"},
    "FLIGHT": {"AIRPORT", "OTHER"},
    "TRAIN": {"TRAIN_STATION", "OTHER"},
}
TRIP_COLLECTIONS = {
    "BUS": ("trips", "bookings"),
    "FLIGHT": ("flight_trips", "flight_bookings"),
    "TRAIN": ("rail_trips", "rail_bookings"),
}


def object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError, ValueError):
        return None


def id_variants(value):
    parsed = object_id(value)
    return [value, parsed] if parsed is not None else [value]


def find_location(location_id):
    parsed = object_id(location_id)
    if parsed is None:
        return None
    return mongo.db.locations.find_one({"_id": parsed})


def related_trips(route):
    trip_collection, booking_collection = TRIP_COLLECTIONS[route["serviceType"]]
    route_ids = id_variants(str(route["_id"]))
    trips = list(mongo.db[trip_collection].find({"routeId": {"$in": route_ids}}))
    booking_ids = []
    for trip in trips:
        trip_id = str(trip["_id"])
        booking_ids.extend(id_variants(trip_id))

    booking_count = (
        mongo.db[booking_collection].count_documents({"tripId": {"$in": booking_ids}})
        if booking_ids else 0
    )
    serialized = []
    for trip in trips:
        departure = trip.get("departureTime") or trip.get("departureDate")
        serialized.append({
            "id": str(trip["_id"]),
            "code": trip.get("tripCode") or trip.get("flightNumber") or trip.get("trainNumber"),
            "departure": departure.isoformat() if hasattr(departure, "isoformat") else departure,
            "status": trip.get("status"),
        })
    return serialized, booking_count


def serialize_route(route, include_related=False):
    provider_id = str(route.get("supplierId") or route.get("providerId") or "")
    origin_id = str(route.get("originLocationId") or route.get("originId") or "")
    destination_id = str(route.get("destinationLocationId") or route.get("destinationId") or "")
    provider = mongo.db.providers.find_one({"_id": object_id(provider_id)}) if object_id(provider_id) else None
    origin = find_location(origin_id)
    destination = find_location(destination_id)

    data = {
        "id": str(route["_id"]),
        "supplierId": provider_id,
        "supplierName": provider.get("name") if provider else None,
        "serviceType": route.get("serviceType"),
        "originLocationId": origin_id,
        "originName": origin.get("name") if origin else route.get("originName") or origin_id or None,
        "originCity": origin.get("city") if origin else None,
        "destinationLocationId": destination_id,
        "destinationName": destination.get("name") if destination else route.get("destinationName") or destination_id or None,
        "destinationCity": destination.get("city") if destination else None,
        "routeCode": route.get("routeCode"),
        "distance": route.get("distance"),
        "price": route.get("price"),
        "seatType": route.get("seatType"),
        "hasLegacyEndpoints": not route.get("originLocationId") or not route.get("destinationLocationId"),
        "status": route.get("status", "ACTIVE"),
        "createdAt": route["createdAt"].isoformat() if route.get("createdAt") else None,
        "updatedAt": route["updatedAt"].isoformat() if route.get("updatedAt") else None,
    }

    if include_related:
        trips, booking_count = related_trips(route)
        data.update({
            "trips": trips,
            "tripCount": len(trips),
            "bookingCount": booking_count,
        })
    return data


def validate_route(data):
    service_type = str(data.get("serviceType", "")).strip().upper()
    if service_type not in VALID_SERVICE_TYPES:
        return None, "Loại phương tiện không hợp lệ"

    supplier_id = str(data.get("supplierId", "")).strip()
    supplier_object_id = object_id(supplier_id)
    if supplier_object_id is None:
        return None, "Nhà cung cấp không hợp lệ"
    supplier = mongo.db.providers.find_one({"_id": supplier_object_id})
    if not supplier or supplier.get("status", "ACTIVE") != "ACTIVE":
        return None, "Nhà cung cấp không tồn tại hoặc đang tạm ngưng"
    if str(supplier.get("type", "")).upper() != service_type:
        return None, "Loại phương tiện không khớp với nhà cung cấp"

    origin_id = str(data.get("originLocationId", "")).strip()
    destination_id = str(data.get("destinationLocationId", "")).strip()
    if not origin_id or not destination_id:
        return None, "Điểm đi và điểm đến là bắt buộc"
    if origin_id == destination_id:
        return None, "Điểm đi và điểm đến phải khác nhau"

    origin = find_location(origin_id)
    destination = find_location(destination_id)
    if not origin or not destination:
        return None, "Điểm đi hoặc điểm đến không tồn tại"
    if origin.get("status", "ACTIVE") != "ACTIVE" or destination.get("status", "ACTIVE") != "ACTIVE":
        return None, "Chỉ được chọn địa điểm đang hoạt động"
    allowed_types = LOCATION_TYPES_BY_SERVICE[service_type]
    if origin.get("type") not in allowed_types or destination.get("type") not in allowed_types:
        return None, "Loại địa điểm không phù hợp với phương tiện đã chọn"

    return {
        "supplierId": supplier_id,
        "serviceType": service_type,
        "originLocationId": origin_id,
        "destinationLocationId": destination_id,
    }, None


@admin_routes_bp.route("", methods=["GET"])
@admin_required
def list_routes():
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 10)), 1), 100)
    search = request.args.get("search", "").strip()
    service_type = request.args.get("serviceType", "").strip().upper()
    supplier_id = request.args.get("supplierId", "").strip()
    status = request.args.get("status", "").strip().upper()
    query = {}

    if service_type in VALID_SERVICE_TYPES:
        query["serviceType"] = service_type
    if supplier_id:
        query["supplierId"] = supplier_id
    if status in VALID_STATUSES:
        query["status"] = status
    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        provider_ids = [
            str(item["_id"]) for item in mongo.db.providers.find({"name": pattern}, {"_id": 1})
        ]
        location_ids = [
            str(item["_id"])
            for item in mongo.db.locations.find(
                {"$or": [{"name": pattern}, {"city": pattern}, {"code": pattern}]},
                {"_id": 1},
            )
        ]
        search_terms = []
        search_terms.append({"routeCode": pattern})
        if provider_ids:
            search_terms.append({"supplierId": {"$in": provider_ids}})
        if location_ids:
            search_terms.extend([
                {"originLocationId": {"$in": location_ids}},
                {"destinationLocationId": {"$in": location_ids}},
                {"originId": {"$in": location_ids}},
                {"destinationId": {"$in": location_ids}},
            ])
        query["$or"] = search_terms

    result = paginate(mongo.db.routes, query, page, limit, "createdAt", -1)
    result["items"] = [serialize_route(route) for route in result["items"]]
    return success_response(data=result)


@admin_routes_bp.route("", methods=["POST"])
@admin_required
def create_route():
    normalized, error = validate_route(request.get_json() or {})
    if error:
        return error_response(error, 400)

    mongo.db.routes.create_index(
        [("supplierId", 1), ("serviceType", 1), ("originLocationId", 1), ("destinationLocationId", 1)],
        unique=True,
        partialFilterExpression={
            "supplierId": {"$type": "string"},
            "originLocationId": {"$type": "string"},
            "destinationLocationId": {"$type": "string"},
        },
        name="unique_provider_route_direction_v2",
    )
    if mongo.db.routes.find_one(normalized):
        return error_response("Nhà cung cấp đã có tuyến này", 409)

    now = datetime.now(timezone.utc)
    normalized.update({"status": "ACTIVE", "createdAt": now, "updatedAt": now})
    try:
        result = mongo.db.routes.insert_one(normalized)
    except DuplicateKeyError:
        return error_response("Nhà cung cấp đã có tuyến này", 409)
    return success_response(
        data={"id": str(result.inserted_id)},
        message="Tạo tuyến thành công",
        status_code=201,
    )


@admin_routes_bp.route("/<route_id>", methods=["PUT"])
@admin_required
def update_route(route_id):
    parsed_id = object_id(route_id)
    if parsed_id is None:
        return error_response("ID tuyến không hợp lệ", 400)
    route = mongo.db.routes.find_one({"_id": parsed_id})
    if not route:
        return error_response("Tuyến không tồn tại", 404)

    normalized, error = validate_route(request.get_json() or {})
    if error:
        return error_response(error, 400)

    duplicate_query = dict(normalized)
    duplicate_query["_id"] = {"$ne": parsed_id}
    if mongo.db.routes.find_one(duplicate_query):
        return error_response("Nhà cung cấp đã có tuyến này", 409)

    trips, _ = related_trips(route)
    previous = {
        "supplierId": str(route.get("supplierId") or route.get("providerId") or ""),
        "serviceType": route.get("serviceType"),
        "originLocationId": str(route.get("originLocationId") or route.get("originId") or ""),
        "destinationLocationId": str(route.get("destinationLocationId") or route.get("destinationId") or ""),
    }
    if trips and any(previous[key] != normalized[key] for key in normalized):
        return error_response(
            "Không thể đổi nhà cung cấp hoặc hai đầu tuyến khi đã có chuyến liên kết",
            409,
        )

    normalized["updatedAt"] = datetime.now(timezone.utc)
    try:
        mongo.db.routes.update_one({"_id": parsed_id}, {"$set": normalized})
    except DuplicateKeyError:
        return error_response("Nhà cung cấp đã có tuyến này", 409)
    return success_response(message="Cập nhật tuyến thành công")


@admin_routes_bp.route("/<route_id>", methods=["GET"])
@admin_required
def get_route(route_id):
    parsed_id = object_id(route_id)
    if parsed_id is None:
        return error_response("ID tuyến không hợp lệ", 400)
    route = mongo.db.routes.find_one({"_id": parsed_id})
    if not route:
        return error_response("Tuyến không tồn tại", 404)
    return success_response(data=serialize_route(route, include_related=True))


@admin_routes_bp.route("/<route_id>/status", methods=["PATCH"])
@admin_required
def update_route_status(route_id):
    parsed_id = object_id(route_id)
    if parsed_id is None:
        return error_response("ID tuyến không hợp lệ", 400)
    data = request.get_json() or {}
    status = str(data.get("status", "")).strip().upper()
    if status not in VALID_STATUSES:
        return error_response("Trạng thái không hợp lệ. Dùng ACTIVE hoặc INACTIVE", 400)

    route = mongo.db.routes.find_one({"_id": parsed_id})
    if not route:
        return error_response("Tuyến không tồn tại", 404)
    trips, booking_count = related_trips(route)
    mongo.db.routes.update_one(
        {"_id": parsed_id},
        {"$set": {"status": status, "updatedAt": datetime.now(timezone.utc)}},
    )
    return success_response(
        message="Đã cập nhật trạng thái tuyến",
        trip_count=len(trips),
        booking_count=booking_count,
    )
