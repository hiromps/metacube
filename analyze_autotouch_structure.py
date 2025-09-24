#!/usr/bin/env python3
"""
AutoTouch .ate file structure analyzer
Analyzes the exact ZIP structure and AES parameters used by AutoTouch
"""

import struct
import binascii

def analyze_zip_structure(filename):
    """Analyze ZIP file structure byte by byte"""
    print(f"🔍 Analyzing AutoTouch file: {filename}")
    print("=" * 60)

    with open(filename, 'rb') as f:
        data = f.read()

    print(f"📄 Total file size: {len(data)} bytes")
    print(f"🔢 First 64 bytes (hex): {data[:64].hex()}")
    print()

    offset = 0
    entry_count = 0

    while offset < len(data):
        if offset + 4 > len(data):
            break

        # Read signature
        signature = struct.unpack('<I', data[offset:offset+4])[0]

        if signature == 0x04034b50:  # Local file header
            print(f"📁 LOCAL FILE HEADER #{entry_count + 1} at offset {offset:04X}")

            # Parse local file header
            if offset + 30 > len(data):
                break

            header = struct.unpack('<IHHHHHIIIHH', data[offset:offset+30])
            signature, version, flags, method, time, date, crc32, comp_size, uncomp_size, name_len, extra_len = header

            print(f"   Version needed: {version}")
            print(f"   Flags: 0x{flags:04X} (binary: {flags:016b})")
            print(f"   Compression method: {method}")
            print(f"   CRC32: 0x{crc32:08X}")
            print(f"   Compressed size: {comp_size}")
            print(f"   Uncompressed size: {uncomp_size}")
            print(f"   Filename length: {name_len}")
            print(f"   Extra field length: {extra_len}")

            # Read filename
            if name_len > 0:
                filename_bytes = data[offset+30:offset+30+name_len]
                filename_str = filename_bytes.decode('utf-8', errors='ignore')
                print(f"   Filename: {filename_str}")

            # Read extra field
            extra_offset = offset + 30 + name_len
            if extra_len > 0 and extra_offset + extra_len <= len(data):
                extra_data = data[extra_offset:extra_offset + extra_len]
                print(f"   Extra field: {extra_data.hex()}")

                # Parse AES extra field if present
                if len(extra_data) >= 11:
                    if extra_data[0:2] == b'\x01\x99':  # AES extra field ID
                        print(f"   🔐 AES Extra Field Found:")
                        aes_version = struct.unpack('<H', extra_data[4:6])[0]
                        vendor_id = extra_data[6:8]
                        aes_strength = extra_data[8]
                        comp_method = struct.unpack('<H', extra_data[9:11])[0]
                        print(f"      AES Version: {aes_version}")
                        print(f"      Vendor ID: {vendor_id}")
                        print(f"      AES Strength: {aes_strength} (1=128, 2=192, 3=256)")
                        print(f"      Compression method: {comp_method}")

            # Read encrypted data
            data_offset = offset + 30 + name_len + extra_len
            if comp_size > 0 and data_offset + comp_size <= len(data):
                encrypted_data = data[data_offset:data_offset + comp_size]
                print(f"   📊 Encrypted data: {len(encrypted_data)} bytes")
                print(f"   🔢 First 32 bytes: {encrypted_data[:32].hex()}")
                print(f"   🔢 Last 32 bytes: {encrypted_data[-32:].hex()}")

                # Try to identify salt, encrypted content, and auth code
                if len(encrypted_data) >= 26:  # 16 bytes salt + 10 bytes auth code minimum
                    salt = encrypted_data[:16]
                    auth_code = encrypted_data[-10:]
                    content = encrypted_data[16:-10]
                    print(f"   🧂 Probable salt (16 bytes): {salt.hex()}")
                    print(f"   🔐 Encrypted content: {len(content)} bytes")
                    print(f"   🔑 Probable auth code (10 bytes): {auth_code.hex()}")

            offset = data_offset + comp_size
            entry_count += 1
            print()

        elif signature == 0x02014b50:  # Central directory header
            print(f"📚 CENTRAL DIRECTORY HEADER at offset {offset:04X}")

            if offset + 46 > len(data):
                break

            header = struct.unpack('<IHHHHHHIIIHHHHHII', data[offset:offset+46])
            print(f"   Central directory entry for file #{entry_count}")

            # Skip to next entry
            name_len = header[12]
            extra_len = header[13]
            comment_len = header[14]
            offset += 46 + name_len + extra_len + comment_len
            print()

        elif signature == 0x06054b50:  # End of central directory
            print(f"🏁 END OF CENTRAL DIRECTORY at offset {offset:04X}")

            if offset + 22 > len(data):
                break

            header = struct.unpack('<IHHHHIIH', data[offset:offset+22])
            _, disk_num, cd_disk, entries_disk, entries_total, cd_size, cd_offset, comment_len = header
            print(f"   Total entries: {entries_total}")
            print(f"   Central directory size: {cd_size}")
            print(f"   Central directory offset: {cd_offset}")
            break

        else:
            print(f"❓ Unknown signature: 0x{signature:08X} at offset {offset:04X}")
            break

    print(f"\n📊 Analysis complete. Found {entry_count} file entries.")

if __name__ == "__main__":
    analyze_zip_structure(r'C:\Users\akihi\Downloads\WhatIsAutoTouch.ate')