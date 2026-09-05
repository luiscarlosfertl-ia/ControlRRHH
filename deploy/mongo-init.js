const password = require("fs")
  .readFileSync("/run/secrets/mongo_app", "utf8")
  .trim();
if (!password) throw new Error("Missing application database secret");
db.getSiblingDB("control_rrhh").createUser({
  user: "controlrrhh",
  pwd: password,
  roles: [{ role: "readWrite", db: "control_rrhh" }],
});
