export type AmplifyDependentResourcesAttributes = {
  "api": {
    "orderManagementApi": {
      "ApiId": "string",
      "ApiName": "string",
      "RootUrl": "string"
    }
  },
  "custom": {
    "InvoiceBucket": {
      "BucketArn": "string",
      "BucketName": "string"
    }
  },
  "function": {
    "adminOrdersHandler": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    },
    "cartHandler": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    },
    "invoiceHandler": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    },
    "k2bordermanagementlayer": {
      "Arn": "string"
    },
    "k2bordermanagementlayer2": {
      "Arn": "string"
    },
    "ordersHandler": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "LambdaExecutionRoleArn": "string",
      "Name": "string",
      "Region": "string"
    }
  }
}