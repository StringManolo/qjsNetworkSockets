#!/bin/bash

# Download QuickJS headers if not present
if [ ! -e "./lib/quickjs.h" ]; then
  echo "Downloading QuickJS headers..."
  curl -LO https://bellard.org/quickjs/quickjs-2025-09-13-2.tar.xz --silent
  tar -xf quickjs-2025-09-13-2.tar.xz
  mv quickjs-2025-09-13/quickjs.h ./lib/
  rm quickjs-2025-09-13* -rf
  echo "✓ Headers downloaded"
fi

echo "Compiling with optimizations..."

# PERFORMANCE BUILD - Maximum speed
gcc \
  -shared \
  -fPIC \
  -O3 \
  -march=native \
  -mtune=native \
  -flto \
  -ffast-math \
  -funroll-loops \
  -finline-functions \
  -fomit-frame-pointer \
  -fno-stack-protector \
  -pipe \
  -o ./dist/network_sockets.so \
  ./src/qjs_sockets.c \
  -I ./lib/ \
  -Wall \
  -Wextra

if [ $? -eq 0 ]; then
  SIZE=$(du -h ./dist/network_sockets.so | cut -f1)
  echo "✓ Done! (${SIZE})"
  echo ""
  echo "Optimizations applied:"
  echo "  • -O3 (maximum optimization)"
  echo "  • -march=native (CPU-specific instructions)"
  echo "  • -flto (link-time optimization)"
  echo "  • -ffast-math (fast floating point)"
  echo "  • -funroll-loops (loop unrolling)"
  echo "  • -finline-functions (aggressive inlining)"
  echo ""
  echo "Expected speedup: 3-5x faster than unoptimized build"
else
  echo "✗ Compilation failed"
  exit 1
fi
