#!/bin/bash
# ============================================================================
# AgentPay Backup Script
# ============================================================================
# Automated backup for production AgentPay deployment
# Backs up: PostgreSQL database, Redis data, configuration files
# ============================================================================

set -e
set -u

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/agentpay}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="agentpay_backup_${TIMESTAMP}"

# Database credentials (from .env.production)
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# ============================================================================
# Create backup directory
# ============================================================================
create_backup_dir() {
    info "Creating backup directory: ${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
}

# ============================================================================
# Backup PostgreSQL database
# ============================================================================
backup_database() {
    info "Backing up PostgreSQL database..."

    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}/database.sql.gz"

    # Check if Docker deployment
    if command -v docker &> /dev/null && docker ps | grep -q agentpay-postgres; then
        info "Docker deployment detected"
        docker exec agentpay-postgres pg_dump -U agentpay agentpay_production | gzip > "$backup_file"
    else
        # Manual deployment
        if [ -n "${POLAR_POSTGRES_HOST:-}" ]; then
            PGPASSWORD="${POLAR_POSTGRES_PWD}" pg_dump \
                -h "${POLAR_POSTGRES_HOST}" \
                -p "${POLAR_POSTGRES_PORT:-5432}" \
                -U "${POLAR_POSTGRES_USER}" \
                -d "${POLAR_POSTGRES_DATABASE}" \
                | gzip > "$backup_file"
        else
            warn "Database credentials not found. Skipping database backup."
            return
        fi
    fi

    local size=$(du -h "$backup_file" | cut -f1)
    info "Database backup completed: $backup_file ($size)"
}

# ============================================================================
# Backup Redis data
# ============================================================================
backup_redis() {
    info "Backing up Redis data..."

    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}/redis.rdb"

    # Check if Docker deployment
    if command -v docker &> /dev/null && docker ps | grep -q agentpay-redis; then
        info "Docker deployment detected"

        # Trigger Redis SAVE
        docker exec agentpay-redis redis-cli SAVE

        # Copy RDB file
        docker cp agentpay-redis:/data/dump.rdb "$backup_file" 2>/dev/null || true
    else
        warn "Redis backup not implemented for non-Docker deployments"
        return
    fi

    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        info "Redis backup completed: $backup_file ($size)"
    else
        warn "Redis backup file not found"
    fi
}

# ============================================================================
# Backup configuration files
# ============================================================================
backup_config() {
    info "Backing up configuration files..."

    local config_dir="${BACKUP_DIR}/${BACKUP_NAME}/config"
    mkdir -p "$config_dir"

    # Copy environment file (without secrets)
    if [ -f .env.production ]; then
        grep -v "SECRET\|KEY\|PASSWORD" .env.production > "$config_dir/env.sanitized" || true
        info "Configuration backup completed (secrets excluded)"
    fi

    # Copy important config files
    for file in render.agentpay.yaml docker-compose.prod.yml; do
        if [ -f "$file" ]; then
            cp "$file" "$config_dir/"
        fi
    done
}

# ============================================================================
# Backup S3/Minio data (metadata only)
# ============================================================================
backup_s3_metadata() {
    info "Backing up S3 metadata..."

    local metadata_file="${BACKUP_DIR}/${BACKUP_NAME}/s3_metadata.txt"

    # List S3 objects (requires AWS CLI or mc)
    if command -v aws &> /dev/null; then
        aws s3 ls "s3://${S3_BUCKET_NAME:-agentpay-production}" --recursive > "$metadata_file" 2>/dev/null || warn "S3 metadata backup failed"
    elif command -v mc &> /dev/null; then
        mc ls --recursive "minio/${S3_BUCKET_NAME:-agentpay-production}" > "$metadata_file" 2>/dev/null || warn "S3 metadata backup failed"
    else
        warn "AWS CLI or mc not found. Skipping S3 metadata backup."
    fi
}

# ============================================================================
# Create compressed archive
# ============================================================================
create_archive() {
    info "Creating compressed archive..."

    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"

    local size=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    info "Archive created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz ($size)"

    # Remove uncompressed directory
    rm -rf "${BACKUP_NAME}"
}

# ============================================================================
# Upload to S3 (optional)
# ============================================================================
upload_to_s3() {
    if [ "${UPLOAD_TO_S3:-false}" = "true" ]; then
        info "Uploading backup to S3..."

        local s3_bucket="${BACKUP_S3_BUCKET:-}"
        if [ -z "$s3_bucket" ]; then
            warn "BACKUP_S3_BUCKET not set. Skipping S3 upload."
            return
        fi

        if command -v aws &> /dev/null; then
            aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://${s3_bucket}/backups/" --storage-class STANDARD_IA
            info "Backup uploaded to S3: s3://${s3_bucket}/backups/${BACKUP_NAME}.tar.gz"
        else
            warn "AWS CLI not found. Skipping S3 upload."
        fi
    fi
}

# ============================================================================
# Clean up old backups
# ============================================================================
cleanup_old_backups() {
    info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    find "${BACKUP_DIR}" -name "agentpay_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

    local remaining=$(find "${BACKUP_DIR}" -name "agentpay_backup_*.tar.gz" -type f | wc -l)
    info "Remaining backups: $remaining"
}

# ============================================================================
# Verify backup
# ============================================================================
verify_backup() {
    info "Verifying backup integrity..."

    if tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" > /dev/null 2>&1; then
        info "✓ Backup integrity verified"
    else
        error "✗ Backup integrity check failed"
    fi
}

# ============================================================================
# Main
# ============================================================================
main() {
    echo "============================================================================"
    echo "AgentPay Backup"
    echo "============================================================================"
    echo "Timestamp: $TIMESTAMP"
    echo "Backup directory: $BACKUP_DIR"
    echo "Retention: $RETENTION_DAYS days"
    echo ""

    create_backup_dir
    backup_database
    backup_redis
    backup_config
    backup_s3_metadata
    create_archive
    verify_backup
    upload_to_s3
    cleanup_old_backups

    echo ""
    echo "============================================================================"
    info "✓ Backup completed successfully"
    echo "============================================================================"
    echo "Backup location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo ""
    echo "To restore from this backup:"
    echo "  ./scripts/restore.sh ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo ""
}

# Run main function
main "$@"
