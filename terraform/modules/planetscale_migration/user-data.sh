#!/bin/bash -xe
# User-data script for pgcopydb migration instance
# This script runs on first boot to install and configure pgcopydb
# Matches the CloudFormation cfn-init configuration

exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "=========================================="
echo "pgcopydb Migration Instance Setup"
echo "Started at: $(date)"
echo "=========================================="

export DEBIAN_FRONTEND=noninteractive

# =============================================================================
# Install Prerequisites
# =============================================================================
echo "Updating system packages..."
apt-get update -y
apt-get install -y wget gnupg2 lsb-release curl unzip ca-certificates netcat-openbsd sqlite3

# =============================================================================
# Install PostgreSQL 18
# =============================================================================
echo "Installing PostgreSQL 18..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-client-18 postgresql-18 postgresql-server-dev-18

# =============================================================================
# Install Build Tools
# =============================================================================
echo "Installing build dependencies..."
apt-get install -y \
  build-essential \
  git \
  libssl-dev \
  libpq-dev \
  libgc-dev \
  liblz4-dev \
  libpam0g-dev \
  libxml2-dev \
  libxslt1-dev \
  libreadline-dev \
  zlib1g-dev \
  libncurses5-dev \
  libkrb5-dev \
  libselinux1-dev \
  libzstd-dev \
  libnuma-dev

# =============================================================================
# Build pgcopydb from Source
# =============================================================================
echo "Building pgcopydb from source..."
cd /tmp
git clone --branch v0.20.0 https://github.com/planetscale/pgcopydb.git
cd pgcopydb
export PATH=/usr/lib/postgresql/18/bin:$PATH
make clean || true
make
make install
ldconfig

# =============================================================================
# Install AWS CLI
# =============================================================================
echo "Installing AWS CLI..."
cd /tmp
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# =============================================================================
# Install CloudWatch Agent
# =============================================================================
echo "Installing CloudWatch agent..."
cd /tmp
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb
rm -f amazon-cloudwatch-agent.deb

# =============================================================================
# System Configuration
# =============================================================================

# File descriptor limits
cat > /etc/security/limits.d/99-pgcopydb.conf << 'LIMITS_EOF'
*  soft  nofile  65536
*  hard  nofile  65536
LIMITS_EOF

# Sysctl tuning for high-throughput migrations
cat > /etc/sysctl.d/99-pgcopydb.conf << 'SYSCTL_EOF'
net.ipv4.tcp_keepalive_time = 60
net.ipv4.tcp_keepalive_intvl = 10
net.ipv4.tcp_keepalive_probes = 6
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
SYSCTL_EOF
sysctl -p /etc/sysctl.d/99-pgcopydb.conf

# PATH configuration
cat > /etc/profile.d/pgcopydb.sh << 'PROFILE_EOF'
export PATH=/usr/lib/postgresql/18/bin:$PATH
alias pgcopydb-version='pgcopydb --version'
alias psql-version='psql --version'
alias check-planetscale='nc -zv app.connect.psdb.cloud 443 2>&1 | grep succeeded'
PROFILE_EOF

# =============================================================================
# Pull PlanetScale Migration Helper Scripts
# =============================================================================
echo "Cloning PlanetScale migration helper scripts..."
git clone --depth 1 https://github.com/planetscale/migration-scripts.git /tmp/migration-scripts
cp -r /tmp/migration-scripts/pgcopydb-helpers/* /home/ubuntu/
rm -rf /tmp/migration-scripts
chown -R ubuntu:ubuntu /home/ubuntu/
chmod +x /home/ubuntu/*.sh

# =============================================================================
# Verify Installation
# =============================================================================
echo "=== Installation verification ===" >> /var/log/user-data-verification.log
export PATH=/usr/lib/postgresql/18/bin:$PATH
pgcopydb --version >> /var/log/user-data-verification.log 2>&1 || echo "pgcopydb installation failed" >> /var/log/user-data-verification.log
psql --version >> /var/log/user-data-verification.log 2>&1 || echo "PostgreSQL client installation failed" >> /var/log/user-data-verification.log
aws --version >> /var/log/user-data-verification.log 2>&1 || echo "AWS CLI installation failed" >> /var/log/user-data-verification.log

echo "=========================================="
echo "Setup completed successfully!"
echo "Finished at: $(date)"
echo "=========================================="
