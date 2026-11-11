def paginate(collection, query, page=1, limit=10, sort_field="_id", sort_dir=-1):
    """Generic pagination helper for PyMongo collections."""
    total = collection.count_documents(query)
    skip = (page - 1) * limit
    cursor = collection.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    items = list(cursor)
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }

