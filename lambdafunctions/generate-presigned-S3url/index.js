const AWS = require("aws-sdk");
const config = require("./awsconfig");
var crypto = require("crypto-js");
const S3_Bucket = process.env.bucket || "nonprod-f-er";
AWS.config.update({
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  region: "us-east-1",
});
var s3 = new AWS.S3({ signatureVersion: "v4" });

exports.handler = async (event) => {
  let fileData = JSON.parse(event.body);
  let S3_Key = createHash(fileData.fileName);
  let params = { Bucket: S3_Bucket, Key: S3_Key };
  let url = s3.getSignedUrl("putObject", params);
  console.log("URL:", url);
  let response = {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ uploadURL: url, S3_Key: S3_Key }),
  };
  return response;
};

function createHash(fileName) {
  let fileKey = "file_" + new Date().getTime() + "_" + fileName;
  let fileNameWithoutExtn = fileKey.replace(/\.[^/.]+$/, "");
  let folder_md5 = crypto.MD5(fileNameWithoutExtn).toString();
  return folder_md5 + "/" + fileKey;
}
