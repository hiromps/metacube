#!/usr/bin/env python3
"""Test various iteration counts and key derivation methods commonly used in mobile apps"""

import hashlib
import binascii
import hmac
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def test_iteration_variations():
    """Test various iteration counts that AutoTouch might use"""

    # Load the actual AutoTouch file
    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("Testing iteration count variations for AutoTouch")
    print()

    # Extract known values
    password = "1111"
    salt_start = 0x46
    salt = data[salt_start:salt_start + 16]
    encrypted_start = salt_start + 16
    # Find the actual end by looking for next PK header
    next_pk = data.find(b'PK\x03\x04', encrypted_start)
    if next_pk > 0:
        # Auth code should be 10 bytes before next file
        encrypted_end = next_pk - 10
    else:
        encrypted_end = len(data) - 10  # fallback

    encrypted_data = data[encrypted_start:encrypted_end]
    auth_code = data[encrypted_end:encrypted_end + 10]

    print(f"Salt: {binascii.hexlify(salt).decode()}")
    print(f"Encrypted data: {len(encrypted_data)} bytes")
    print(f"Auth code: {binascii.hexlify(auth_code).decode()}")
    print()

    # Test many different iteration counts commonly used in apps
    iteration_counts = [
        1,      # Minimal (fast)
        10,     # Very low
        100,    # Low
        500,    # Medium-low
        1000,   # WinZip standard
        1024,   # Power of 2
        2048,   # Common power of 2
        4096,   # Common secure default
        5000,   # Medium-high
        8192,   # Another power of 2
        10000,  # High
        16384,  # Power of 2
        65536,  # Very high power of 2
    ]

    print("Testing PBKDF2 with various iteration counts:")
    print()

    for iterations in iteration_counts:
        print(f"=== Testing {iterations} iterations ===")

        try:
            # Derive key with current iteration count
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA1(),
                length=48,  # 32 for AES + 16 for HMAC
                salt=salt,
                iterations=iterations,
                backend=default_backend()
            )
            key_material = kdf.derive(password.encode('utf-8'))

            aes_key = key_material[:32]
            hmac_key = key_material[32:48]

            # Verify HMAC (WinZip uses HMAC-SHA1 over encrypted data)
            expected_hmac = hmac.new(hmac_key, encrypted_data, hashlib.sha1).digest()[:10]

            print(f"  Iterations: {iterations}")
            print(f"  Expected HMAC: {binascii.hexlify(expected_hmac).decode()}")
            print(f"  Actual auth:   {binascii.hexlify(auth_code).decode()}")

            if expected_hmac == auth_code:
                print("  >>> HMAC MATCH! This might be the correct iteration count!")

                # Try decryption
                try:
                    # WinZip AES typically uses CTR mode
                    # Try different IV approaches
                    iv_tests = [
                        ("Salt as IV", salt),
                        ("First 16 bytes of encrypted as IV", encrypted_data[:16]),
                        ("Zero IV", b'\x00' * 16),
                    ]

                    for iv_name, iv in iv_tests:
                        try:
                            cipher = Cipher(algorithms.AES(aes_key), modes.CTR(iv), backend=default_backend())
                            decryptor = cipher.decryptor()
                            decrypted = decryptor.update(encrypted_data[:100])

                            print(f"    {iv_name} decryption: {decrypted[:50]}")
                            # Check if it looks like JavaScript
                            try:
                                text = decrypted.decode('utf-8', errors='ignore')
                                if 'function' in text or 'var ' in text or '{' in text:
                                    print(f"      POTENTIAL JAVASCRIPT FOUND: {text}")
                            except:
                                pass
                        except Exception as e:
                            print(f"    {iv_name}: {str(e)[:50]}")

                except Exception as e:
                    print(f"  Decryption test failed: {e}")
            else:
                # Check if any bytes match (partial success indicator)
                matching_bytes = sum(a == b for a, b in zip(expected_hmac, auth_code))
                if matching_bytes > 2:
                    print(f"  {matching_bytes}/10 bytes match - getting closer!")

        except Exception as e:
            print(f"  Error with {iterations} iterations: {e}")

        print()

    # Also test some non-standard approaches that mobile apps sometimes use
    print("=== Testing Non-Standard Approaches ===")

    # Test simple hash concatenation (password + salt)
    simple_approaches = [
        ("MD5(password + salt)", lambda: hashlib.md5((password.encode() + salt)).digest() * 2),
        ("SHA1(password + salt)", lambda: (hashlib.sha1((password.encode() + salt)).digest() + hashlib.sha1((password.encode() + salt)).digest()[:12])),
        ("SHA256(password + salt)", lambda: hashlib.sha256((password.encode() + salt)).digest()),
        ("MD5(salt + password)", lambda: hashlib.md5((salt + password.encode())).digest() * 2),
        ("SHA1(salt + password)", lambda: (hashlib.sha1((salt + password.encode())).digest() + hashlib.sha1((salt + password.encode())).digest()[:12])),
    ]

    for name, key_func in simple_approaches:
        try:
            aes_key = key_func()[:32]  # Take first 32 bytes for AES-256
            print(f"{name}: {binascii.hexlify(aes_key).decode()[:32]}...")

            # Test decryption with salt as IV
            cipher = Cipher(algorithms.AES(aes_key), modes.CTR(salt), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(encrypted_data[:64])

            # Check for readable content
            try:
                text = decrypted.decode('utf-8', errors='ignore')
                if len(text.strip()) > 0 and any(c.isalnum() for c in text):
                    print(f"  Readable text: '{text[:50]}'")
                    if 'function' in text.lower() or 'var ' in text.lower():
                        print(f"  >>> POTENTIAL JAVASCRIPT MATCH!")
            except:
                pass

        except Exception as e:
            print(f"{name}: Error - {e}")

if __name__ == "__main__":
    test_iteration_variations()