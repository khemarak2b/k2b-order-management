export type AmplifyDependentResourcesAttributes = {
  "api": {
    "orderManagementApi": {
      "ApiId": "string",
      "ApiName": "string",
      "RootUrl": "string"
    }
  },
  "function": {
    "k2bordermanagementlayer": {
      "Arn": "string"
    },
    "ordersHandler": {
      "Arn": "string",
      "LambdaExecutionRole": "string",
      "Name": "string",
      "Region": "string"
    }
  }
}