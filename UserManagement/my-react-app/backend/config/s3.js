const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

s3.getBucketName = () => process.env.AWS_S3_BUCKET_NAME || "";
s3.getRegion = () => process.env.AWS_REGION || "ap-south-2";

/**
 * Checks connection to AWS S3 bucket and logs connection status.
 */
s3.checkConnection = async () => {
  const bucket = s3.getBucketName();
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn("⚠️  AWS S3 warning: Environment variables (AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not fully configured.");
    return false;
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`AWS S3 connected successfully (Bucket: ${bucket})`);
    return true;
  } catch (error) {
    // 301 Moved Permanently means the bucket exists and credentials reached AWS, but region header differed
    if (error.$metadata && (error.$metadata.httpStatusCode === 200 || error.$metadata.httpStatusCode === 301)) {
      console.log(`AWS S3 connected successfully (Bucket: ${bucket})`);
      return true;
    }
    console.error(`AWS S3 connection error: ${error.message || error}`);
    return false;
  }
};

module.exports = s3;
