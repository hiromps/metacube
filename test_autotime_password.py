#!/usr/bin/env python3
"""Test password validation against AutoTime file to find correct parameters"""

import hashlib
import binascii
import hmac
import struct
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def test_autotime_password_validation():
    """Test password validation with different parameters against real AutoTime file"""

    # Load the actual AutoTime file
    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("Testing password validation against real AutoTime file")
    print()

    # Extract known values
    password = "1111"
    salt_hex = "09275d93063ce269145d3b7811e54f4c"
    salt = binascii.unhexlify(salt_hex)

    # Extract encrypted data and auth code from actual file
    # From previous analysis:
    # - Salt starts at offset 0x46 (after AE header)
    # - Encrypted data follows salt
    # - Auth code is 10 bytes before next file header

    salt_start = 0x46
    encrypted_start = salt_start + 16

    # Find second file header
    second_file = data.find(b'PK\x03\x04', 100)
    auth_start = second_file - 10

    actual_salt = data[salt_start:salt_start + 16]
    encrypted_data = data[encrypted_start:auth_start]
    auth_code = data[auth_start:second_file]

    print(f"Extracted from file:")
    print(f"Salt: {binascii.hexlify(actual_salt).decode()}")
    print(f"Encrypted data size: {len(encrypted_data)} bytes")
    print(f"Auth code: {binascii.hexlify(auth_code).decode()}")
    print()

    # Test different PBKDF2 parameters
    test_configs = [
        ("WinZip Standard (1000 iter)", 1000, hashes.SHA1()),
        ("Reduced (100 iter)", 100, hashes.SHA1()),
        ("Minimal (1 iter)", 1, hashes.SHA1()),
        ("Alternative (1000 iter SHA256)", 1000, hashes.SHA256()),
    ]

    for config_name, iterations, hash_algo in test_configs:
        print(f"=== Testing {config_name} ===")

        try:
            # Derive key material (32 bytes for AES-256 + 16 bytes for HMAC = 48 total)
            kdf = PBKDF2HMAC(
                algorithm=hash_algo,
                length=48,  # AES key + HMAC key
                salt=actual_salt,
                iterations=iterations,
                backend=default_backend()
            )
            key_material = kdf.derive(password.encode('utf-8'))

            # Split key material
            aes_key = key_material[:32]  # AES-256 key
            hmac_key = key_material[32:48]  # HMAC key (16 bytes)

            print(f"AES Key:  {binascii.hexlify(aes_key).decode()}")
            print(f"HMAC Key: {binascii.hexlify(hmac_key).decode()}")

            # Verify HMAC
            # WinZip AES uses HMAC-SHA1 over encrypted data
            expected_hmac = hmac.new(hmac_key, encrypted_data, hashlib.sha1).digest()[:10]
            print(f"Expected HMAC: {binascii.hexlify(expected_hmac).decode()}")
            print(f"Actual Auth:   {binascii.hexlify(auth_code).decode()}")

            if expected_hmac == auth_code:
                print("✅ HMAC MATCHES! This is the correct configuration!")

                # Try to decrypt first few bytes to verify
                try:
                    # WinZip AES uses CTR mode with a specific counter initialization
                    # Counter starts with salt + 0x00000001
                    iv = actual_salt + b'\x00\x00\x00\x01'
                    cipher = Cipher(algorithms.AES(aes_key), modes.CTR(iv[:16]), backend=default_backend())
                    decryptor = cipher.decryptor()
                    decrypted_start = decryptor.update(encrypted_data[:64])
                    print(f"Decrypted start: {binascii.hexlify(decrypted_start).decode()}")
                    print(f"As text: {decrypted_start}")
                except Exception as e:
                    print(f"Decryption test failed: {e}")
            else:
                print("❌ HMAC does not match")

        except Exception as e:
            print(f"Error: {e}")

        print()

if __name__ == "__main__":
    test_autotime_password_validation()