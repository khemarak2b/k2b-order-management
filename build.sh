#!/bin/bash
trap 'exit' ERR
set -e

echo "Running Amplify initialization and deployment..."

# Environment variables from CodeBuild
APPLICATION_NAME="k2b-order-management"

AWS_ACCOUNT=${AWS_ACCOUNT}
DEPLOYMENT_ENV=${DEPLOYMENT_ENV}
DEPLOYMENT_REGION=${DEPLOYMENT_REGION}
BUCKET_NAME="k2b-modules"

echo "Configuration:"
echo "  Environment: $DEPLOYMENT_ENV"
echo "  Region: $DEPLOYMENT_REGION"
echo "  Application: $APPLICATION_NAME"
echo "  S3 Bucket: $BUCKET_NAME"

# AWS credentials are already configured by buildspec.yml
ACCESS_KEY_ID=$(aws configure get aws_access_key_id)
SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key)

# Amplify configuration
AMPLIFY="{\
\"configLevel\":\"project\",\
\"envName\":\"$DEPLOYMENT_ENV\",\
\"defaultEditor\":\"code\"\
}"

FRONTEND="{\
\"frontend\":\"javascript\",\
\"framework\":\"react\",\
\"config\":{\
\"SourceDir\":\"src\",\
\"DistributionDir\":\"build\",\
\"BuildCommand\":\"npm run build\",\
\"StartCommand\":\"npm start\"\
}\
}"

AWS_CLOUDFORMATION_CONFIG="{\
\"accessKeyId\":\"$ACCESS_KEY_ID\",\
\"secretAccessKey\":\"$SECRET_ACCESS_KEY\",\
\"region\":\"$DEPLOYMENT_REGION\"\
}"

PROVIDERS="{\
\"awscloudformation\":$AWS_CLOUDFORMATION_CONFIG\
}"

# List current amplify directory
echo "Current amplify directory contents:"
ls -al amplify/ || echo "amplify/ directory not found"

# Setup IDP (Cognito) configuration from shared module BEFORE init
echo "Setting up IDP configuration..."
bash scripts/setup-idp-config.sh "$DEPLOYMENT_ENV" "$BUCKET_NAME" "$APPLICATION_NAME" "$DEPLOYMENT_REGION"

# Setup other endpoints
K2B_NOTIFICATION_MANAGEMENT="k2b-notification-management"

aws s3api get-object --bucket $BUCKET_NAME \
--key "${DEPLOYMENT_ENV}/${K2B_NOTIFICATION_MANAGEMENT}/${K2B_NOTIFICATION_MANAGEMENT}-aws-exports.js" "${K2B_NOTIFICATION_MANAGEMENT}-aws-exports.js"
cp "${K2B_NOTIFICATION_MANAGEMENT}-aws-exports.js" ./amplify/backend/function/ordersHandler/src
cp "${K2B_NOTIFICATION_MANAGEMENT}-aws-exports.js" ./amplify/backend/function/adminOrdersHandler/src


# Try to download team-provider-info.json from S3
echo "Attempting to download team-provider-info.json from S3..."
if aws s3 ls "s3://${BUCKET_NAME}/${DEPLOYMENT_ENV}/${APPLICATION_NAME}/" 2>/dev/null; then
  echo "S3 bucket found. Downloading team-provider-info.json..."
  aws s3api get-object --bucket "${BUCKET_NAME}" \
    --key "${DEPLOYMENT_ENV}/${APPLICATION_NAME}/team-provider-info.json" \
    "team-provider-info.json" && \
    cp team-provider-info.json amplify/ && \
    echo "Successfully copied team-provider-info.json to amplify/"
else
  echo "S3 bucket or files not found. Proceeding with fresh init..."
fi

echo "Initializing Amplify..."
amplify init \
  --amplify "$AMPLIFY" \
  --frontend "$FRONTEND" \
  --providers "$PROVIDERS" \
  --yes

# Check amplify status
echo "Checking Amplify status..."
amplify status

# Upload team-provider-info.json to S3 for future use
echo "Uploading team-provider-info.json to S3..."
aws s3 cp amplify/team-provider-info.json \
  "s3://${BUCKET_NAME}/${DEPLOYMENT_ENV}/${APPLICATION_NAME}/team-provider-info.json" || \
  echo "Warning: Could not upload team-provider-info.json"

# Check amplify status
# Converting AWS exports to ES5 notation
echo "Converting aws-exports.js to ES5 and uploading to S3..."
sed -i 's/export default awsmobile;/module.exports = { awsmobile };/' src/aws-exports.js
sed -i "s/awsmobile/${APPLICATION_NAME//-/}/" src/aws-exports.js

# Upload converted exports file to S3
aws s3 cp src/aws-exports.js \
  "s3://${BUCKET_NAME}/${DEPLOYMENT_ENV}/${APPLICATION_NAME}/${APPLICATION_NAME}-aws-exports.js" || \
  echo "Warning: Could not upload aws-exports.js"

echo "Amplify initialization completed successfully!"
