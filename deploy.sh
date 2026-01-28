#!/bin/bash
set -e

# Configuration
STACK_NAME="${STACK_NAME:-aws-newsroom-prd}"
ENVIRONMENT="${ENVIRONMENT:-prd}"
ALLOWED_EMAIL_DOMAIN="${ALLOWED_EMAIL_DOMAIN:-example.com}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  log_error "AWS credentials not configured or invalid"
  exit 1
fi

log_info "Stack: $STACK_NAME"
log_info "Region: $AWS_REGION"
log_info "Allowed Email Domain: $ALLOWED_EMAIL_DOMAIN"
if [ -n "$DOMAIN_NAME" ]; then
  log_info "Custom Domain: $DOMAIN_NAME"
fi

# Install dependencies
log_info "Installing dependencies..."
npm install

# Build backend
log_info "Building backend..."
npm run be:build

# Build SAM
log_info "Building SAM stack..."
sam build --template-file template.yaml

# Deploy stack
log_info "Deploying stack..."
PARAM_OVERRIDES="AllowedEmailDomain=$ALLOWED_EMAIL_DOMAIN"
if [ -n "$DOMAIN_NAME" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES DomainName=$DOMAIN_NAME CertificateArn=$CERTIFICATE_ARN"
fi
if [ -n "$HOSTED_ZONE_ID" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES HostedZoneId=$HOSTED_ZONE_ID"
fi

sam deploy \
  --stack-name "$STACK_NAME" \
  --parameter-overrides $PARAM_OVERRIDES \
  --tags "Project=$STACK_NAME" "Environment=$ENVIRONMENT" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --region "$AWS_REGION"

# Get outputs
log_info "Retrieving stack outputs..."
get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue" \
    --output text
}

USER_POOL_ID=$(get_output "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
BUCKET_NAME=$(get_output "FrontendBucketName")
DISTRIBUTION_ID=$(get_output "CloudFrontDistributionId")
CLOUDFRONT_URL=$(get_output "CloudFrontURL")

if [ -z "$USER_POOL_ID" ] || [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
  log_error "Failed to retrieve stack outputs"
  exit 1
fi

# Configure frontend (API is now relative path via CloudFront)
log_info "Configuring frontend..."
cat > frontend/.env.production <<EOF
VITE_API_ENDPOINT=/api
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
EOF

# Build frontend
log_info "Building frontend..."
npm run fe:build

# Upload frontend to S3
log_info "Uploading frontend to S3..."
aws s3 sync frontend/dist/ "s3://${BUCKET_NAME}/" \
  --region "$AWS_REGION" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp frontend/dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --region "$AWS_REGION" \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront
log_info "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

log_info "CloudFront invalidation: $INVALIDATION_ID"

# Summary
echo ""
log_info "====================================================================="
log_info "Deployment complete!"
log_info "====================================================================="
log_info "Stack: $STACK_NAME"
log_info "URL: $CLOUDFRONT_URL"
if [ -n "$DOMAIN_NAME" ]; then
  log_info "Custom Domain: https://$DOMAIN_NAME"
  if [ -z "$HOSTED_ZONE_ID" ]; then
    log_info ""
    log_info "Add DNS CNAME record:"
    log_info "  Name:  $DOMAIN_NAME"
    log_info "  Value: $(get_output 'CloudFrontDomainName')"
  fi
fi
log_info "====================================================================="
