const { k2bnotificationmanagement } = require("../k2b-notification-management-aws-exports");

/**
 * Get notification API URL from configuration
 */
function getNotificationApiUrl() {
  const notificationApi = k2bnotificationmanagement.aws_cloud_logic_custom.find(
    (api) => api.name === "notificationManagementApi"
  );
  if (!notificationApi) {
    throw new Error("Notification API configuration not found");
  }
  return notificationApi.endpoint;
}

/**
 * Send notification via notification API
 * @param {Object} payload - Notification payload
 * @param {string} payload.to - Email address
 * @param {string} payload.subject - Email subject
 * @param {string} payload.template - Template name
 * @param {Object} payload.data - Template data
 */
async function sendNotification(payload) {
  const notificationApiUrl = getNotificationApiUrl();

  if (!payload.to) {
    throw new Error("Email address (to) is required");
  }
  if (!payload.subject) {
    throw new Error("Subject is required");
  }
  if (!payload.template) {
    throw new Error("Template is required");
  }

  const message = {
    to: payload.to,
    subject: payload.subject,
    template: payload.template,
    data: payload.data || {},
    ...(payload.messageGroupId ? { messageGroupId: payload.messageGroupId } : {}),
    ...(payload.messageDeduplicationId
      ? { messageDeduplicationId: payload.messageDeduplicationId }
      : {}),
  };

  console.log(
    JSON.stringify({
      component: "notification-api-client",
      event: "enqueue-requested",
      template: message.template,
      messageGroupId: message.messageGroupId,
    }),
  );

  try {
    const response = await fetch(`${notificationApiUrl}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Notification API error: ${response.status} ${response.statusText}`);
    }

    console.log(
      JSON.stringify({
        component: "notification-api-client",
        event: "enqueue-accepted",
        template: message.template,
        messageGroupId: message.messageGroupId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        component: "notification-api-client",
        event: "enqueue-failed",
        template: message.template,
        messageGroupId: message.messageGroupId,
        error: error.message,
      }),
    );
    throw error;
  }
}

module.exports = { sendNotification, getNotificationApiUrl };
