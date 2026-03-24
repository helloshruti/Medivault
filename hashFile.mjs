import fs from "fs";
import crypto from "crypto";

const file = fs.readFileSync("bloodcancer.pdf");

const sha256Hash = crypto
  .createHash("sha256")
  .update(file)
  .digest("hex");

console.log("SHA-256:", sha256Hash);
