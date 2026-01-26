# K2B Order Management - Amp Context File

**Project**: k2b-order-management  
**Repository**: https://github.com/khemarak2b/k2b-order-management  
**Type**: AWS Amplify backend project  
**Purpose**: Order management system with API endpoints and Lambda functions

## Project Structure

```
k2b-order-management/
├── amplify/                          # AWS Amplify configuration
│   ├── backend/
│   │   ├── api/                      # API Gateway definitions
│   │   │   └── orderManagementApi/   # REST API configuration
│   │   ├── auth/                     # Authentication config
│   │   ├── function/                 # Lambda functions
│   │   │   ├── adminOrdersHandler/   # Admin-specific order operations
│   │   │   ├── cartHandler/          # Shopping cart operations
│   │   │   ├── ordersHandler/        # Standard order operations
│   │   │   └── k2bordermanagementlayer/ # Shared dependencies layer
│   │   └── types/                    # Type definitions
│   ├── cli.json                      # Amplify CLI configuration
│   └── team-provider-info.json       # Team/environment settings
├── scripts/                          # Build and deployment scripts
├── src/                              # Source configuration
│   ├── amplifyconfiguration.json    # Amplify client config
│   └── aws-exports.js               # AWS exports
├── buildspec.yml                     # CodeBuild specification
├── deployspec.yml                    # CodeDeploy specification
├── build.sh                          # Build script
├── deploy.sh                         # Deployment script
├── .prettierrc.json                  # Code formatting config
└── README.md                         # Project documentation
```

## Key Components

### Lambda Functions
- **ordersHandler**: Handles standard order operations
- **adminOrdersHandler**: Admin-specific order management
- **cartHandler**: Shopping cart functionality
- **k2bordermanagementlayer**: Shared Node.js dependencies (Lambda Layer)

### API
- **orderManagementApi**: REST API Gateway for order operations
- Uses **APIGatewayAuthStack.json** for authentication configuration

### Infrastructure as Code
- Uses AWS Amplify for backend management
- CloudFormation templates in `amplify/backend/awscloudformation/`
- Environment configuration in `team-provider-info.json`

## Build & Deployment

- **Build**: `./build.sh` - Builds the Amplify backend
- **Deploy**: `./deploy.sh` - Deploys to AWS
- Uses CodeBuild/CodeDeploy for CI/CD (buildspec.yml, deployspec.yml)

## Code Style

- Uses Prettier for code formatting (.prettierrc.json)

## Authentication

- Configured through Amplify Auth
- API Gateway has authentication stack (APIGatewayAuthStack.json)

---
Last Updated: 2026-01-25
