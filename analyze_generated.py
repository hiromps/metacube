#!/usr/bin/env python3
"""
Analyze generated ATE file structure
"""

import struct
import sys

def analyze_zip_structure(filename):
    """Analyze ZIP file structure byte by byte"""
    print(f"[ANALYSIS] Analyzing generated file: {filename}")
    print("=" * 80)

    try:
        with open(filename, 'rb') as f:
            data = f.read()
    except FileNotFoundError:
        print(f"[ERROR] File not found: {filename}")
        return

    print(f"[INFO] Total file size: {len(data)} bytes")
    print(f"[HEX] First 128 bytes:")
    for i in range(0, min(128, len(data)), 16):
        chunk = data[i:i+16]
        hex_str = ' '.join([f'{b:02x}' for b in chunk])
        ascii_str = ''.join([chr(b) if 32 <= b <= 126 else '.' for b in chunk])
        print(f"{i:04X}: {hex_str:<48} | {ascii_str}")

    print()

    if len(data) < 4:
        print("[ERROR] File too small to be a ZIP")
        return

    # Check signature
    signature = struct.unpack('<I', data[0:4])[0]
    if signature != 0x04034b50:
        print(f"[ERROR] Invalid ZIP signature: 0x{signature:08X}")
        print(f"Expected: 0x04034b50 (PK..)")
        return

    print("[SUCCESS] Valid ZIP signature found")

    # Parse first header
    try:
        if len(data) < 30:
            print("[ERROR] File too small for complete ZIP header")
            return

        header = struct.unpack('<IHHHHHIIIHH', data[0:30])
        signature, version, flags, method, time, date, crc32, comp_size, uncomp_size, name_len, extra_len = header

        print(f"[HEADER] Local file header analysis:")
        print(f"   Version needed: {version} (should be 51 for AES)")
        print(f"   Flags: 0x{flags:04X} (should be 0x0809)")
        print(f"   Method: {method} (should be 99 for AES)")
        print(f"   CRC32: 0x{crc32:08X}")
        print(f"   Compressed size: {comp_size}")
        print(f"   Uncompressed size: {uncomp_size}")
        print(f"   Filename length: {name_len}")
        print(f"   Extra field length: {extra_len}")

        # Check if we can read filename
        if 30 + name_len <= len(data):
            filename_bytes = data[30:30+name_len]
            filename_str = filename_bytes.decode('utf-8', errors='ignore')
            print(f"   Filename: {filename_str}")
        else:
            print(f"   [ERROR] Cannot read filename - file truncated")

        # Check extra field
        extra_start = 30 + name_len
        if extra_start + extra_len <= len(data):
            extra_data = data[extra_start:extra_start + extra_len]
            print(f"   Extra field: {extra_data.hex()}")

            # Parse AES extra field
            if len(extra_data) >= 11 and extra_data[0:2] == b'\x01\x99':
                print(f"   [AES] Extra field analysis:")
                aes_version = struct.unpack('<H', extra_data[4:6])[0]
                vendor_id = extra_data[6:8]
                aes_strength = extra_data[8]
                comp_method = struct.unpack('<H', extra_data[9:11])[0]
                print(f"      AES Version: {aes_version}")
                print(f"      Vendor ID: {vendor_id}")
                print(f"      AES Strength: {aes_strength}")
                print(f"      Compression method: {comp_method}")

        # Check encrypted data
        data_start = extra_start + extra_len
        if data_start < len(data):
            encrypted_size = len(data) - data_start
            print(f"   [DATA] Encrypted payload: {encrypted_size} bytes")
            encrypted_data = data[data_start:data_start + min(32, encrypted_size)]
            print(f"   First 32 bytes: {encrypted_data.hex()}")

    except Exception as e:
        print(f"[ERROR] Failed to parse header: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_zip_structure(sys.argv[1])
    else:
        print("Usage: python analyze_generated.py <filename>")