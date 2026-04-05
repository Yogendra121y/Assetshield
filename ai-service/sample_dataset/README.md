# Sample Dataset Guide

Use this folder for local "known/scraped" media samples.

## Build a test dataset (10-20 files)

1. Put 3-5 seed sports images in `ai-service/seed_images/`.
2. Run:

```bash
python tools/create_augmented_dataset.py --input ./seed_images --output ./sample_dataset
```

This generates modified variants (resize, crop, brightness, compression) to validate robustness.

## Use with backend

Set in `backend/.env`:

```bash
AI_DATASET_FOLDER=../ai-service/sample_dataset
```

Then trigger `/analyze` from the web app as usual.
