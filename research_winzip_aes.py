#!/usr/bin/env python3
"""Research WinZip AES format and AutoTouch variations"""

import binascii
import struct

def analyze_winzip_aes_format():
    """Analyze the WinZip AES format based on specification"""

    print("WinZip AES Format Research")
    print("=" * 40)
    print()

    # Load the AutoTime file for analysis
    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("WinZip AES Specification:")
    print("- Authentication Code: 10 bytes")
    print("- For AES-256: 16-byte salt + encrypted data + 10-byte auth code")
    print("- PBKDF2 with SHA-1, typically 1000 iterations")
    print("- Key derivation: (key_size + 16) bytes total")
    print("  * AES key: key_size bytes (32 for AES-256)")
    print("  * HMAC key: 16 bytes")
    print()

    # Analyze the auth code pattern
    print("AutoTouch Auth Code Analysis:")

    # Find all potential auth codes in the file
    for i in range(len(data) - 10):
        segment = data[i:i+10]
        # Look for patterns that might be auth codes
        if segment.count(0) >= 6:  # Many zeros might indicate issues
            print(f"Potential auth code at offset {i:04x}: {binascii.hexlify(segment).decode()}")

    print()
    print("Analysis of file structure:")

    # Look for all PK headers
    pk_positions = []
    for i in range(len(data) - 4):
        if data[i:i+4] == b'PK\x03\x04':
            pk_positions.append(i)

    print(f"Found {len(pk_positions)} local file headers at positions: {[hex(p) for p in pk_positions]}")

    for i, pos in enumerate(pk_positions):
        print(f"\n--- File {i+1} at offset {pos:04x} ---")

        # Parse header
        filename_len = struct.unpack('<H', data[pos+26:pos+28])[0]
        extra_len = struct.unpack('<H', data[pos+28:pos+30])[0]
        compression = struct.unpack('<H', data[pos+8:pos+10])[0]

        filename_start = pos + 30
        filename = data[filename_start:filename_start + filename_len].decode('utf-8')

        data_start = filename_start + filename_len + extra_len

        print(f"Filename: {filename}")
        print(f"Compression method: {compression}")
        print(f"Data starts at: {data_start:04x}")

        if compression == 99:  # AES encryption
            # Look for next file or central directory
            next_pos = len(data)
            if i + 1 < len(pk_positions):
                next_pos = pk_positions[i + 1]
            else:
                # Look for central directory
                cd_pos = data.find(b'PK\x01\x02')
                if cd_pos > 0:
                    next_pos = cd_pos

            print(f"Next structure at: {next_pos:04x}")

            # Extract the encrypted file data
            file_data = data[data_start:next_pos]
            print(f"Total encrypted file data: {len(file_data)} bytes")

            if len(file_data) >= 26:  # Minimum for salt + some data + auth
                salt = file_data[:16]
                auth_code = file_data[-10:]
                encrypted_payload = file_data[16:-10]

                print(f"Salt: {binascii.hexlify(salt).decode()}")
                print(f"Encrypted payload: {len(encrypted_payload)} bytes")
                print(f"Auth code: {binascii.hexlify(auth_code).decode()}")

                # Check if auth code looks valid (not all zeros)
                if auth_code == b'\x00' * 10:
                    print("⚠️  Auth code is all zeros - might indicate non-standard implementation")
                elif auth_code.count(0) > 6:
                    print("⚠️  Auth code has many zeros - suspicious pattern")

    print()
    print("Key Findings:")
    print("1. Check if AutoTouch uses a non-standard authentication method")
    print("2. The auth code pattern suggests possible implementation differences")
    print("3. May need to test different key derivation approaches")
    print("4. Could be using a simpler encryption scheme than full WinZip AES")

if __name__ == "__main__":
    analyze_winzip_aes_format()