from flask import Blueprint, request
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response
from app.utils.pagination import paginate

admin_suppliers_bp = Blueprint("admin_suppliers", __name__)

TRIP_COLLECTIONS = {
    "BUS": "trips",
    "FLIGHT": "flight_trips",
    "TRAIN": "rail_trips",
}
VALID_PROVIDER_TYPES = set(TRIP_COLLECTIONS)


def id_variants(value):
    try:
        return [value, ObjectId(value)]
    except (InvalidId, TypeError, ValueError):
        return [value]


def provider_references(provider_id):
    variants = id_variants(provider_id)
    routes = list(mongo.db.routes.find({"supplierId": {"$in": variants}}).limit(50))
    for route in routes:
        origin_id = route.get("originLocationId")
        destination_id = route.get("destinationLocationId")
        origin = mongo.db.locations.find_one({"_id": ObjectId(origin_id)}) if ObjectId.is_valid(str(origin_id or "")) else None
        destination = mongo.db.locations.find_one({"_id": ObjectId(destination_id)}) if ObjectId.is_valid(str(destination_id or "")) else None
        route["originName"] = origin.get("name") if origin else None
        route["destinationName"] = destination.get("name") if destination else None
    trips = []
    trip_count = 0
    for service_type, collection_name in TRIP_COLLECTIONS.items():
        collection = mongo.db[collection_name]
        trip_count += collection.count_documents({"providerId": {"$in": variants}})
        for trip in collection.find({"providerId": {"$in": variants}}).sort("departureTime", 1).limit(50):
            trips.append({
                "id": str(trip["_id"]),
                "serviceType": service_type,
                "tripCode": trip.get("tripCode") or trip.get("flightNumber") or trip.get("trainNumber"),
                "routeId": str(trip.get("routeId", "")),
                "departureTime": (
                    trip["departureTime"].isoformat()
                    if hasattr(trip.get("departureTime"), "isoformat")
                    else trip.get("departureTime")
                ),
                "status": trip.get("status", "SCHEDULED"),
            })
    return routes, trips, trip_count


def serialize_provider(p):
    return {
        "id": str(p["_id"]),
        "providerId": p.get("providerId"),
        "name": p.get("name"),
        "type": p.get("type"),          # BUS | FLIGHT | TRAIN
        "logo": p.get("logo"),
        "phone": p.get("phone"),
        "email": p.get("email"),
        "address": p.get("address"),
        "status": p.get("status", "ACTIVE"),
        "created_at": p.get("created_at").isoformat() if p.get("created_at") else None,
    }


@admin_suppliers_bp.route("", methods=["GET"])
@admin_required
def list_providers():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    search = request.args.get("search", "").strip()
    ptype = request.args.get("type", "")

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if ptype:
        query["type"] = ptype.upper()

    result = paginate(mongo.db.providers, query, page, limit)
    result["items"] = [serialize_provider(p) for p in result["items"]]
    return success_response(data=result)


@admin_suppliers_bp.route("/<provider_id>", methods=["GET"])
@admin_required
def get_provider(provider_id):
    try:
        provider = mongo.db.providers.find_one({"_id": ObjectId(provider_id)})
    except (InvalidId, TypeError, ValueError):
        return error_response("ID nhà cung cấp không hợp lệ", 400)
    if not provider:
        return error_response("Nhà cung cấp không tồn tại", 404)

    routes, trips, trip_count = provider_references(str(provider["_id"]))
    data = serialize_provider(provider)
    data.update({
        "routeCount": mongo.db.routes.count_documents({"supplierId": {"$in": id_variants(str(provider["_id"]))}}),
        "tripCount": trip_count,
        "routes": [{
            "id": str(route["_id"]),
            "serviceType": route.get("serviceType"),
            "originName": route.get("originName"),
            "destinationName": route.get("destinationName"),
            "originLocationId": str(route.get("originLocationId", "")),
            "destinationLocationId": str(route.get("destinationLocationId", "")),
            "status": route.get("status", "ACTIVE"),
        } for route in routes],
        "trips": trips,
    })
    return success_response(data=data)


@admin_suppliers_bp.route("", methods=["POST"])
@admin_required
def create_provider():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("type"):
        return error_response("Tên và loại nhà cung cấp là bắt buộc", 400)
    provider_type = str(data["type"]).strip().upper()
    if provider_type not in VALID_PROVIDER_TYPES:
        return error_response("Loại nhà cung cấp không hợp lệ", 400)
    data["type"] = provider_type
    data["status"] = "ACTIVE"
    data["created_at"] = datetime.now(timezone.utc)
    result = mongo.db.providers.insert_one(data)
    return success_response(data={"id": str(result.inserted_id)}, message="Tạo nhà cung cấp thành công", status_code=201)


@admin_suppliers_bp.route("/<provider_id>", methods=["PUT"])
@admin_required
def update_provider(provider_id):
    data = request.get_json() or {}
    data.pop("_id", None)
    try:
        provider_oid = ObjectId(provider_id)
    except (InvalidId, TypeError, ValueError):
        return error_response("ID không hợp lệ", 400)
    provider = mongo.db.providers.find_one({"_id": provider_oid})
    if not provider:
        return error_response("Nhà cung cấp không tồn tại", 404)
    if "type" in data:
        provider_type = str(data["type"]).strip().upper()
        if provider_type not in VALID_PROVIDER_TYPES:
            return error_response("Loại nhà cung cấp không hợp lệ", 400)
        if provider_type != str(provider.get("type", "")).upper():
            _, _, trip_count = provider_references(str(provider_oid))
            route_count = mongo.db.routes.count_documents({"supplierId": {"$in": id_variants(str(provider_oid))}})
            if route_count or trip_count:
                return error_response(
                    "Không thể đổi loại nhà cung cấp khi đã liên kết với tuyến hoặc chuyến",
                    409,
                )
        data["type"] = provider_type
    data["updated_at"] = datetime.now(timezone.utc)
    result = mongo.db.providers.update_one({"_id": provider_oid}, {"$set": data})
    if result.matched_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    return success_response(message="Cập nhật thành công")


@admin_suppliers_bp.route("/<provider_id>", methods=["DELETE"])
@admin_required
def delete_provider(provider_id):
    try:
        provider_oid = ObjectId(provider_id)
    except (InvalidId, TypeError, ValueError):
        return error_response("ID không hợp lệ", 400)
    if not mongo.db.providers.find_one({"_id": provider_oid}):
        return error_response("Nhà cung cấp không tồn tại", 404)
    _, _, trip_count = provider_references(str(provider_oid))
    route_count = mongo.db.routes.count_documents({"supplierId": {"$in": id_variants(str(provider_oid))}})
    if route_count or trip_count:
        return error_response(
            f"Không thể xóa nhà cung cấp đang liên kết với {route_count} tuyến và {trip_count} chuyến",
            409,
        )
    result = mongo.db.providers.delete_one({"_id": provider_oid})
    if result.deleted_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    return success_response(message="Xóa thành công")


@admin_suppliers_bp.route("/<provider_id>/status", methods=["PATCH"])
@admin_required
def update_status(provider_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    if new_status not in ("ACTIVE", "INACTIVE"):
        return error_response("Trạng thái không hợp lệ", 400)
    try:
        provider_oid = ObjectId(provider_id)
    except (InvalidId, TypeError, ValueError):
        return error_response("ID không hợp lệ", 400)
    result = mongo.db.providers.update_one(
        {"_id": provider_oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        return error_response("Nhà cung cấp không tồn tại", 404)
    routes, _, trip_count = provider_references(str(provider_oid))
    route_count = mongo.db.routes.count_documents({"supplierId": {"$in": id_variants(str(provider_oid))}})
    return success_response(
        message=f"Cập nhật trạng thái thành {new_status}",
        route_count=route_count,
        trip_count=trip_count,
    )
