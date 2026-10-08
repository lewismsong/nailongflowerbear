"""Generate display-sized WebP assets while keeping the source artwork intact."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIRECTORY = ROOT / "assets" / "images"
OUTPUT_DIRECTORY = IMAGE_DIRECTORY / "optimized"
WEBP_QUALITY = 85
WEBP_METHOD = 6
NAVIGATION_WIDTH = 176
HOUSE_WIDTH = 450

ASSETS = {
    "bear-with-flower.webp": (NAVIGATION_WIDTH, None),
    "bears-sitting-lake.webp": (NAVIGATION_WIDTH, None),
    "bears-airport.webp": (NAVIGATION_WIDTH, None),
    "bears.jpg": (NAVIGATION_WIDTH, None),
    "pakku.webp": (NAVIGATION_WIDTH, None),
    "chinese-temple.webp": (HOUSE_WIDTH, None),
    "cat-house.png": (HOUSE_WIDTH, None),
    "koala-tree-autumn.webp": (HOUSE_WIDTH, None),
    "pakku-slide.webp": (420, None),
    "pakku-yarn.webp": (108, None),
    "pakku-whale.webp": (164, None),
    "pakku-trampoline.webp": (300, None),
    "pakku-suitcase.webp": (200, None),
    # resize each frame separately so neighbouring frames cannot bleed at the edges.
    "cat-sprite-sheet-v3.webp": (192, (6, 5)),
}


def resize_image(image, width):
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def resize_sprite_sheet(image, frame_width, grid):
    columns, rows = grid
    if image.width % columns or image.height % rows:
        raise ValueError("sprite sheet dimensions must divide evenly into its grid")
    source_width = image.width // columns
    source_height = image.height // rows
    frame_height = round(source_height * frame_width / source_width)
    result = Image.new("RGBA", (frame_width * columns, frame_height * rows))
    for row in range(rows):
        for column in range(columns):
            left = column * source_width
            top = row * source_height
            frame = image.crop((left, top, left + source_width, top + source_height))
            result.paste(resize_image(frame, frame_width), (column * frame_width, row * frame_height))
    return result


def main():
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for filename, (width, grid) in ASSETS.items():
        source = IMAGE_DIRECTORY / filename
        destination = OUTPUT_DIRECTORY / (source.stem + ".webp")
        with Image.open(source) as image:
            image = image.convert("RGBA")
            resized = resize_sprite_sheet(image, width, grid) if grid else resize_image(image, width)
            resized.save(destination, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        print(f"{filename}: {source.stat().st_size:,} → {destination.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
