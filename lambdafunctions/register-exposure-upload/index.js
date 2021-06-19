const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const config = require("./config");
var XLSX = require("xlsx");
const fileType = require("file-type");
var _ = require("lodash");
const { Client } = require("pg");
const env = process.env.environment || "prism";
const user = config[env].user;
const host = config[env].host;
const database = config[env].database;
const password = config[env].pw;
const port = config[env].port;

const VALID_FILE_EXTENSIONS = [
  "xlsx",
  "xls",
  "csv",
  "etf",
  "zip",
  "eetf",
  "cfb",
];
const VALID_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/x-cfb",
  "application/zip",
  "",
]; //  the blank at the end of the array is for eetf and etf validations.
var fileValidations = {
  isValidfileMIME: function (type) {
    return _.indexOf(VALID_MIME, type) >= 0;
  },
  isValidfileExtension: function (fileExtension) {
    return _.indexOf(VALID_FILE_EXTENSIONS, fileExtension) >= 0;
  },
};
const errorResponse = JSON.stringify({
  Error: "Malicious File Found, File deleted from S3",
});

exports.handler = async (event) => {
  console.log(event);
  let registerParams = JSON.parse(event.body);
  console.log("registerParams:", registerParams);
  let src_key = registerParams.S3Key;
  let src_bucket = registerParams.S3Bucket;
  try {
    console.log("Fetching file from s3 ", src_bucket, src_key);
    const fileData = await s3
      .getObject({
        Bucket: src_bucket,
        Key: src_key,
        Range: "bytes=0-" + fileType.minimumBytes,
      })
      .promise();
    console.log("fileData", fileData);
    let fileObj = await fileType.fromBuffer(fileData.Body);
    console.log(fileObj);
    let fileValidationStatus = validateFile(fileObj, src_key, fileData);

    let response = {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    };
    console.log("File Validation Status:" + fileValidationStatus);
    if (fileValidationStatus) {
      await s3.deleteObject({ Bucket: src_bucket, Key: src_key }).promise();
      response.body = errorResponse;
      return response;
    } else {
      let params = constructRegisterUploadObj(registerParams);
      const client = new Client({ user, host, database, password, port });
      await client.connect();
      console.log(params);
      let addUploadProcess = await client.query(
        "SELECT add_processv5($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        params
      );
      response.body = JSON.stringify(addUploadProcess && addUploadProcess.rows);
      return response;
    }
  } catch (err) {
    console.log("ERROR:", err);
    return false;
  }
};

function constructRegisterUploadObj(registerParams) {
  return [
    registerParams.sessionId,
    registerParams.originalFileName,
    registerParams.filename,
    registerParams.filepath,
    registerParams.importsetname,
    registerParams.stage,
    20,     //Initial State for Registration, Once the Stage 1 becomes complete, Its made 50
    registerParams.userId,
    registerParams.processTypeId,
    registerParams.parameter,
    registerParams.augmentParams,
    registerParams.coverageHierarchyCheck,
    registerParams.validationFileId,
    registerParams.accountId,
    registerParams.parentProcessId,
  ];
}

function validateFile(fileObj, src_key, fileData) {
  let validationStatus = {};
  let fileExtension = (fileObj && fileObj.ext) || src_key.split(".").pop();
  let fileObjExtension = fileObj && fileObj.ext;
  let fileMime = fileObj && fileObj.mime;
  let src_keyExtension = src_key.split(".").pop();
  var fileValidationStatus;
  switch (src_keyExtension) {
    case "csv":
    case "xls":
      let workbook = XLSX.read(fileData.Body, { type: "buffer" });
      fileValidationStatus = _.isEmpty(workbook.Sheets);
      console.log(fileValidationStatus);
      break;
    case "xlsx":
    case "etf":
      validationStatus.isValidfileExtension = fileValidations.isValidfileExtension(
        fileExtension
      );
      validationStatus.isValidMIME = fileValidations.isValidfileMIME(fileMime);
      if (src_keyExtension != "etf")
        validationStatus.isFileKeySimilar =
          fileObjExtension === src_keyExtension;
      console.log("validationStatus for xlsx/etf", validationStatus);
      fileValidationStatus =
        Object.values(validationStatus).indexOf(false) >= 0;
      break;
    case "eetf":
      //No validation exists as it is password protected.
      fileValidationStatus = false;
      break;
    default:
      fileValidationStatus = true;
      break;
  }
  return fileValidationStatus;
}
