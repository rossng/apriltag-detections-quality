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
- `--no-plot`: Skip generating the scatter plot

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

## Output

The script generates:

- A summary table showing quality metrics for each JPEG compression level
- An interactive scatter plot (`quality-analysis-plot.html`) showing the relationship between JPEG quality and detection accuracy for each image

## Configuration

Create a `.env.local` file to set the default RAW directory:

```
RAW_DIR=/path/to/your/raw/images
```

## Sample results

From a set of 195 24MP Sony RAW images:

![Sample scatter plot](./sample-results.png)

```
| Quality | Min Delta | Mean Delta | Median Delta | Max Delta | Missing Markers | Avg File Size |
| ------- | --------- | ---------- | ------------ | --------- | --------------- | ------------- |
| 0.10    | 0.00012   | 0.22951    | 0.17321      | 3.00382   | 50              | 731.8 KB      |
| 0.20    | 0.00124   | 0.20928    | 0.15543      | 3.78702   | 45              | 852.6 KB      |
| 0.30    | 0.00028   | 0.17227    | 0.12500      | 5.14818   | 46              | 1.1 MB        |
| 0.40    | 0.00191   | 0.13941    | 0.09872      | 2.93428   | 41              | 1.7 MB        |
| 0.50    | 0.00101   | 0.11538    | 0.07762      | 2.98037   | 41              | 2.4 MB        |
| 0.60    | 0.00055   | 0.09389    | 0.06186      | 3.86123   | 54              | 3.3 MB        |
| 0.70    | 0.00027   | 0.07851    | 0.05011      | 2.48330   | 37              | 4.6 MB        |
| 0.80    | 0.00024   | 0.07033    | 0.04213      | 3.20310   | 33              | 5.5 MB        |
| 0.90    | 0.00000   | 0.06122    | 0.03675      | 2.44429   | 37              | 6.9 MB        |
```
