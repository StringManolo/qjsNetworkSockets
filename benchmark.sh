#!/bin/bash

# ============================================================================
# COMPREHENSIVE BENCHMARK CONFIGURATION
# ============================================================================
SERVER_HOST="127.0.0.1"
SERVER_PORT="8080"
BASE_URL="http://${SERVER_HOST}:${SERVER_PORT}"
RESULTS_DIR="benchmark_$(date +%Y%m%d_%H%M%S)"
MACHINE_INFO=$(uname -a)

# Load testing parameters
CONCURRENCY_LEVELS=(1 10 50 100 200)
TOTAL_REQUESTS=10000
DURATION_SECONDS=30
WARMUP_REQUESTS=1000

# Server configurations
NODE_SERVER_CMD="node ../tests/server.js"
QJS_SINGLE_CMD="qjs examples/testExpress.js"
QJS_CLUSTER_SCRIPT="./simpleCluster.sh"
CLUSTER_WORKERS=(1 2 4 8)

# Test endpoints
ENDPOINTS=(
    "/api/users"           # GET - JSON array
    "/api/users/1"         # GET - Single JSON
    "/api/users/2"         # GET - Single JSON
)
ENDPOINTS_TO_TEST=("${ENDPOINTS[@]:0:2}")  # First 2 endpoints for testing

# Request methods to test
REQUEST_METHODS=("GET" "POST")
REQUEST_PAYLOAD='{"name":"Test User","email":"test@example.com"}'

# ============================================================================
# IMPROVED LOGGING AND UTILITY FUNCTIONS
# ============================================================================
log() {
    local timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$RESULTS_DIR/benchmark.log"
}

error() {
    log "❌ ERROR: $1"
}

info() {
    log "ℹ️  INFO: $1"
}

kill_servers() {
    pkill -9 -f "$NODE_SERVER_CMD" 2>/dev/null
    pkill -9 -f "$QJS_SINGLE_CMD" 2>/dev/null
    pkill -9 -f "$QJS_CLUSTER_SCRIPT" 2>/dev/null
    pkill -9 -f "qjs.*testExpress" 2>/dev/null
    sleep 1
}

start_server() {
    local server_type=$1
    local workers=$2
    local log_file=$3
    
    kill_servers
    
    local pid=""
    
    case $server_type in
        "node")
            $NODE_SERVER_CMD > "$log_file" 2>&1 &
            pid=$!
            ;;
        "qjs_single")
            $QJS_SINGLE_CMD > "$log_file" 2>&1 &
            pid=$!
            ;;
        "qjs_cluster")
            $QJS_CLUSTER_SCRIPT $workers > "$log_file" 2>&1 &
            pid=$!
            sleep 3  # Give cluster more time to start
            ;;
        *)
            error "Unknown server type: $server_type"
            return 1
            ;;
    esac
    
    # Wait for server to start
    local max_wait=10
    local start_time=$(date +%s)
    
    while true; do
        # Try multiple endpoints to check if server is up
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null | grep -q "200\|404\|500" ||
           curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users" 2>/dev/null | grep -q "200\|404\|500" ||
           curl -s --head --max-time 1 "$BASE_URL" >/dev/null 2>&1; then
            echo $pid
            return 0
        fi
        
        # Check if process is still running
        if ! kill -0 $pid 2>/dev/null; then
            error "Server process died"
            return 1
        fi
        
        # Timeout check
        local current_time=$(date +%s)
        if [ $((current_time - start_time)) -ge $max_wait ]; then
            error "Server startup timeout"
            kill -9 $pid 2>/dev/null
            return 1
        fi
        
        sleep 0.5
    done
}

# ============================================================================
# ENHANCED BENCHMARK FUNCTIONS
# ============================================================================
parse_ab_output() {
    local file=$1
    local results=()
    
    # Try multiple patterns to extract data
    local rps=$(grep -E "Requests per second.*:[[:space:]]*[0-9.]+" "$file" | grep -o "[0-9.]\+" | head -1)
    [ -z "$rps" ] && rps=$(grep "Requests per second" "$file" | awk '{print $4}')
    [ -z "$rps" ] && rps=0
    
    # Parse latency (mean)
    local latency=$(grep "Time per request.*mean" "$file" | head -1 | awk '{print $4}')
    [ -z "$latency" ] && latency=0
    
    # Parse completed requests
    local complete=$(grep "Complete requests" "$file" | awk '{print $3}')
    [ -z "$complete" ] && complete=0
    
    # Parse failed requests
    local failed=$(grep "Failed requests" "$file" | awk '{print $3}')
    [ -z "$failed" ] && failed=0
    
    # Parse non-2xx responses
    local non2xx=$(grep "Non-2xx responses" "$file" | awk '{print $3}')
    [ -z "$non2xx" ] && non2xx=0
    
    # Parse time taken
    local time_taken=$(grep "Time taken for tests" "$file" | awk '{print $5}')
    [ -z "$time_taken" ] && time_taken=0
    
    # Parse transfer rate
    local transfer=$(grep "Transfer rate" "$file" | awk '{print $3}')
    [ -z "$transfer" ] && transfer=0
    
    results=("$rps" "$latency" "$complete" "$failed" "$non2xx" "$time_taken" "$transfer")
    echo "${results[@]}"
}

get_server_metrics() {
    local server_type=$1
    local pid=$2
    local workers=$3
    
    local cpu=0
    local mem=0
    local rss=0
    
    if [ "$server_type" = "qjs_cluster" ]; then
        # Get all worker PIDs - more specific pattern
        local pids=$(ps aux | grep -E "qjs.*testExpress" | grep -v grep | awk '{print $2}')
        if [ -n "$pids" ]; then
            local total_cpu=0
            local total_mem=0
            local total_rss=0
            local count=0
            
            for p in $pids; do
                local p_metrics=$(ps -p $p -o %cpu,%mem,rss --no-headers 2>/dev/null)
                if [ -n "$p_metrics" ]; then
                    local p_cpu=$(echo $p_metrics | awk '{print $1}')
                    local p_mem=$(echo $p_metrics | awk '{print $2}')
                    local p_rss=$(echo $p_metrics | awk '{print $3}')
                    
                    # Use awk for floating point addition
                    total_cpu=$(echo "$total_cpu $p_cpu" | awk '{printf "%.1f", $1 + $2}')
                    total_mem=$(echo "$total_mem $p_mem" | awk '{printf "%.1f", $1 + $2}')
                    total_rss=$((total_rss + p_rss))
                    count=$((count + 1))
                fi
            done
            
            if [ $count -gt 0 ]; then
                cpu=$total_cpu
                mem=$total_mem
                rss=$total_rss
            fi
        fi
    elif [ -n "$pid" ]; then
        # Single process
        local metrics=$(ps -p $pid -o %cpu,%mem,rss --no-headers 2>/dev/null)
        if [ -n "$metrics" ]; then
            cpu=$(echo $metrics | awk '{print $1}')
            mem=$(echo $metrics | awk '{print $2}')
            rss=$(echo $metrics | awk '{print $3}')
        fi
    fi
    
    echo "$cpu $mem $rss"
}

run_benchmark() {
    local server_type=$1
    local workers=$2
    local endpoint=$3
    local method=$4
    local concurrency=$5
    
    local label="${server_type}"
    [ "$server_type" = "qjs_cluster" ] && label="${label}_${workers}w"
    label="${label}_${method}_${concurrency}c_${endpoint//\//_}"
    
    log "Testing: $label"
    
    # Start server
    local pid=$(start_server "$server_type" "$workers" "$RESULTS_DIR/${label}_server.log")
    if [ -z "$pid" ]; then
        error "Failed to start server for $label"
        return 1
    fi
    
    # Warmup
    if [ $WARMUP_REQUESTS -gt 0 ]; then
        info "  Warming up with $WARMUP_REQUESTS requests..."
        ab -n $WARMUP_REQUESTS -c 5 "$BASE_URL$endpoint" >/dev/null 2>&1 || true
        sleep 1
    fi
    
    # Run benchmark
    local ab_output="$RESULTS_DIR/${label}_ab.txt"
    local ab_opts=""
    
    # Build ab command based on method
    if [ "$method" = "GET" ]; then
        ab_opts="ab -n $TOTAL_REQUESTS -c $concurrency -k $BASE_URL$endpoint"
    elif [ "$method" = "POST" ]; then
        # Create temporary file for POST data
        echo "$REQUEST_PAYLOAD" > /tmp/post_data.json
        ab_opts="ab -n $TOTAL_REQUESTS -c $concurrency -k -p /tmp/post_data.json -T application/json $BASE_URL$endpoint"
    fi
    
    info "  Running benchmark: $TOTAL_REQUESTS requests, $concurrency concurrent..."
    
    # Run ab with timeout and capture output
    timeout $((DURATION_SECONDS + 10)) \
        bash -c "$ab_opts" > "$ab_output" 2>&1
    
    local ab_status=$?
    
    # Check if ab succeeded
    if [ $ab_status -eq 124 ]; then
        error "  Benchmark timed out"
    elif [ $ab_status -ne 0 ]; then
        error "  Benchmark failed with exit code $ab_status"
        # Try to extract partial results
        if [ -f "$ab_output" ]; then
            # Check if we got any output
            if grep -q "Complete requests" "$ab_output"; then
                info "  Partial results available"
            else
                error "  No usable results in output"
                # Kill server and return
                kill_servers
                return 1
            fi
        fi
    fi
    
    # Parse results
    local parsed_results
    parsed_results=$(parse_ab_output "$ab_output")
    read rps latency complete failed non2xx time_taken transfer <<< "$parsed_results"
    
    # Get server metrics
    local metrics
    metrics=$(get_server_metrics "$server_type" "$pid" "$workers")
    read cpu mem rss <<< "$metrics"
    
    # Calculate efficiency metrics
    local ram_mb=0
    if [ -n "$rss" ] && [ "$rss" -gt 0 ]; then
        ram_mb=$(echo "scale=1; $rss / 1024" | bc 2>/dev/null || echo "0")
    fi
    
    local req_per_mb=0
    if [ "$ram_mb" != "0" ] && [ "$rps" != "0" ]; then
        req_per_mb=$(echo "scale=1; $rps / $ram_mb" | bc 2>/dev/null || echo "0")
    fi
    
    # Save detailed results
    echo "$label,$server_type,$workers,$endpoint,$method,$concurrency,$rps,$latency,$complete,$failed,$non2xx,$time_taken,$transfer,$cpu,$mem,$ram_mb,$req_per_mb" \
        >> "$RESULTS_DIR/results_detailed.csv"
    
    log "  Results: ${rps} req/s, ${latency}ms latency, ${ram_mb}MB RAM, ${req_per_mb} req/s/MB"
    
    # Kill server
    kill_servers
    sleep 2
    
    return 0
}

run_server_comprehensive_test() {
    local server_type=$1
    local workers=$2
    
    info "Starting comprehensive benchmark for $server_type (workers: ${workers:-1})"
    
    local test_count=0
    for concurrency in "${CONCURRENCY_LEVELS[@]}"; do
        for endpoint in "${ENDPOINTS_TO_TEST[@]}"; do
            # Test GET method
            run_benchmark "$server_type" "$workers" "$endpoint" "GET" "$concurrency"
            test_count=$((test_count + 1))
            
            # Brief pause between tests
            sleep 2
        done
    done
    
    info "Completed $test_count tests for $server_type"
}

# ============================================================================
# COMPREHENSIVE REPORT GENERATION
# ============================================================================
generate_reports() {
    info "Generating comprehensive reports..."
    
    # Check if we have results
    if [ ! -f "$RESULTS_DIR/results_detailed.csv" ] || [ $(wc -l < "$RESULTS_DIR/results_detailed.csv") -le 1 ]; then
        error "No results to generate reports from"
        return 1
    fi
    
    # Summary CSV
    echo "server_type,workers,concurrency,avg_rps,max_rps,avg_latency_ms,min_latency_ms,avg_ram_mb,avg_efficiency" \
        > "$RESULTS_DIR/results_summary.csv"
    
    # Group by server type, workers and concurrency
    awk -F, '
    NR>1 {
        key = $2 "," $3 "," $6  # server_type,workers,concurrency
        count[key]++
        rps_sum[key] += $7
        latency_sum[key] += $8
        ram_sum[key] += $16
        eff_sum[key] += $17
        
        if ($7 > rps_max[key] || count[key]==1) rps_max[key] = $7
        if ($8 < latency_min[key] || count[key]==1) latency_min[key] = $8
    }
    END {
        for (k in count) {
            avg_rps = rps_sum[k]/count[k]
            avg_latency = latency_sum[k]/count[k]
            avg_ram = ram_sum[k]/count[k]
            avg_eff = eff_sum[k]/count[k]
            printf "%s,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f\n", 
                k, avg_rps, rps_max[k], avg_latency, latency_min[k], avg_ram, avg_eff
        }
    }' "$RESULTS_DIR/results_detailed.csv" | sort -t, -k3n > "$RESULTS_DIR/results_summary.tmp"
    
    # Sort and add header
    sort -t, -k1,1 -k2,2n -k3,3n "$RESULTS_DIR/results_summary.tmp" >> "$RESULTS_DIR/results_summary.csv"
    rm "$RESULTS_DIR/results_summary.tmp"
    
    # Generate markdown report
    cat > "$RESULTS_DIR/REPORT.md" <<EOF
# Benchmark Report
**Date:** $(date)  
**Machine:** $MACHINE_INFO  
**Test Duration:** $DURATION_SECONDS seconds per test  
**Total Requests per Test:** $TOTAL_REQUESTS  

## Test Configuration
- **Concurrency Levels:** ${CONCURRENCY_LEVELS[*]}
- **Endpoints Tested:** ${ENDPOINTS_TO_TEST[*]}
- **Methods Tested:** GET

## Performance Summary

### By Server Type
| Server Type | Workers | Concurrency | Avg RPS | Max RPS | Avg Latency | Min Latency | Avg RAM (MB) | Efficiency (RPS/MB) |
|-------------|---------|-------------|---------|---------|-------------|-------------|--------------|---------------------|
$(awk -F, 'NR>1 {
    printf "| %s | %s | %s | %.1f | %.1f | %.1f | %.1f | %.1f | %.1f |\n", 
        $1, $2, $3, $4, $5, $6, $7, $8, $9
}' "$RESULTS_DIR/results_summary.csv")

### Detailed Results
| Test Label | Server | Workers | Concurrency | Endpoint | Method | RPS | Latency (ms) | RAM (MB) | Efficiency |
|------------|--------|---------|-------------|----------|--------|-----|--------------|----------|------------|
$(awk -F, 'NR>1 {
    if (NR <= 21) {  # Show first 20 results
        printf "| %s | %s | %s | %s | %s | %s | %.1f | %.1f | %.1f | %.1f |\n", 
            $1, $2, $3, $6, $4, $5, $7, $8, $16, $17
    }
}' "$RESULTS_DIR/results_detailed.csv")

## Key Metrics

### Throughput (Requests per Second)
\`\`\`
$(awk -F, 'NR>1 {printf "%-40s: %8.1f req/s\n", $1, $7}' "$RESULTS_DIR/results_detailed.csv" | sort -k2rn | head -10)
\`\`\`

### Memory Efficiency (Requests per Second per MB)
\`\`\`
$(awk -F, 'NR>1 && $16 > 0 {printf "%-40s: %8.1f req/s/MB\n", $1, $17}' "$RESULTS_DIR/results_detailed.csv" | sort -k2rn | head -10)
\`\`\`

### Best Latency
\`\`\`
$(awk -F, 'NR>1 && $8 > 0 {printf "%-40s: %8.1f ms\n", $1, $8}' "$RESULTS_DIR/results_detailed.csv" | sort -k2n | head -10)
\`\`\`

## Raw Data Files
- \`results_detailed.csv\`: Complete test results
- \`results_summary.csv\`: Aggregated statistics
- \`*_ab.txt\`: Raw ApacheBench output
- \`*_server.log\`: Server logs during tests

EOF
    
    # Generate simple text summary
    cat > "$RESULTS_DIR/SUMMARY.txt" <<EOF
BENCHMARK SUMMARY
=================
Date: $(date)
Machine: $MACHINE_INFO

TOP PERFORMERS:
$(echo "Server Type | Workers | Concurrency | RPS | Latency | RAM | Efficiency"
echo "------------|---------|-------------|-----|---------|-----|-----------"
awk -F, 'NR>1 {printf "%s | %s | %s | %.1f | %.1fms | %.1fMB | %.1f\n", $2, $3, $6, $7, $8, $16, $17}' "$RESULTS_DIR/results_detailed.csv" | sort -k4rn | head -10)

BEST MEMORY EFFICIENCY:
$(awk -F, 'NR>1 && $16 > 0 {printf "%s-%sw-%sc: %.1f req/s/MB\n", $2, $3, $6, $17}' "$RESULTS_DIR/results_detailed.csv" | sort -k2rn | head -10)

EOF
    
    log "Reports generated in $RESULTS_DIR/"
    log "View summary: cat $RESULTS_DIR/SUMMARY.txt"
}

# ============================================================================
# SIMPLIFIED MAIN EXECUTION
# ============================================================================
main() {
    echo "========================================"
    echo "🚀 COMPREHENSIVE BENCHMARK SUITE"
    echo "========================================"
    echo "Machine: $MACHINE_INFO"
    echo "Results directory: $RESULTS_DIR"
    echo ""
    
    # Create directories
    mkdir -p "$RESULTS_DIR"
    
    # Initialize results files
    echo "test_label,server_type,workers,endpoint,method,concurrency,requests_per_sec,latency_ms,complete_requests,failed_requests,non_2xx_responses,time_taken_s,transfer_kb_per_sec,cpu_percent,mem_percent,ram_mb,req_per_sec_per_mb" \
        > "$RESULTS_DIR/results_detailed.csv"
    
    # Save test configuration
    cat > "$RESULTS_DIR/test_config.json" <<EOF
{
    "timestamp": "$(date)",
    "machine_info": "$MACHINE_INFO",
    "server_host": "$SERVER_HOST",
    "server_port": "$SERVER_PORT",
    "concurrency_levels": [$(IFS=,; echo "${CONCURRENCY_LEVELS[*]}")],
    "total_requests": $TOTAL_REQUESTS,
    "duration_seconds": $DURATION_SECONDS,
    "warmup_requests": $WARMUP_REQUESTS,
    "endpoints": [$(printf '"%s",' "${ENDPOINTS[@]}" | sed 's/,$//')],
    "request_methods": [$(printf '"%s",' "${REQUEST_METHODS[@]}" | sed 's/,$//')],
    "cluster_workers": [$(IFS=,; echo "${CLUSTER_WORKERS[*]}")]
}
EOF
    
    # Calculate expected number of tests
    local num_endpoints=${#ENDPOINTS_TO_TEST[@]}
    local num_concurrencies=${#CONCURRENCY_LEVELS[@]}
    local num_servers=$((1 + 1 + ${#CLUSTER_WORKERS[@]}))  # node + qjs_single + cluster workers
    
    local total_tests=$((num_servers * num_concurrencies * num_endpoints))
    log "Expected tests: $total_tests (${num_servers} servers × ${num_concurrencies} concurrencies × ${num_endpoints} endpoints)"
    
    # 1. Node.js baseline
    log ""
    log "Phase 1/3: Node.js Baseline"
    run_server_comprehensive_test "node" "1"
    
    # 2. QuickJS Single Process
    log ""
    log "Phase 2/3: QuickJS Single Process"
    run_server_comprehensive_test "qjs_single" "1"
    
    # 3. QuickJS Cluster (different worker counts)
    log ""
    log "Phase 3/3: QuickJS Cluster"
    for workers in "${CLUSTER_WORKERS[@]}"; do
        log "Testing with $workers workers"
        run_server_comprehensive_test "qjs_cluster" "$workers"
        sleep 3
    done
    
    # Generate comprehensive reports
    generate_reports
    
    # Print quick summary
    echo ""
    echo "========================================"
    echo "🏁 BENCHMARK COMPLETE"
    echo "========================================"
    echo "Results directory: $RESULTS_DIR"
    echo ""
    
    # Show top 5 performers
    if [ -f "$RESULTS_DIR/results_detailed.csv" ]; then
        echo "📊 TOP 5 PERFORMERS BY RPS:"
        echo "----------------------------"
        awk -F, 'NR>1 {printf "%-40s %8.1f req/s %8.1fms %8.1fMB\n", $1, $7, $8, $16}' "$RESULTS_DIR/results_detailed.csv" \
            | sort -k2rn | head -5
        echo ""
        
        echo "💾 TOP 5 BY MEMORY EFFICIENCY:"
        echo "-------------------------------"
        awk -F, 'NR>1 && $16 > 0 {printf "%-40s %8.1f req/s/MB\n", $1, $17}' "$RESULTS_DIR/results_detailed.csv" \
            | sort -k2rn | head -5
        echo ""
    fi
    
    echo "📁 View detailed results:"
    echo "  - cat $RESULTS_DIR/SUMMARY.txt"
    echo "  - cat $RESULTS_DIR/REPORT.md"
    echo ""
}

# ============================================================================
# DEPENDENCY CHECK AND SETUP
# ============================================================================
check_dependencies() {
    local deps=("ab" "curl" "awk")
    local missing=()
    
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo "❌ Missing dependencies: ${missing[*]}"
        echo "   Install with:"
        echo "   Ubuntu/Debian: sudo apt-get install apache2-utils curl"
        exit 1
    fi
    
    # Check for bc (optional)
    if ! command -v bc &> /dev/null; then
        echo "⚠️  'bc' not found. Some calculations will be simplified."
    fi
    
    # Check for required files
    if [ ! -f "examples/testExpress.js" ]; then
        echo "❌ Missing examples/testExpress.js"
        exit 1
    fi
}

# Add health endpoint to testExpress.js if not present
setup_health_endpoint() {
    if ! grep -q "health" examples/testExpress.js; then
        echo "Adding health endpoint to testExpress.js..."
        cat >> examples/testExpress.js <<'EOF'

// Add health endpoint for benchmarking
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add root endpoint
app.get('/', (req, res) => {
    res.status(404).json({ error: 'Not found', message: 'Try /api/users' });
});

console.log('Server with health endpoint starting on port 8080...');
EOF
    fi
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================
check_dependencies
setup_health_endpoint
main
