#!/usr/bin/env python3
"""Test PBKDF2 key derivation with AutoTouch parameters"""

import hashlib
import binascii
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

def test_pbkdf2_variations():
    """Test different PBKDF2 parameters that AutoTouch might use"""

    # Known values from AutoTouch file
    password = "1111"
    salt_hex = "09275d93063ce269145d3b7811e54f4c"  # Corrected salt from hex analysis
    salt = binascii.unhexlify(salt_hex)

    print("Testing PBKDF2 variations for AutoTouch compatibility")
    print(f"Password: '{password}'")
    print(f"Salt: {salt_hex} ({len(salt)} bytes)")
    print()

    # Test different iteration counts
    iteration_counts = [1, 100, 1000, 4096, 10000]
    key_lengths = [32, 48]  # 32 for AES-256, 48 for AES-256 + HMAC

    for iterations in iteration_counts:
        for key_length in key_lengths:
            print(f"=== Iterations: {iterations}, Key length: {key_length} bytes ===")

            # Test SHA-1 (WinZip standard)
            try:
                kdf_sha1 = PBKDF2HMAC(
                    algorithm=hashes.SHA1(),
                    length=key_length,
                    salt=salt,
                    iterations=iterations,
                    backend=default_backend()
                )
                key_sha1 = kdf_sha1.derive(password.encode('utf-8'))
                print(f"SHA-1:   {binascii.hexlify(key_sha1).decode()}")
            except Exception as e:
                print(f"SHA-1:   Error - {e}")

            # Test SHA-256 (Alternative)
            try:
                kdf_sha256 = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=key_length,
                    salt=salt,
                    iterations=iterations,
                    backend=default_backend()
                )
                key_sha256 = kdf_sha256.derive(password.encode('utf-8'))
                print(f"SHA-256: {binascii.hexlify(key_sha256).decode()}")
            except Exception as e:
                print(f"SHA-256: Error - {e}")

            print()

    # Test different password encodings with standard WinZip parameters
    print("=== Testing Password Encoding Variations (1000 iterations, SHA-1) ===")
    password_variants = [
        ("UTF-8", password.encode('utf-8')),
        ("ASCII", password.encode('ascii')),
        ("Latin1", password.encode('latin1')),
        ("UTF-16", password.encode('utf-16')),
        ("UTF-16LE", password.encode('utf-16le')),
    ]

    for encoding_name, password_bytes in password_variants:
        try:
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA1(),
                length=32,
                salt=salt,
                iterations=1000,
                backend=default_backend()
            )
            key = kdf.derive(password_bytes)
            print(f"{encoding_name:8}: {binascii.hexlify(key).decode()}")
        except Exception as e:
            print(f"{encoding_name:8}: Error - {e}")

    # Test the most likely AutoTouch parameters
    print()
    print("=== Most Likely AutoTouch Parameters ===")
    common_configs = [
        ("WinZip Standard", 1000, hashes.SHA1(), 32),
        ("WinZip with HMAC", 1000, hashes.SHA1(), 48),
        ("Reduced Iterations", 100, hashes.SHA1(), 32),
        ("Single Iteration", 1, hashes.SHA1(), 32),
        ("Modern Standard", 4096, hashes.SHA256(), 32),
    ]

    for name, iterations, hash_algo, key_len in common_configs:
        try:
            kdf = PBKDF2HMAC(
                algorithm=hash_algo,
                length=key_len,
                salt=salt,
                iterations=iterations,
                backend=default_backend()
            )
            key = kdf.derive(password.encode('utf-8'))
            print(f"{name:20}: {binascii.hexlify(key).decode()}")
        except Exception as e:
            print(f"{name:20}: Error - {e}")

if __name__ == "__main__":
    test_pbkdf2_variations()