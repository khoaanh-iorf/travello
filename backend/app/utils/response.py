from flask import jsonify


def success_response(data=None, message="Success", status_code=200, **kwargs):
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    payload.update(kwargs)
    return jsonify(payload), status_code


def error_response(message="Error", status_code=400, errors=None):
    payload = {"success": False, "message": message}
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status_code

