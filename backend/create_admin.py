"""
Script tạo tài khoản ADMIN cho Travel Mini.
Chạy: python create_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import bcrypt
from datetime import datetime, timezone
from pymongo import MongoClient

# ── Config ────────────────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/travel_mini")
ADMIN_NAME  = "Admin"
ADMIN_EMAIL = "adminall@gmail.com"
ADMIN_PASS  = "12345678"          # ← đổi mật khẩu tại đây nếu muốn

# ── Connect ───────────────────────────────────────────────────────────────────
client = MongoClient(MONGO_URI)
db = client.get_database()

# ── Check tồn tại ─────────────────────────────────────────────────────────────
existing = db.users.find_one({"email": ADMIN_EMAIL})
if existing:
    print(f"[!] Tài khoản '{ADMIN_EMAIL}' đã tồn tại (role={existing.get('role')})")
    sys.exit(0)

# ── Hash password ─────────────────────────────────────────────────────────────
hashed = bcrypt.hashpw(ADMIN_PASS.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ── Insert ────────────────────────────────────────────────────────────────────
doc = {
    "name":       ADMIN_NAME,
    "email":      ADMIN_EMAIL,
    "password":   hashed,
    "phone":      "0000000000",
    "role":       "ADMIN",
    "status":     "ACTIVE",
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
}
result = db.users.insert_one(doc)

print("=" * 50)
print("✅  Tạo tài khoản ADMIN thành công!")
print(f"    Email   : {ADMIN_EMAIL}")
print(f"    Password: {ADMIN_PASS}")
print(f"    ID      : {result.inserted_id}")
print("=" * 50)
print("👉  Truy cập: http://localhost:5174/admin/login")

