#!/usr/bin/env python3
"""Analyze AutoTouch .ate file structure to understand key derivation parameters"""

import struct
import binascii

def analyze_autotime_file(filename):
    """Analyze an AutoTime .ate file to understand the encryption parameters"""

    with open(filename, 'rb') as f:
        data = f.read()

    print(f"Analyzing AutoTime file: {filename}")
    print(f"File size: {len(data)} bytes")
    print()

    # Parse ZIP local file header
    if data[:4] != b'PK\x03\x04':
        print("ERROR: Not a valid ZIP file")
        return

    print("=== ZIP Local File Header ===")
    version_needed = struct.unpack('<H', data[4:6])[0]
    general_flags = struct.unpack('<H', data[6:8])[0]
    compression = struct.unpack('<H', data[8:10])[0]
    mod_time = struct.unpack('<H', data[10:12])[0]
    mod_date = struct.unpack('<H', data[12:14])[0]
    crc32 = struct.unpack('<I', data[14:18])[0]
    compressed_size = struct.unpack('<I', data[18:22])[0]
    uncompressed_size = struct.unpack('<I', data[22:26])[0]
    filename_len = struct.unpack('<H', data[26:28])[0]
    extra_len = struct.unpack('<H', data[28:30])[0]

    print(f"Version needed: {version_needed}")
    print(f"General purpose flags: 0x{general_flags:04x}")
    print(f"Compression method: {compression}")
    print(f"CRC32: 0x{crc32:08x}")
    print(f"Compressed size: {compressed_size}")
    print(f"Uncompressed size: {uncompressed_size}")
    print(f"Filename length: {filename_len}")
    print(f"Extra field length: {extra_len}")
    print()

    # Extract filename
    filename_offset = 30
    filename = data[filename_offset:filename_offset + filename_len].decode('utf-8')
    print(f"Filename: {filename}")

    # Parse extra field (AES info)
    extra_offset = filename_offset + filename_len
    extra_field = data[extra_offset:extra_offset + extra_len]

    print("=== Extra Field Raw Data ===")
    print(f"Raw extra field ({extra_len} bytes): {binascii.hexlify(extra_field).decode()}")

    # Look for AES extra field (0x9901)
    aes_found = False
    for i in range(0, len(extra_field)-4, 4):
        header_id = struct.unpack('<H', extra_field[i:i+2])[0]
        if header_id == 0x9901:  # WinZip AES
            print(f"Found WinZip AES extra field at offset {i}")
            aes_found = True

            aes_data_size = struct.unpack('<H', extra_field[i+2:i+4])[0]
            aes_data = extra_field[i+4:i+4+aes_data_size]

            if len(aes_data) >= 7:
                aes_version = struct.unpack('<H', aes_data[0:2])[0]
                vendor_id = aes_data[2:4].decode('ascii', errors='ignore')
                aes_strength = aes_data[4]
                actual_compression = struct.unpack('<H', aes_data[5:7])[0]

                print(f"AES Version: {aes_version}")
                print(f"Vendor ID: '{vendor_id}'")
                print(f"AES Strength: {aes_strength} ({'AES-128' if aes_strength == 1 else 'AES-192' if aes_strength == 2 else 'AES-256' if aes_strength == 3 else 'Unknown'})")
                print(f"Actual compression: {actual_compression}")
            break

    if not aes_found:
        print("No WinZip AES extra field found, checking for other AES formats...")
        # Look for other possible AES indicators
        for i in range(len(extra_field)-1):
            if extra_field[i:i+2] == b'AE':
                print(f"Found 'AE' at offset {i}")

    # Extract encrypted data section
    data_offset = extra_offset + extra_len
    print()
    print("=== Encrypted Data Section ===")
    print(f"Data starts at offset: {data_offset}")

    # Based on the hex dump, we know the structure:
    # Salt appears to be at offset 41 (0x27 5d 93...)
    salt_start = 0x40  # From hex analysis
    salt = data[salt_start:salt_start+16]
    print(f"Salt (16 bytes): {binascii.hexlify(salt).decode()}")

    # Authentication code is typically at the end (10 bytes)
    # But let's find it by looking for the pattern

    # Find second file header to determine where first file data ends
    second_pk = data.find(b'PK\x03\x04', 100)  # Look for second file
    if second_pk > 0:
        print(f"Second file header found at offset: {second_pk}")
        # Auth code should be 10 bytes before second file header
        auth_start = second_pk - 10
        auth_code = data[auth_start:second_pk]
        print(f"Auth code (10 bytes): {binascii.hexlify(auth_code).decode()}")

        # Encrypted data is between salt and auth code
        encrypted_start = salt_start + 16
        encrypted_data = data[encrypted_start:auth_start]
        print(f"Encrypted data size: {len(encrypted_data)} bytes")
        print(f"First 32 bytes of encrypted data: {binascii.hexlify(encrypted_data[:32]).decode()}")

    print()
    print("=== Key Derivation Analysis ===")
    print("Standard WinZip AES parameters:")
    print("- Password: '1111'")
    print(f"- Salt: {binascii.hexlify(salt).decode()} (16 bytes)")
    print("- Algorithm: PBKDF2")
    print("- Hash: SHA-1")
    print("- Iterations: 1000")
    print("- Key size: 32 bytes (AES-256 key + HMAC key)")
    print()
    print("CRITICAL: Check if AutoTouch uses different iteration count or hash algorithm!")

if __name__ == "__main__":
    analyze_autotime_file("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate")