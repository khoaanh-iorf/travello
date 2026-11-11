import re
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from flask import Blueprint, request
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response, error_response

admin_reports_bp = Blueprint("admin_reports", __name__)


def get_date_range(period):
    now = datetime.now(timezone.utc)
    if period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "year":
        start = now - timedelta(days=365)
    else:
        start = None
    return start, now


@admin_reports_bp.route("/revenue", methods=["GET"])
@admin_required
def revenue_report():
    period = request.args.get("period", "all").strip().lower()
    if period not in {"week", "month", "year", "all"}:
        return error_response("Kỳ doanh thu không hợp lệ. Dùng week, month, year hoặc all", 400)
    supplier_id = request.args.get("supplierId", "").strip()
    start, end = get_date_range(period)

    clauses = [{"status": "PAID"}]

    if start is not None:
        clauses.append({
            "$or": [
                {"paidAt": {"$gte": start, "$lte": end}},
                {
                    "$and": [
                        {"$or": [{"paidAt": {"$exists": False}}, {"paidAt": None}]},
                        {"createdAt": {"$gte": start, "$lte": end}},
                    ]
                },
            ]
        })

    supplier_clause = None
    if supplier_id:
        provider_name = supplier_id
        if ObjectId.is_valid(supplier_id):
            p = mongo.db.providers.find_one({"_id": ObjectId(supplier_id)})
            if p and p.get("name"):
                provider_name = p["name"]
        else:
            p = mongo.db.providers.find_one({"name": supplier_id})
            if p and p.get("name"):
                provider_name = p["name"]

        supplier_clause = {
            "$or": [
                {"provider": provider_name},
                {"providerId": supplier_id},
                {"supplierId": supplier_id},
                {"provider": {"$regex": re.escape(provider_name), "$options": "i"}},
            ]
        }
        clauses.append(supplier_clause)

    match_q = {"$and": clauses}

    group_stage = {
        "$group": {
            "_id": {
                "$toUpper": {"$ifNull": ["$orderType", {"$ifNull": ["$serviceType", "$service"]}]}
            },
            "revenue": {
                "$sum": {"$ifNull": ["$amount", {"$ifNull": ["$finalAmount", 0]}]}
            },
            "count": {"$sum": 1},
        }
    }

    rows = list(mongo.db.payments.aggregate([{"$match": match_q}, group_stage]))

    by_service = {
        "bus": {"revenue": 0, "count": 0},
        "flight": {"revenue": 0, "count": 0},
        "train": {"revenue": 0, "count": 0},
    }

    for row in rows:
        service_key = str(row.get("_id") or "").lower()
        if service_key in by_service:
            by_service[service_key] = {
                "revenue": row.get("revenue", 0),
                "count": row.get("count", 0),
            }

    total_revenue = sum(item["revenue"] for item in by_service.values())
    total_bookings = sum(item["count"] for item in by_service.values())

    daily_pipeline = [
        {"$match": match_q},
        {
            "$group": {
                "_id": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$ifNull": ["$paidAt", "$createdAt"]}}},
                    "service": {"$toLower": {"$ifNull": ["$orderType", {"$ifNull": ["$serviceType", "$service"]}]}}
                },
                "revenue": {
                    "$sum": {"$ifNull": ["$amount", {"$ifNull": ["$finalAmount", 0]}]}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.date": 1}}
    ]

    daily_rows = list(mongo.db.payments.aggregate(daily_pipeline))
    daily = {"bus": [], "flight": [], "train": []}
    for d in daily_rows:
        svc = d.get("_id", {}).get("service")
        if svc in daily:
            daily[svc].append({
                "_id": d["_id"].get("date"),
                "revenue": d.get("revenue", 0),
                "count": d.get("count", 0)
            })

    return success_response(data={
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "supplier_id": supplier_id or None,
        "by_service": by_service,
        "daily": daily,
    })


@admin_reports_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    total_users = mongo.db.users.count_documents({"role": "CUSTOMER"})
    total_bus_trips = mongo.db.trips.count_documents({})
    total_flight_trips = mongo.db.flight_trips.count_documents({})
    total_rail_trips = mongo.db.rail_trips.count_documents({})
    bookings_by_service = {
        "bus": mongo.db.bookings.count_documents({}),
        "flight": mongo.db.flight_bookings.count_documents({}),
        "train": mongo.db.rail_bookings.count_documents({}),
    }
    bookings_by_service["all"] = sum(bookings_by_service.values())
    pending_bookings = (
        mongo.db.bookings.count_documents({"status": "PENDING"})
        + mongo.db.flight_bookings.count_documents({"status": "PENDING"})
        + mongo.db.rail_bookings.count_documents({"status": "PENDING"})
    )
    active_routes = mongo.db.routes.count_documents({"status": "ACTIVE"})

    return success_response(data={
        "total_users": total_users,
        "total_trips": total_bus_trips + total_flight_trips + total_rail_trips,
        "total_bookings": bookings_by_service["all"],
        "bookings_by_service": bookings_by_service,
        "active_routes": active_routes,
        "trips_by_service": {
            "bus": total_bus_trips,
            "flight": total_flight_trips,
            "train": total_rail_trips,
        },
        "pending_bookings": pending_bookings,
    })
