import fs from "fs";
import https from "https";
import { exec } from "child_process";

const CID = "bafkreic4la7xkcw3na2ppjl2h5ezv6pq5uacrrynvzstq4b37nbqeqcd3q";
const url = `https://gateway.pinata.cloud/ipfs/${CID}`;

console.log("IPFS URL:", url);  

// Step 4: Fetch from IPFS
https.get(url, (res) => {
  const file = fs.createWriteStream("retrieved_document");
  res.pipe(file);

  file.on("finish", () => {
    file.close();
    console.log("File retrieved successfully");

    // Step 5: Open file (Windows)
    exec("start retrieved_document");
  });
});

