const { Client } = require("pg");
const config = require("./config");
const env = process.env.environment || "integration";

const user = config[env].user;
const host = config[env].host;
const database = config[env].database;
const password = config[env].pw;
const port = config[env].port;

exports.handler = async (event) => {
  let subsetParams = JSON.parse(event.body);
  let subsetName = subsetParams.subsetName;
  let subsetData = subsetParams.subsetData;
  let workSpaceId = subsetParams.workspaceId;
  let userId =
    event &&
    event.requestContext &&
    event.requestContext.authorizer &&
    event.requestContext.authorizer.claims &&
    event.requestContext.authorizer.claims["custom:user_id"];
  let responseData;
  try {
    const client = new Client({ user, host, database, password, port });
    await client.connect();
    let saveExposureSubset = await client.query(
      'select * from "saveOrReplaceExposureSubset"($1,$2,$3,$4)',
      [subsetName, userId, subsetData, workSpaceId]
    );
    responseData = saveExposureSubset && saveExposureSubset.rows;
    console.log("Response:", responseData);
    await client.end();
  } catch (e) {
    console.log("Error:", e);
    return null;
  }
  let response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(responseData),
  };
  return response;
};
