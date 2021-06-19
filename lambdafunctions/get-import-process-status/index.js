const { Client } = require("pg");
const config = require("./config");
const env = process.env.environment || "prism";

const user = config[env].user;
const host = config[env].host;
const database = config[env].database;
const password = config[env].pw;
const port = config[env].port;

exports.handler = async (event) => {
  let processId = Number(event.pathParameters.process_id);
  let responseData;
  try {
    const client = new Client({ user, host, database, password, port });
    await client.connect();
    let addUploadProcess = await client.query(
      'select * from "GetProcessStatus"($1)',
      [processId]
    );
    responseData = addUploadProcess && addUploadProcess.rows;
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
