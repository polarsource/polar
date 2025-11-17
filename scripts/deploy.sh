#!/bin/bash
# ============================================================================
# AgentPay Production Deployment Script
# ============================================================================
# This script automates the deployment process for AgentPay
# Supports: Render.com, Docker, and manual deployment
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
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
# Check prerequisites
# ============================================================================
check_prerequisites() {
    info "Checking prerequisites..."

    # Check for required commands
    if ! command -v git &> /dev/null; then
        error "git is not installed"
    fi

    if ! command -v curl &> /dev/null; then
        error "curl is not installed"
    fi

    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        warn ".env.production not found"
        info "Creating from .env.production.example..."
        if [ -f .env.production.example ]; then
            cp .env.production.example .env.production
            warn "Please edit .env.production with your configuration"
            exit 1
        else
            error ".env.production.example not found"
        fi
    fi

    info "Prerequisites OK"
}

# ============================================================================
# Deploy to Render.com
# ============================================================================
deploy_render() {
    info "Deploying to Render.com..."

    # Check if Render CLI is installed
    if ! command -v render &> /dev/null; then
        warn "Render CLI not installed. Installing..."
        curl -fsSL https://render.com/install | sh
    fi

    # Deploy using blueprint
    info "Deploying with render.agentpay.yaml blueprint..."
    render deploy --blueprint render.agentpay.yaml

    info "Deployment initiated on Render.com"
    info "Monitor at: https://dashboard.render.com/"
}

# ============================================================================
# Deploy with Docker
# ============================================================================
deploy_docker() {
    info "Deploying with Docker..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Install from: https://docs.docker.com/get-docker/"
    fi

    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi

    # Build and start services
    info "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build --no-cache

    info "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for database to be ready
    info "Waiting for database to be ready..."
    sleep 10

    # Run migrations
    info "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec -T api uv run alembic upgrade head

    # Check health
    info "Checking health..."
    sleep 5
    if curl -f http://localhost:8000/healthz > /dev/null 2>&1; then
        info "✅ Deployment successful!"
        info "API available at: http://localhost:8000"
    else
        error "Health check failed. Check logs: docker-compose -f docker-compose.prod.yml logs"
    fi
}

# ============================================================================
# Deploy manually (bare metal / VPS)
# ============================================================================
deploy_manual() {
    info "Manual deployment..."

    # Check if uv is installed
    if ! command -v uv &> /dev/null; then
        warn "uv not installed. Installing..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$PATH"
    fi

    # Install dependencies
    info "Installing dependencies..."
    cd server
    uv sync

    # Build email templates
    info "Building email templates..."
    uv run task emails

    # Run migrations
    info "Running database migrations..."
    uv run alembic upgrade head

    # Start services (requires systemd or supervisor)
    warn "Services NOT started automatically"
    info "To start API server: uv run task api"
    info "To start worker: uv run task worker"
    info "Consider using systemd or supervisor for production"
}

# ============================================================================
# Post-deployment tasks
# ============================================================================
post_deployment() {
    info "Running post-deployment tasks..."

    # Index products for RAG
    info "Would you like to index products now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
            docker-compose -f docker-compose.prod.yml exec -T worker uv run python -m polar.scripts.index_products
        else
            cd server
            uv run python -m polar.scripts.index_products
        fi
        info "Products indexed successfully"
    fi
}

# ============================================================================
# Main
# ============================================================================
main() {
    echo "============================================================================"
    echo "AgentPay Production Deployment"
    echo "============================================================================"
    echo ""

    # Check prerequisites
    check_prerequisites

    # Ask deployment type
    echo "Select deployment type:"
    echo "1) Render.com (managed, recommended)"
    echo "2) Docker (self-hosted)"
    echo "3) Manual (bare metal / VPS)"
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            DEPLOYMENT_TYPE="render"
            deploy_render
            ;;
        2)
            DEPLOYMENT_TYPE="docker"
            deploy_docker
            post_deployment
            ;;
        3)
            DEPLOYMENT_TYPE="manual"
            deploy_manual
            post_deployment
            ;;
        *)
            error "Invalid choice"
            ;;
    esac

    echo ""
    echo "============================================================================"
    info "✅ Deployment complete!"
    echo "============================================================================"
    echo ""
    echo "Next steps:"
    echo "1. Configure Stripe webhooks (see STRIPE_SETUP_GUIDE.md)"
    echo "2. Test API health: curl https://your-domain.com/healthz"
    echo "3. Create first organization and agent"
    echo "4. Deploy chat widget to merchant website"
    echo "5. Set up monitoring (see PRODUCTION_DEPLOYMENT.md)"
    echo ""
}

# Run main function
main "$@"
