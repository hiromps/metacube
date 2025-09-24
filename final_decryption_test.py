#!/usr/bin/env python3
"""Final comprehensive test to crack AutoTouch encryption"""

import hashlib
import binascii
import zlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def final_decryption_test():
    """Comprehensive final test with all possible approaches"""

    # Load the actual AutoTouch file
    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("Final Comprehensive Decryption Test")
    print("=" * 50)
    print()

    # Extract components
    password = "1111"
    salt_start = 0x46
    salt = data[salt_start:salt_start + 16]
    encrypted_start = salt_start + 16

    # Try to find the correct end of encrypted data
    # The suspicious auth code suggests the real encrypted data might end before it
    # Let's try different end positions

    possible_ends = [
        encrypted_start + 822,  # Our calculated end
        len(data) - 100,        # Near the end
        data.find(b'PK\x01\x02') if data.find(b'PK\x01\x02') > 0 else len(data) - 50,  # Central directory
    ]

    print(f"Password: '{password}'")
    print(f"Salt: {binascii.hexlify(salt).decode()}")
    print()

    # Test EVERY reasonable combination
    key_derivation_methods = [
        ("PBKDF2-SHA1-1", lambda: PBKDF2HMAC(hashes.SHA1(), 32, salt, 1, default_backend()).derive(password.encode())),
        ("PBKDF2-SHA1-100", lambda: PBKDF2HMAC(hashes.SHA1(), 32, salt, 100, default_backend()).derive(password.encode())),
        ("PBKDF2-SHA1-1000", lambda: PBKDF2HMAC(hashes.SHA1(), 32, salt, 1000, default_backend()).derive(password.encode())),
        ("Simple-MD5", lambda: hashlib.md5(password.encode() + salt).digest() + hashlib.md5(password.encode() + salt).digest()[:16]),
        ("Simple-SHA1", lambda: hashlib.sha1(password.encode() + salt).digest() + hashlib.sha1(password.encode() + salt).digest()[:12]),
        ("Reverse-SHA1", lambda: hashlib.sha1(salt + password.encode()).digest() + hashlib.sha1(salt + password.encode()).digest()[:12]),
        ("Double-MD5", lambda: hashlib.md5(hashlib.md5(password.encode() + salt).digest()).digest() + hashlib.md5(hashlib.md5(password.encode() + salt).digest()).digest()[:16]),
    ]

    encryption_modes = [
        ("CTR-Salt", lambda key: modes.CTR(salt)),
        ("CTR-Zero", lambda key: modes.CTR(b'\x00' * 16)),
        ("CBC-Salt", lambda key: modes.CBC(salt)),
        ("CBC-Zero", lambda key: modes.CBC(b'\x00' * 16)),
        ("OFB-Salt", lambda key: modes.OFB(salt)),
        ("CFB-Salt", lambda key: modes.CFB(salt)),
    ]

    for end_pos in possible_ends:
        encrypted_data = data[encrypted_start:end_pos]
        if len(encrypted_data) < 16:
            continue

        print(f"=== Testing with encrypted data length: {len(encrypted_data)} bytes ===")

        for key_name, key_func in key_derivation_methods:
            try:
                aes_key = key_func()[:32]

                for mode_name, mode_func in encryption_modes:
                    try:
                        cipher = Cipher(algorithms.AES(aes_key), mode_func(aes_key), backend=default_backend())
                        decryptor = cipher.decryptor()

                        # Try to decrypt first chunk
                        test_chunk = encrypted_data[:64] if len(encrypted_data) >= 64 else encrypted_data
                        decrypted = decryptor.update(test_chunk)

                        # Check if decrypted data looks meaningful
                        score = 0

                        # Test 1: Contains printable ASCII
                        printable_count = sum(1 for b in decrypted if 32 <= b <= 126)
                        if printable_count > len(decrypted) * 0.7:
                            score += 3

                        # Test 2: Contains JavaScript keywords
                        try:
                            text = decrypted.decode('utf-8', errors='ignore')
                            js_keywords = ['function', 'var ', 'let ', 'const ', 'return', 'if (', '{', '}', ';']
                            for keyword in js_keywords:
                                if keyword in text.lower():
                                    score += 2
                        except:
                            pass

                        # Test 3: Starts with reasonable characters
                        if len(decrypted) > 0 and 32 <= decrypted[0] <= 126:
                            score += 1

                        # Test 4: Contains common file patterns
                        if b'(' in decrypted or b')' in decrypted or b'=' in decrypted:
                            score += 1

                        if score >= 4:  # High confidence
                            print(f"*** HIGH CONFIDENCE MATCH ***")
                            print(f"Key method: {key_name}")
                            print(f"Mode: {mode_name}")
                            print(f"Key: {binascii.hexlify(aes_key).decode()}")
                            print(f"Decrypted: {decrypted}")
                            try:
                                full_text = decrypted.decode('utf-8', errors='replace')
                                print(f"As text: '{full_text}'")
                            except:
                                pass
                            print()

                            # Try to decrypt the full file
                            try:
                                full_cipher = Cipher(algorithms.AES(aes_key), mode_func(aes_key), backend=default_backend())
                                full_decryptor = full_cipher.decryptor()
                                full_decrypted = full_decryptor.update(encrypted_data)

                                print(f"Full decryption ({len(full_decrypted)} bytes):")
                                try:
                                    full_text = full_decrypted.decode('utf-8', errors='replace')
                                    print(f"Full text: {full_text[:200]}...")

                                    # Try to decompress if it's deflated
                                    if b'function' in full_decrypted or b'var ' in full_decrypted:
                                        print("*** THIS LOOKS LIKE THE CORRECT DECRYPTION! ***")

                                        # Save to file for inspection
                                        with open('decrypted_worker.js', 'wb') as f:
                                            f.write(full_decrypted)
                                        print("Saved decrypted content to 'decrypted_worker.js'")

                                except Exception as e:
                                    print(f"Text decode error: {e}")

                                    # Maybe it's compressed - try inflate
                                    try:
                                        decompressed = zlib.decompress(full_decrypted)
                                        print(f"Decompressed: {decompressed[:200]}")
                                        try:
                                            decompressed_text = decompressed.decode('utf-8')
                                            print("*** FOUND JAVASCRIPT AFTER DECOMPRESSION! ***")
                                            with open('decompressed_worker.js', 'w') as f:
                                                f.write(decompressed_text)
                                            print("Saved to 'decompressed_worker.js'")
                                        except:
                                            pass
                                    except:
                                        pass

                            except Exception as e:
                                print(f"Full decryption failed: {e}")

                        elif score >= 2:  # Medium confidence
                            print(f"Partial match - {key_name} + {mode_name}: score={score}")
                            print(f"  Sample: {decrypted[:32]}")

                    except Exception as e:
                        # Skip silently for most errors
                        if "Invalid" not in str(e):
                            pass

            except Exception as e:
                # Skip key derivation errors
                pass

        print()

    print("Test completed.")

if __name__ == "__main__":
    final_decryption_test()