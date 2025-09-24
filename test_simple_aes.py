#!/usr/bin/env python3
"""Test simplified AES approaches that AutoTouch might use"""

import hashlib
import binascii
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def test_simple_aes_approaches():
    """Test if AutoTouch uses simplified AES without proper authentication"""

    # Load the actual AutoTouch file
    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("Testing simplified AES approaches for AutoTouch")
    print()

    # Extract known values
    password = "1111"

    # From analysis, we know:
    salt_start = 0x46
    salt = data[salt_start:salt_start + 16]
    encrypted_start = salt_start + 16
    encrypted_end = 0x38C  # Before the suspicious auth code pattern
    encrypted_data = data[encrypted_start:encrypted_end]

    print(f"Salt: {binascii.hexlify(salt).decode()}")
    print(f"Encrypted data: {len(encrypted_data)} bytes")
    print(f"First 32 bytes encrypted: {binascii.hexlify(encrypted_data[:32]).decode()}")
    print()

    # Test different simplified approaches
    test_cases = [
        # (name, iterations, hash_function, key_size, mode_description)
        ("Standard WinZip", 1000, hashes.SHA1(), 32, "CTR with salt as IV"),
        ("Simple PBKDF2", 1, hashes.SHA1(), 32, "CTR with salt as IV"),
        ("AutoTouch Custom", 100, hashes.SHA1(), 32, "CTR with salt as IV"),
        ("MD5-based", None, None, 32, "Direct MD5 key derivation"),
        ("Simple SHA1", None, None, 32, "Direct SHA1 key derivation"),
    ]

    for name, iterations, hash_func, key_size, mode_desc in test_cases:
        print(f"=== Testing {name} ===")

        try:
            if iterations is not None:
                # PBKDF2 approach
                kdf = PBKDF2HMAC(
                    algorithm=hash_func,
                    length=key_size,
                    salt=salt,
                    iterations=iterations,
                    backend=default_backend()
                )
                aes_key = kdf.derive(password.encode('utf-8'))
            else:
                # Direct hash approaches
                if "MD5" in name:
                    # Try MD5-based key derivation (salt + password)
                    key_input = salt + password.encode('utf-8')
                    hash_obj = hashlib.md5()
                    hash_obj.update(key_input)
                    # Extend to 32 bytes by repeating
                    hash_result = hash_obj.digest()
                    aes_key = (hash_result + hash_result)[:32]
                else:
                    # Try SHA1-based key derivation
                    key_input = salt + password.encode('utf-8')
                    hash_obj = hashlib.sha1()
                    hash_obj.update(key_input)
                    hash_result = hash_obj.digest()
                    # Extend to 32 bytes
                    aes_key = (hash_result + hash_result[:12])

            print(f"Derived key: {binascii.hexlify(aes_key).decode()}")

            # Try different IV/Counter approaches
            iv_approaches = [
                ("Salt as IV", salt),
                ("Zero IV", b'\x00' * 16),
                ("Salt + counter", salt[:12] + b'\x00\x00\x00\x01'),
                ("Simple counter", b'\x00' * 15 + b'\x01'),
            ]

            for iv_name, iv in iv_approaches:
                try:
                    cipher = Cipher(algorithms.AES(aes_key), modes.CTR(iv), backend=default_backend())
                    decryptor = cipher.decryptor()
                    decrypted = decryptor.update(encrypted_data[:64])

                    print(f"  {iv_name}: {binascii.hexlify(decrypted[:32]).decode()}")

                    # Check if decrypted data looks like JavaScript
                    try:
                        text = decrypted.decode('utf-8', errors='ignore')
                        if any(keyword in text.lower() for keyword in ['function', 'var ', 'let ', 'const ', '{', '}', 'return']):
                            print(f"    >>> POSSIBLE MATCH! Text looks like JavaScript: '{text[:50]}...'")
                    except:
                        pass

                except Exception as e:
                    print(f"  {iv_name}: Error - {e}")

        except Exception as e:
            print(f"Key derivation failed: {e}")

        print()

    # Try the most promising approach with more data
    print("=== Extended Test of Most Promising Approach ===")
    try:
        # Based on analysis, try simple hash-based key derivation
        key_input = salt + password.encode('utf-8')
        hash_obj = hashlib.sha1()
        hash_obj.update(key_input)
        aes_key = (hash_obj.digest() + hash_obj.digest()[:12])

        cipher = Cipher(algorithms.AES(aes_key), modes.CTR(salt), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(encrypted_data[:200])

        print(f"Full decryption attempt: {decrypted}")
        print(f"As hex: {binascii.hexlify(decrypted).decode()}")

    except Exception as e:
        print(f"Extended test failed: {e}")

if __name__ == "__main__":
    test_simple_aes_approaches()