const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-2" });

/**
 * Upload invoice PDF to S3
 */
const uploadInvoicePDF = async (pdfBuffer, invoiceNumber) => {
  try {
    const bucketName = process.env.INVOICE_BUCKET_NAME;
    const key = `invoices/${new Date().getFullYear()}/${invoiceNumber}.pdf`;

    console.log("[uploadInvoicePDF] Uploading to S3:", { bucketName, key });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      Metadata: {
        "invoice-number": invoiceNumber,
        "generated-at": new Date().toISOString(),
      },
    });

    const result = await s3Client.send(command);

    const url = `https://${bucketName}.s3.${process.env.AWS_REGION || "ap-southeast-2"}.amazonaws.com/${key}`;

    console.log("[uploadInvoicePDF] Upload successful:", url);

    return {
      bucket: bucketName,
      key: key,
      url: url,
    };
  } catch (error) {
    console.error("[uploadInvoicePDF] Error:", error.message);
    throw error;
  }
};

module.exports = { uploadInvoicePDF };
