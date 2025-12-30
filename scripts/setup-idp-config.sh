#!/bin/bash
set -e

# Setup IDP (Identity Provider) configuration for the current environment
# This downloads the aws-exports.js from S3 and extracts Cognito configuration

DEPLOYMENT_ENV=${1:-$DEPLOYMENT_ENV}
BUCKET_NAME=${2:-"k2b-modules"}
APPLICATION_NAME=${3:-"k2b-order-management"}
DEPLOYMENT_REGION=${4:-"ap-southeast-2"}
IDP_MODULE_NAME="k2b-idp"

if [ -z "$DEPLOYMENT_ENV" ]; then
  echo "Error: DEPLOYMENT_ENV not set"
  exit 1
fi

echo "Setting up IDP configuration for environment: $DEPLOYMENT_ENV"

# Download IDP config from S3
IDP_CONFIG_FILE="idp-config.js"
IDP_S3_PATH="s3://${BUCKET_NAME}/${DEPLOYMENT_ENV}/${IDP_MODULE_NAME}/${IDP_MODULE_NAME}-aws-exports.js"

echo "Downloading IDP config from: $IDP_S3_PATH"
aws s3 cp "$IDP_S3_PATH" "$IDP_CONFIG_FILE" || {
  echo "Error: Could not download IDP config from S3"
  exit 1
}

# Extract Cognito values from the downloaded config
# Using Node.js to parse the JavaScript file
USER_POOL_ID=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('$IDP_CONFIG_FILE', 'utf8');
const module = {};
eval(content);
console.log(module.exports.k2bidp.aws_user_pools_id);
")

IDENTITY_POOL_ID=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('$IDP_CONFIG_FILE', 'utf8');
const module = {};
eval(content);
console.log(module.exports.k2bidp.aws_cognito_identity_pool_id);
")

# Get actual client IDs from AWS Cognito
echo "Fetching user pool clients from AWS..."
CLIENT_LIST=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$USER_POOL_ID" \
  --region "$DEPLOYMENT_REGION" 2>/dev/null || echo '{"UserPoolClients":[]}')

# Extract web and native client IDs by name pattern
WEB_CLIENT_ID=$(echo "$CLIENT_LIST" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const webClient = data.UserPoolClients?.find(c => c.ClientName?.includes('_clientWeb'));
if (webClient) {
  console.log(webClient.ClientId);
} else {
  console.error('Web client (_clientWeb) not found');
  process.exit(1);
}
")

NATIVE_CLIENT_ID=$(echo "$CLIENT_LIST" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const nativeClient = data.UserPoolClients?.find(c => c.ClientName?.includes('_client') && !c.ClientName?.includes('_clientWeb'));
if (nativeClient) {
  console.log(nativeClient.ClientId);
} else {
  console.log('');
}
")

echo "Extracted Cognito Configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Web Client ID: $WEB_CLIENT_ID"
echo "  Native Client ID: $NATIVE_CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"

# Update CLI inputs for API with User Pool ID
echo "Updating API CLI inputs with User Pool ID..."
node -e "
const fs = require('fs');
const path = './amplify/backend/api/orderManagementApi/cli-inputs.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

config.authorizationType = 'AMAZON_COGNITO_USER_POOLS';
config.userPoolId = '$USER_POOL_ID';

fs.writeFileSync(path, JSON.stringify(config, null, 2));
console.log('Updated cli-inputs.json with User Pool ID');
"

# Update team-provider-info.json with Cognito details
echo "Updating team-provider-info.json with Cognito configuration..."
node -e "
const fs = require('fs');
const path = './amplify/team-provider-info.json';
let config = {};

// Read existing config if it exists
if (fs.existsSync(path)) {
  config = JSON.parse(fs.readFileSync(path, 'utf8'));
}

// Ensure environment section exists
if (!config['$DEPLOYMENT_ENV']) {
  config['$DEPLOYMENT_ENV'] = {};
}
if (!config['$DEPLOYMENT_ENV'].categories) {
  config['$DEPLOYMENT_ENV'].categories = {};
}
if (!config['$DEPLOYMENT_ENV'].categories.auth) {
  config['$DEPLOYMENT_ENV'].categories.auth = {};
}

// Create clean auth configuration with both web and native client IDs
const authConfig = {
  userPoolId: '$USER_POOL_ID',
  userPoolName: '$IDP_MODULE_NAME',
  webClientId: '$WEB_CLIENT_ID',
  nativeClientId: '$NATIVE_CLIENT_ID',
  identityPoolId: '$IDENTITY_POOL_ID',
  identityPoolName: '$IDP_MODULE_NAME-identitypool',
  allowUnauthenticatedIdentities: false
};

// Replace entire auth entry
config['$DEPLOYMENT_ENV'].categories.auth = {
  k2bproductmanagementf925b91f: authConfig
};

fs.writeFileSync(path, JSON.stringify(config, null, 2));
console.log('Updated team-provider-info.json with Cognito configuration (nativeClientId removed)');
"

# Upload updated team-provider-info.json to S3 so subsequent downloads get the updated version
echo "Uploading updated team-provider-info.json to S3..."
aws s3 cp amplify/team-provider-info.json \
  "s3://${BUCKET_NAME}/${DEPLOYMENT_ENV}/${APPLICATION_NAME}/team-provider-info.json" || \
  echo "Warning: Could not upload team-provider-info.json to S3"

# Cleanup
rm -f "$IDP_CONFIG_FILE"

echo "IDP configuration setup completed successfully!"
