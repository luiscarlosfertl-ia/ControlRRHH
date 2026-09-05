const password = require("fs")
  .readFileSync("/run/secrets/mongo_app", "utf8")
  .trim();
const connection = new Mongo(
  `mongodb://controlrrhh:${encodeURIComponent(password)}@127.0.0.1:27017/control_rrhh?authSource=control_rrhh`,
);
if (connection.getDB("control_rrhh").runCommand({ ping: 1 }).ok !== 1) quit(1);
