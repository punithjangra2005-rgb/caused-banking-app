import re
import os
import hashlib
from typing import Tuple, Dict, Any

# Strong password requirements:
# 1. At least 8 characters
# 2. At least 1 uppercase letter
# 3. At least 1 lowercase letter
# 4. At least 1 numeric digit
# 5. At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{8,}$'
)

def validate_strong_password(password: str) -> Tuple[bool, str]:
    """
    Validates that a password satisfies bank-grade complexity:
    - Min 8 characters
    - At least 1 uppercase, 1 lowercase, 1 number, 1 special symbol
    """
    if not password:
        return False, "Password cannot be empty."
    if len(password) < 8:
        return False, f"Password must be at least 8 characters (provided {len(password)})."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not re.search(r'\d', password):
        return False, "Password must contain at least one numeric digit (0-9)."
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]', password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)."
    return True, "Strong password verified."

def hash_password(password: str, salt: str = None) -> Tuple[str, str]:
    """
    PBKDF2-HMAC-SHA256 password hashing (100,000 iterations).
    """
    if not salt:
        salt = os.urandom(16).hex()
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return new_hash == stored_hash
