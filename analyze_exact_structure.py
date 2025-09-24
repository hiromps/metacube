#!/usr/bin/env python3
"""
Complete binary analysis of AutoTouch .ate file
Extract exact salt, encrypted data, and auth code patterns
"""

import struct
import binascii

def analyze_complete_structure(filename):
    """Complete analysis of AutoTouch file structure"""
    print(f"[DEEP_ANALYSIS] Complete binary analysis of: {filename}")
    print("=" * 80)

    with open(filename, 'rb') as f:
        data = f.read()

    print(f"[INFO] Total file size: {len(data)} bytes")
    print(f"[HEX] Complete file hex dump:")

    # Print complete hex dump in chunks
    for i in range(0, len(data), 32):
        chunk = data[i:i+32]
        hex_str = chunk.hex()
        ascii_str = ''.join([chr(b) if 32 <= b <= 126 else '.' for b in chunk])
        print(f"{i:04X}: {hex_str:<64} | {ascii_str}")

    print("\n" + "=" * 80)
    print("[ANALYSIS] Looking for data patterns...")

    # Find local file header
    offset = 0
    if data[offset:offset+4] == b'PK\x03\x04':
        print(f"[HEADER] Local file header found at {offset:04X}")

        # Parse header
        header = struct.unpack('<IHHHHHIIIHH', data[offset:offset+30])
        signature, version, flags, method, time, date, crc32, comp_size, uncomp_size, name_len, extra_len = header

        print(f"   Version: {version}")
        print(f"   Flags: 0x{flags:04X}")
        print(f"   Method: {method}")
        print(f"   Compressed size: {comp_size}")
        print(f"   Uncompressed size: {uncomp_size}")
        print(f"   Filename length: {name_len}")
        print(f"   Extra field length: {extra_len}")

        # Get filename
        filename_start = offset + 30
        if name_len > 0:
            filename_bytes = data[filename_start:filename_start + name_len]
            print(f"   Filename: {filename_bytes.decode('utf-8', errors='ignore')}")

        # Get extra field
        extra_start = filename_start + name_len
        if extra_len > 0:
            extra_data = data[extra_start:extra_start + extra_len]
            print(f"   Extra field ({extra_len} bytes): {extra_data.hex()}")

        # Get encrypted data
        data_start = extra_start + extra_len
        remaining_data = data[data_start:]
        print(f"\n[ENCRYPTED_DATA] Remaining data ({len(remaining_data)} bytes):")
        print(f"   First 64 bytes: {remaining_data[:64].hex()}")
        print(f"   Last 64 bytes: {remaining_data[-64:].hex()}")

        # Try to identify components
        print(f"\n[PATTERN_ANALYSIS] Identifying encryption components:")

        # Look for potential salt (usually first 16 bytes)
        if len(remaining_data) >= 16:
            potential_salt = remaining_data[:16]
            print(f"   Potential salt (16 bytes): {potential_salt.hex()}")

        # Look for potential auth code (usually last 10 bytes)
        if len(remaining_data) >= 10:
            potential_auth = remaining_data[-10:]
            print(f"   Potential auth code (10 bytes): {potential_auth.hex()}")

        # Middle part would be encrypted content
        if len(remaining_data) >= 26:  # 16 salt + 10 auth
            potential_content = remaining_data[16:-10]
            print(f"   Potential encrypted content: {len(potential_content)} bytes")
            if len(potential_content) > 0:
                print(f"      First 32 bytes: {potential_content[:32].hex()}")

        # Look for repeating patterns or null bytes
        print(f"\n[PATTERN_SEARCH] Looking for patterns...")

        # Check for null byte sequences
        null_sequences = []
        i = 0
        while i < len(remaining_data) - 4:
            if remaining_data[i:i+4] == b'\x00\x00\x00\x00':
                null_sequences.append(i)
                i += 4
            else:
                i += 1

        if null_sequences:
            print(f"   Found null sequences at offsets: {null_sequences}")

        # Check for common patterns
        common_patterns = [b'\x00\x00', b'\xFF\xFF', b'\x01\x00', b'\x99\x01']
        for pattern in common_patterns:
            positions = []
            start = 0
            while True:
                pos = remaining_data.find(pattern, start)
                if pos == -1:
                    break
                positions.append(pos)
                start = pos + 1
            if positions:
                print(f"   Pattern {pattern.hex()} found at: {positions}")

    # Look for central directory
    cd_offset = data.find(b'PK\x01\x02')
    if cd_offset != -1:
        print(f"\n[CENTRAL_DIR] Central directory at offset {cd_offset:04X}")

    # Look for end of central directory
    end_offset = data.find(b'PK\x05\x06')
    if end_offset != -1:
        print(f"[END_DIR] End of central directory at offset {end_offset:04X}")

if __name__ == "__main__":
    analyze_complete_structure(r'C:\Users\akihi\Downloads\WhatIsAutoTouch.ate')