#!/bin/bash
set -e

# Configuration
BACKEND_STACK="${BACKEND_STACK:-aws-newsroom-prd}"
FRONTEND_STACK="${FRONTEND_STACK:-aws-newsroom-ui-prd}"
ENVIRONMENT="${ENVIRONMENT:-prd}"
ALLOWED_EMAIL_DOMAIN="${ALLOWED_EMAIL_DOMAIN:-helixcloud.ch}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Validate AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  log_error "AWS credentials not configured or invalid"
  exit 1
fi

log_info "Using AWS Region: $AWS_REGION"
log_info "Backend Stack: $BACKEND_STACK"
log_info "Frontend Stack: $FRONTEND_STACK"
log_info "Allowed Email Domain: $ALLOWED_EMAIL_DOMAIN"

# Install dependencies
log_info "Installing dependencies..."
npm install

# Deploy Backend
log_info "Building backend..."
npm run be:build

log_info "Building SAM backend stack..."
sam build --template-file template.yaml

log_info "Deploying backend stack..."
sam deploy \
  --stack-name "$BACKEND_STACK" \
  --parameter-overrides AllowedEmailDomain="$ALLOWED_EMAIL_DOMAIN" \
  --tags Project="$BACKEND_STACK" Environment="$ENVIRONMENT" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset \
  --region "$AWS_REGION"

log_info "Backend deployed successfully"

# Get backend outputs
log_info "Retrieving backend outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

if [ -z "$API_ENDPOINT" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ]; then
  log_error "Failed to retrieve backend outputs"
  exit 1
fi

log_info "API Endpoint: $API_ENDPOINT"
log_info "User Pool ID: $USER_POOL_ID"
log_info "User Pool Client ID: $USER_POOL_CLIENT_ID"

# Configure frontend environment variables
log_info "Configuring frontend environment variables..."
cat > frontend/.env.production <<EOF
VITE_API_ENDPOINT=$API_ENDPOINT
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
EOF

# Deploy Frontend
log_info "Building frontend..."
npm run fe:build

log_info "Building SAM frontend stack..."
sam build --template-file template-ui.yaml

log_info "Deploying frontend stack..."
sam deploy \
  --stack-name "$FRONTEND_STACK" \
  --tags Project="$FRONTEND_STACK" Environment="$ENVIRONMENT" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset \
  --region "$AWS_REGION"

# Get frontend outputs
log_info "Retrieving frontend outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
  log_error "Failed to retrieve frontend outputs"
  exit 1
fi

# Upload frontend files
log_info "Uploading frontend files to S3..."
aws s3 sync frontend/dist/ "s3://${BUCKET_NAME}/" \
  --region "$AWS_REGION" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp frontend/dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --region "$AWS_REGION" \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
log_info "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

log_info "CloudFront invalidation created: $INVALIDATION_ID"

# Summary
echo ""
log_info "====================================================================="
log_info "Deployment completed successfully!"
log_info "====================================================================="
log_info "Backend Stack: $BACKEND_STACK"
log_info "Frontend Stack: $FRONTEND_STACK"
log_info "CloudFront URL: $CLOUDFRONT_URL"
log_info "====================================================================="
