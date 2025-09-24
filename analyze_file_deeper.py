#!/usr/bin/env python3
"""Deeper analysis of AutoTouch file structure to find the correct encryption approach"""

import binascii
import struct

def analyze_file_deeper():
    """Perform deeper analysis of the AutoTouch file structure"""

    with open("C:/Users/akihi/Downloads/WhatIsAutoTouch.ate", 'rb') as f:
        data = f.read()

    print("Deep Analysis of AutoTouch File")
    print("=" * 40)
    print()

    # Look for any readable strings that might give us clues
    print("Searching for readable strings in the file:")
    readable_strings = []
    current_string = ""

    for i, byte in enumerate(data):
        if 32 <= byte <= 126:  # Printable ASCII
            current_string += chr(byte)
        else:
            if len(current_string) >= 4:
                readable_strings.append((i - len(current_string), current_string))
            current_string = ""

    if len(current_string) >= 4:
        readable_strings.append((len(data) - len(current_string), current_string))

    for offset, string in readable_strings[:20]:  # Show first 20
        print(f"Offset {offset:04x}: '{string}'")

    print()

    # Look for patterns that might indicate different encryption libraries
    print("Checking for different encryption library signatures:")

    # Check for different magic numbers or headers
    patterns_to_check = [
        (b'7z\xbc\xaf\x27\x1c', "7-Zip format"),
        (b'Rar!', "RAR format"),
        (b'\x1f\x8b', "GZIP format"),
        (b'ZIPX', "WinZip extended format"),
        (b'WinZip', "WinZip signature"),
        (b'AES', "AES signature"),
        (b'OpenSSL', "OpenSSL signature"),
        (b'CryptoJS', "CryptoJS signature"),
        (b'FIPS', "FIPS crypto"),
    ]

    for pattern, description in patterns_to_check:
        pos = data.find(pattern)
        if pos >= 0:
            print(f"Found {description} at offset {pos:04x}")

    print()

    # Analyze the extra field more carefully
    print("Extra Field Deep Analysis:")

    # We know the extra field starts at offset 39 (0x27)
    extra_start = 39
    extra_field = data[extra_start:extra_start + 31]  # 31 bytes extra field

    print(f"Extra field raw: {binascii.hexlify(extra_field).decode()}")

    # Break down the extra field
    offset = 0
    while offset < len(extra_field) - 4:
        field_id = struct.unpack('<H', extra_field[offset:offset+2])[0]
        field_size = struct.unpack('<H', extra_field[offset+2:offset+4])[0]

        print(f"Field ID: 0x{field_id:04x}, Size: {field_size}")

        if field_id == 0x0001:  # ZIP64 extended info
            print("  ZIP64 extended information")
        elif field_id == 0x9901:  # WinZip AES
            print("  WinZip AES extra field")
            if offset + 4 + field_size <= len(extra_field):
                aes_data = extra_field[offset+4:offset+4+field_size]
                if len(aes_data) >= 7:
                    aes_version = struct.unpack('<H', aes_data[0:2])[0]
                    vendor = aes_data[2:4]
                    strength = aes_data[4]
                    method = struct.unpack('<H', aes_data[5:7])[0]
                    print(f"    Version: {aes_version}, Vendor: {vendor}, Strength: {strength}, Method: {method}")
        else:
            print(f"  Unknown field type")

        # Try to extract field data
        if offset + 4 + field_size <= len(extra_field):
            field_data = extra_field[offset+4:offset+4+field_size]
            print(f"  Data: {binascii.hexlify(field_data).decode()}")

        offset += 4 + field_size

    print()

    # Check if the file might be using a different approach entirely
    print("Alternative Analysis - Check for non-standard formats:")

    # Look for potential custom headers after the ZIP structure
    print("Checking data after filename and extra field:")
    data_start = 70  # 30 (header) + 9 (filename) + 31 (extra)

    # Check first 100 bytes of the data section
    data_section = data[data_start:data_start + 100]
    print(f"First 100 bytes of data section: {binascii.hexlify(data_section).decode()}")

    # Check if it might be base64 encoded
    try:
        import base64
        # Try to decode as base64
        try:
            decoded = base64.b64decode(data_section)
            print(f"Base64 decode attempt: {binascii.hexlify(decoded[:32]).decode()}")
        except:
            print("Not base64 encoded")
    except ImportError:
        pass

    # Look for entropy patterns that might indicate different encryption
    print()
    print("Entropy analysis (looking for patterns):")

    # Analyze byte distribution in the encrypted section
    byte_counts = [0] * 256
    for byte in data_section:
        byte_counts[byte] += 1

    # Check if distribution is uniform (high entropy, good encryption)
    # or if there are patterns (bad encryption or different format)
    non_zero_bytes = sum(1 for count in byte_counts if count > 0)
    max_count = max(byte_counts)
    min_count = min(count for count in byte_counts if count > 0) if non_zero_bytes > 0 else 0

    print(f"Unique bytes: {non_zero_bytes}/256")
    print(f"Max frequency: {max_count}, Min frequency: {min_count}")

    if max_count > len(data_section) * 0.1:
        print("WARNING: High byte frequency detected - might not be properly encrypted")

    # Check for repeating patterns
    for i in range(len(data_section) - 16):
        chunk = data_section[i:i+16]
        if data_section.count(chunk) > 1:
            print(f"Repeating 16-byte pattern found at offset {i}: {binascii.hexlify(chunk).decode()}")

if __name__ == "__main__":
    analyze_file_deeper()