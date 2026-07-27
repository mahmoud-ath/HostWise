"""
Generate placeholder icons for HostWise Tauri app.

Run from the src-tauri directory:
    python generate_icons.py

Requires Pillow:
    pip install Pillow
"""
import subprocess
import sys
from pathlib import Path


def generate_icons():
    icons_dir = Path(__file__).parent / "icons"
    icons_dir.mkdir(exist_ok=True)

    # Try to use ImageMagick if available
    try:
        subprocess.run(
            ["convert", "--version"],
            capture_output=True,
            check=True,
        )
        has_imagemagick = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        has_imagemagick = False

    # Try Pillow as fallback
    try:
        from PIL import Image, ImageDraw, ImageFont
        has_pillow = True
    except ImportError:
        has_pillow = False

    if not has_imagemagick and not has_pillow:
        print("ERROR: Either ImageMagick or Pillow is required to generate icons.")
        print("Install Pillow: pip install Pillow")
        sys.exit(1)

    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }

    if has_pillow:
        _generate_with_pillow(icons_dir, sizes)
    else:
        _generate_with_imagemagick(icons_dir, sizes)

    # Generate ICO from the 512x512 icon
    img = Image.open(icons_dir / "icon.png")
    img.resize((256, 256), Image.LANCZOS).save(
        icons_dir / "icon.ico", format="ICO", sizes=[(256, 256)]
    )
    # ICNS: Pillow can't write ICNS, so just copy PNG (Tauri accepts PNG fallback)
    img.resize((256, 256), Image.LANCZOS).save(
        icons_dir / "icon.icns", format="PNG"
    )

    print("Icons generated successfully in:", icons_dir)


def _generate_with_imagemagick(icons_dir: Path, sizes: dict):
    """Use ImageMagick to generate icons with an 'H' letter."""
    for name, size in sizes.items():
        subprocess.run(
            [
                "convert",
                "-size", f"{size}x{size}",
                "xc:#2563EB",  # Blue background (Tailwind blue-600)
                "-fill", "white",
                "-font", "Helvetica-Bold",
                "-pointsize", str(int(size * 0.6)),
                "-gravity", "center",
                "-annotate", "+0+0", "H",
                str(icons_dir / name),
            ],
            check=True,
        )


def _generate_with_pillow(icons_dir: Path, sizes: dict):
    """Use Pillow to generate icons."""
    from PIL import Image, ImageDraw

    for name, size in sizes.items():
        img = Image.new("RGBA", (size, size), (37, 99, 235, 255))  # Blue-600
        draw = ImageDraw.Draw(img)

        # Draw a white "H" centered
        # Simple approach: draw rectangles to form an H
        thickness = max(size // 6, 4)
        spacing = size // 4
        center = size // 2

        # Left vertical bar
        draw.rectangle(
            [spacing, spacing, spacing + thickness, size - spacing],
            fill=(255, 255, 255, 255),
        )
        # Right vertical bar
        draw.rectangle(
            [size - spacing - thickness, spacing, size - spacing, size - spacing],
            fill=(255, 255, 255, 255),
        )
        # Horizontal bar
        draw.rectangle(
            [spacing, center - thickness // 2, size - spacing, center + thickness // 2],
            fill=(255, 255, 255, 255),
        )

        img.save(icons_dir / name, "PNG")

    print("  Icons generated with Pillow.")


if __name__ == "__main__":
    generate_icons()
