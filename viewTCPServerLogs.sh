#!/bin/bash

# Script to view and analyze server logs

LOG_FILE="server.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -a, --all          Show all logs"
    echo "  -r, --requests     Show only request logs"
    echo "  -e, --errors       Show only error logs"
    echo "  -s, --stats        Show statistics"
    echo "  -t, --tail         Tail the log file (live)"
    echo "  -c, --clear        Clear the log file"
    echo "  -h, --help         Show this help message"
    echo ""
}

show_all() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=== All Server Logs ===${NC}"
    cat "$LOG_FILE"
}

show_requests() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=== Request Logs ===${NC}"
    grep -E "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT" "$LOG_FILE" | while read -r line; do
        if echo "$line" | grep -q " 200 "; then
            echo -e "${GREEN}$line${NC}"
        elif echo "$line" | grep -q " 404 "; then
            echo -e "${YELLOW}$line${NC}"
        elif echo "$line" | grep -q " 400 \| 500 \| 501 "; then
            echo -e "${RED}$line${NC}"
        else
            echo "$line"
        fi
    done
}

show_errors() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=== Error Logs ===${NC}"
    grep "ERROR:" "$LOG_FILE" | while read -r line; do
        echo -e "${RED}$line${NC}"
    done
    
    # Also show 4xx and 5xx responses
    echo ""
    echo -e "${BLUE}=== Failed Requests (4xx/5xx) ===${NC}"
    grep -E " (400|404|500|501) " "$LOG_FILE" | while read -r line; do
        echo -e "${RED}$line${NC}"
    done
}

show_stats() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=== Server Statistics ===${NC}"
    echo ""
    
    # Total requests
    total=$(grep -cE "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT" "$LOG_FILE")
    echo "Total Requests: $total"
    
    # Requests by method
    echo ""
    echo "Requests by Method:"
    for method in GET POST PUT DELETE PATCH HEAD OPTIONS TRACE CONNECT; do
        count=$(grep -c "^.*$method " "$LOG_FILE")
        if [ $count -gt 0 ]; then
            echo "  $method: $count"
        fi
    done
    
    # Status codes
    echo ""
    echo "Responses by Status Code:"
    echo "  200 OK: $(grep -c " 200 " "$LOG_FILE")"
    echo "  400 Bad Request: $(grep -c " 400 " "$LOG_FILE")"
    echo "  404 Not Found: $(grep -c " 404 " "$LOG_FILE")"
    echo "  501 Not Implemented: $(grep -c " 501 " "$LOG_FILE")"
    
    # Average response time
    echo ""
    avg_time=$(grep -oP '\(\K[0-9]+(?=ms\))' "$LOG_FILE" | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
    echo "Average Response Time: ${avg_time}ms"
    
    # Most requested URIs
    echo ""
    echo "Top 5 Most Requested URIs:"
    grep -oP '(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT) \K[^ ]+' "$LOG_FILE" | sort | uniq -c | sort -rn | head -5 | while read -r count uri; do
        echo "  $uri: $count requests"
    done
}

tail_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}No log file found at $LOG_FILE${NC}"
        echo "Waiting for log file to be created..."
        touch "$LOG_FILE"
    fi
    
    echo -e "${BLUE}=== Tailing Server Logs (Ctrl+C to stop) ===${NC}"
    tail -f "$LOG_FILE" | while read -r line; do
        if echo "$line" | grep -q "ERROR:"; then
            echo -e "${RED}$line${NC}"
        elif echo "$line" | grep -q " 200 "; then
            echo -e "${GREEN}$line${NC}"
        elif echo "$line" | grep -q " 404 "; then
            echo -e "${YELLOW}$line${NC}"
        elif echo "$line" | grep -q " 400 \| 500 \| 501 "; then
            echo -e "${RED}$line${NC}"
        else
            echo "$line"
        fi
    done
}

clear_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}Clearing log file...${NC}"
        > "$LOG_FILE"
        echo -e "${GREEN}Log file cleared${NC}"
    else
        echo -e "${YELLOW}No log file found${NC}"
    fi
}

# Parse command line arguments
case "${1:-}" in
    -a|--all)
        show_all
        ;;
    -r|--requests)
        show_requests
        ;;
    -e|--errors)
        show_errors
        ;;
    -s|--stats)
        show_stats
        ;;
    -t|--tail)
        tail_logs
        ;;
    -c|--clear)
        clear_logs
        ;;
    -h|--help|*)
        show_help
        ;;
esac
