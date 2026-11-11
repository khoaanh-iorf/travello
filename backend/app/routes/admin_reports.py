from flask import Blueprint, request
from datetime import datetime, timezone, timedelta
from app.extensions import mongo
from app.middleware.auth_guard import admin_required
from app.utils.response import success_response

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
        start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    return start, now


@admin_reports_bp.route("/revenue", methods=["GET"])
@admin_required
def revenue_report():
    period = request.args.get("period", "month")
    start, end = get_date_range(period)

    def sum_collection(col_name):
        result = mongo.db[col_name].aggregate([
            {"$match": {"status": "PAID", "createdAt": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$finalAmount"}, "count": {"$sum": 1}}},
        ])
        rows = list(result)
        return rows[0] if rows else {"total": 0, "count": 0}

    bus = sum_collection("bookings")
    flight = sum_collection("flight_bookings")
    train = sum_collection("rail_bookings")

    total_revenue = bus["total"] + flight["total"] + train["total"]
    total_bookings = bus["count"] + flight["count"] + train["count"]

    # By date (daily buckets)
    def daily_revenue(col_name):
        pipeline = [
            {"$match": {"status": "PAID", "createdAt": {"$gte": start, "$lte": end}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                "revenue": {"$sum": "$finalAmount"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]
        return list(mongo.db[col_name].aggregate(pipeline))

    return success_response(data={
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "by_service": {
            "bus": {"revenue": bus["total"], "count": bus["count"]},
            "flight": {"revenue": flight["total"], "count": flight["count"]},
            "train": {"revenue": train["total"], "count": train["count"]},
        },
        "daily": {
            "bus": daily_revenue("bookings"),
            "flight": daily_revenue("flight_bookings"),
            "train": daily_revenue("rail_bookings"),
        },
    })


@admin_reports_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    total_users = mongo.db.users.count_documents({"role": "CUSTOMER"})
    total_bus_trips = mongo.db.trips.count_documents({})
    total_flight_trips = mongo.db.flight_trips.count_documents({})
    total_rail_trips = mongo.db.rail_trips.count_documents({})
    pending_bookings = (
        mongo.db.bookings.count_documents({"status": "PENDING"})
        + mongo.db.flight_bookings.count_documents({"status": "PENDING"})
        + mongo.db.rail_bookings.count_documents({"status": "PENDING"})
    )

    return success_response(data={
        "total_users": total_users,
        "total_trips": total_bus_trips + total_flight_trips + total_rail_trips,
        "trips_by_service": {
            "bus": total_bus_trips,
            "flight": total_flight_trips,
            "train": total_rail_trips,
        },
        "pending_bookings": pending_bookings,
    })

