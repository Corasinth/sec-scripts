// =======================================MODULES=======================================
require('dotenv').config({ quiet: true })
const fs = require("node:fs")
const path = require('path');
const os = require('os')
const { queryApi } = require('sec-api');
// =======================================QUERIES=======================================
const testCusip = ""


// Query to grab form 13F-HR for a specified cik
// const query = {
//     query: `formType:13F AND cik:${cik} AND NOT formType:NT AND NOT formType:A`,
//     from: '0', // start with first filing. used for pagination/skipping entries
//     size: '4', // limit response to # of filings, max 50
//     sort: [{ filedAt: { order: 'desc' } }], // sort result by filedAt, newest first
// }


const query = {
    query: `formType:13F AND holdings.cusip:${testCusip}`,
    from: "0",
    size: "50",
    sort: [{ filedAt: { order: 'desc' } }]
}


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
async function query(cik) {
    // Trims leading 0s from CIK for query formatting
    cik = cik.toString().replace(/^0+/, '');
    return await queryApi.getFilings(query);
}


function main() {
    // for (const cik of cikArray) {
    fs.writeFile("./query_output.json", JSON.stringify(query(cik)), err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
    // }
}