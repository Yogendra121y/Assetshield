"""Create augmented sports-media dataset samples for local AI testing.

Usage:
  python tools/create_augmented_dataset.py --input ./seed_images --output ./sample_dataset
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import cv2


def ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def _load_image(path: str):
    return cv2.imread(path)


def _save(path: str, image):
    cv2.imwrite(path, image)


def generate_variants(image):
    h, w = image.shape[:2]
    variants = []

    # Resize variant
    variants.append(cv2.resize(image, (max(64, int(w * 0.8)), max(64, int(h * 0.8)))))

    # Center crop variant
    x0, y0 = int(w * 0.1), int(h * 0.1)
    x1, y1 = int(w * 0.9), int(h * 0.9)
    crop = image[y0:y1, x0:x1]
    variants.append(cv2.resize(crop, (w, h)))

    # Brightness/contrast tweak
    variants.append(cv2.convertScaleAbs(image, alpha=1.08, beta=12))

    # Compression artifact simulation
    ok, encoded = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 55])
    if ok:
        variants.append(cv2.imdecode(encoded, cv2.IMREAD_COLOR))

    return variants


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Folder containing original sports images')
    parser.add_argument('--output', required=True, help='Output dataset folder')
    args = parser.parse_args()

    ensure_dir(args.output)
    files = [p for p in Path(args.input).glob('*') if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}]

    if not files:
        print('No images found in input folder.')
        return

    count = 0
    for img_path in files:
        image = _load_image(str(img_path))
        if image is None:
            continue

        stem = img_path.stem
        _save(os.path.join(args.output, f'{stem}_orig.jpg'), image)
        count += 1

        for idx, variant in enumerate(generate_variants(image), start=1):
            _save(os.path.join(args.output, f'{stem}_var_{idx}.jpg'), variant)
            count += 1

    print(f'Created {count} dataset images in {args.output}')


if __name__ == '__main__':
    main()
