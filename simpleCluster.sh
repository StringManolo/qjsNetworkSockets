#!/usr/bin/env bash

NUM_WORKERS=${1:-4}
PORT=8080

echo "Starting $NUM_WORKERS workers on port $PORT..."

# Matar procesos anteriores
pkill -f "qjs.*testExpress" || true

# Iniciar workers
for i in $(seq 1 $NUM_WORKERS); do
    qjs examples/testExpress.js &
    echo "Worker $i started (PID $!)"
done

echo ""
echo "Cluster running with $NUM_WORKERS workers on port $PORT"
echo "The kernel will load balance between them automatically"
echo ""
echo "Press Ctrl+C to stop"

# Wait for Ctrl+C
wait
