#!/usr/bin/env python3
"""
Script to convert Google Docs .gdoc files to .docx and commit to git.
This script assumes you have already downloaded the .docx files from Google Drive
and placed them in the same directories as the .gdoc files.

Usage:
1. Download each .gdoc from Google Drive as .docx (File > Download > Microsoft Word (.docx))
2. Place the downloaded .docx files in the same folders as the original .gdoc files
3. Run this script: python convert_gdocs.py

The script will:
- Find all .gdoc files
- Check if corresponding .docx exists
- Remove .gdoc and rename .docx to match the original name (without .gdoc extension)
- Commit the changes to git
"""

import os
import subprocess
import sys

def find_gdoc_files(root_dir):
    """Find all .gdoc files in the directory tree."""
    gdoc_files = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.gdoc'):
                gdoc_files.append(os.path.join(root, file))
    return gdoc_files

def convert_and_commit(gdoc_files):
    """Convert .gdoc to .docx and commit."""
    converted = []
    for gdoc_path in gdoc_files:
        # Get the base name without .gdoc
        base_name = os.path.splitext(gdoc_path)[0]
        docx_path = base_name + '.docx'

        if os.path.exists(docx_path):
            print(f"Converting: {gdoc_path} -> {docx_path}")
            # Remove the .gdoc file
            os.remove(gdoc_path)
            # The .docx is already there, so we just need to commit it
            converted.append(docx_path)
        else:
            print(f"Warning: .docx not found for {gdoc_path}. Please download it first.")

    if converted:
        # Add to git
        subprocess.run(['git', 'add'] + converted, check=True)
        # Commit
        subprocess.run(['git', 'commit', '-m', 'Convert Google Docs to .docx format'], check=True)
        print(f"Committed {len(converted)} converted files.")
    else:
        print("No files were converted.")

def main():
    root_dir = '.'  # Current directory
    gdoc_files = find_gdoc_files(root_dir)

    if not gdoc_files:
        print("No .gdoc files found in the current directory.")
        return

    print(f"Found {len(gdoc_files)} .gdoc files:")
    for f in gdoc_files:
        print(f"  {f}")

    print("\nMake sure you have downloaded the corresponding .docx files from Google Drive.")
    response = input("Proceed with conversion and commit? (y/N): ").strip().lower()

    if response == 'y':
        convert_and_commit(gdoc_files)
    else:
        print("Conversion cancelled.")

if __name__ == '__main__':
    main()