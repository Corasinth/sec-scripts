// =======================================MODULES=======================================
require('dotenv').config({ quiet: true })
const fs = require("node:fs")
const path = require('path');
const os = require('os')
const { queryApi } = require('sec-api');
// =======================================QUERIES=======================================
// const testCusip = ""
const testCIK = "0000928047 1046192 1094584"
const testCIKArr = testCIK.split(" ")
const cikArr = []

for (let i = 0; i < testCIKArr.length; i++) {
    cikArr.push(testCIKArr[i].toString().replace(/^0+/, ''))

}

let queryStr = `cik:(${testCIK})`

// "formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[2025-01-01 TO 2025-12-31] AND (928047, 320193, 1065280)"
// formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[2025-01-01 TO 2025-12-31] AND (cik:928047 OR cik:320193 OR cik:1065280)
// formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[2025-01-01 TO 2025-12-31] AND (${queryStr})

// Query to grab form 13F-HR for a specified cik
// const queryObj = {
//     query: `formType:13F AND cik:${cik} AND NOT formType:NT AND NOT formType:A`,
//     from: '0', // start with first filing. used for pagination/skipping entries
//     size: '4', // limit response to # of filings, max 50
//     sort: [{ filedAt: { order: 'desc' } }], // sort result by filedAt, newest first
// }

const queryObj = {
    query: `(formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[2025-01-01 TO 2025-12-31]) AND (cik:928047 OR cik:1094584 OR cik:1046192)`,
    from: '0', // start with first filing. used for pagination/skipping entries
    size: '50', // limit response to # of filings, max 50
    sort: [{ filedAt: { order: 'desc' } }], // sort result by cik
}

// const queryObj = {
//     query: `formType:13F AND holdings.cusip:${testCusip}`,
//     from: "0",
//     size: "50",
//     sort: [{ filedAt: { order: 'desc' } }]
// }


// =======================================MAIN VARIABLES=======================================
// Set API Key for sec-api
const API_KEY = process.env.API_KEY
queryApi.setApiKey(API_KEY);
// cik = 0000928047
// const cikArray = processArgs()

// =======================================FUNCTIONS=======================================
// Takes in arguments and throws an error if there aren't any
function processArgs() {
    let cikArray = []

    for (let i = 2; i < process.argv.length; i++) {
        cikArray.push(process.argv[i])
    }

    if (cikArray.length === 0) {
        console.error("\nPlease add as space-seperated arguments the CIK numbers of the companies you are interested\n\nAs follows: node form13F.js ########## ########## ##########\n")
        process.exit()
    }
    return
}

// Makes api request; returns json result
async function query(queryObj) {
    // Trims leading 0s from CIK for query formatting
    cik = cik.toString().replace(/^0+/, '');
    return await queryApi.getFilings(query);
}


async function main() {
    // for (const cik of cikArray) {

    let results = await queryApi.getFilings(queryObj)

    fs.writeFile("./query_output.json", JSON.stringify(results), err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
    // }
}
main()