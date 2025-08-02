# AprilTag Detection Quality Analysis

Analyzes AprilTag detection quality across different JPEG compression levels.

## Setup

```bash
npm install
```

## Usage

```bash
node analyze-quality.js [subset_size] [raw_directory] [options]
```

### Arguments
- `subset_size`: Number of images to process (optional, default: all)
- `raw_directory`: Path to directory containing ARW files (optional, default: from .env.local)

### Options
- `--preserve`, `-p`: Keep converted files and print paths
- `--corners`, `-c`: Print corner positions ordered by marker ID

### Examples

Process all images in default directory:
```bash
node analyze-quality.js
```

Process 10 images from a specific directory:
```bash
node analyze-quality.js 10 /path/to/raw/images
```

Process 5 images and preserve converted files:
```bash
node analyze-quality.js 5 --preserve
```

## Configuration

Create a `.env.local` file to set the default RAW directory:
```
RAW_DIR=/path/to/your/raw/images
```