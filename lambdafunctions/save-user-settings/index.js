const { Client } = require("pg");
const config = require("./config");
const env = process.env.environment || "prism";

const user = config[env].user;
const host = config[env].host;
const database = config[env].database;
const password = config[env].pw;
const port = config[env].port;
const errorResponse = "Validation Failed. Incorrect Data";

exports.handler = async (event) => {
  console.log(event);
  let settingsObj;
  try {
    settingsObj = JSON.parse(event.body);
  } catch (err) {
    console.log("ERROR while parsing:", err);
    settingsObj = event.body;
  }
  console.log("after parsing");
  console.log("settings object is ", settingsObj);
  let response = {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
  };
  let responseData;
  try {
    let params = constructDBParams(settingsObj);
    console.log("DB params:", params);
    if (Array.isArray(params.dbParams)) {
      const client = new Client({ user, host, database, password, port });
      console.log("user params", params);
      await client.connect();
      let addUploadProcess = await client.query(
        params.saveSettingsQuery,
        params.dbParams
      );
      responseData = addUploadProcess && addUploadProcess.rows;
      console.log("Response:", responseData);
      response.body = JSON.stringify(responseData);
      await client.end();
    } else {
      response.body = JSON.stringify(errorResponse);
    }
    return response;
  } catch (err) {
    console.log("ERROR:", err);
    return false;
  }
};

function constructDBParams(settingsObj) {
  let dbObject = {};
  let validationStatus;
  dbObject.dbParams = [
    Number(settingsObj.user_id),
    settingsObj.settingsType,
    settingsObj.jsonData,
  ];

  switch (settingsObj.settingsType) {
    case "columnMapping":
      validationStatus = validateColumnMappingSettings(settingsObj.jsonData);
      if (validationStatus) dbObject.dbParams = errorResponse;
      else {
        dbObject.dbParams.push(settingsObj.jsonData.clientColumn);
        dbObject.saveSettingsQuery =
          'select * from "SaveUserSettings"($1,$2,$3,$4)';
      }
      break;
    case "importProcessSettings":
      validationStatus = validateImportProcessSettings(settingsObj.jsonData);

      if (validationStatus) dbObject.dbParams = errorResponse;
      else {
        if (dbObject.dbParams.length > 2) {
          dbObject.dbParams.pop();
          dbObject.dbParams.push(
            settingsObj.jsonData[settingsObj.jsonData.S3_Key]
          );
        }
        dbObject.dbParams.push(settingsObj.jsonData.S3_Key);

        dbObject.saveSettingsQuery =
          'select * from "SaveUserSettings"($1,$2,$3,$4)';
      }
      break;
    default:
      dbObject.saveSettingsQuery = 'select * from "SaveUserSettings"($1,$2,$3)';
      break;
  }
  return dbObject;
}

function validateImportProcessSettings(data) {
  let s3Key = data.S3_Key;
  let importData = data[s3Key];
  let validationStatus = {};
  validationStatus.isValidUIConfig = Array.isArray(importData.uiConfig);
  validationStatus.isValidClientColumn = Array.isArray(
    importData.client_columns
  );
  validationStatus.isValidClientColumnData =
    importData.client_columns.length > 1;
  return Object.keys(validationStatus)
    .map((key) => validationStatus[key])
    .includes(false);
}

function validateColumnMappingSettings(data) {
  //Add a variation for new settings , old settings validation is present
  let validationStatus = {};
  validationStatus.isValidPrismColumn = Array.isArray(data.prismColumns);
  validationStatus.isValidClientColumn = data.clientColumn.length != 0;
  return Object.keys(validationStatus)
    .map((key) => validationStatus[key])
    .includes(false);
}
