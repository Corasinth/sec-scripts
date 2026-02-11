// =======================================MODULES=======================================
require('dotenv').config({quiet: true})
const fs = require("node:fs")
const path = require('path');
const os = require('os')
const { queryApi } = require('sec-api');

// =======================================MAIN VARIABLES=======================================
// Set API Key for sec-api
const API_KEY = process.env.API_KEY
queryApi.setApiKey(API_KEY);

// cikArray = ["0000928047"]
const cikArray = processArgs()

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
  return cikArray
}

// Makes api request; returns json result
async function getLastFourForm13FHR(cik) {
  // Trims leading 0s from CIK for query formatting
  cik = cik.toString().replace(/^0+/, '');

  let query = {
    query: `formType:13F AND cik:${cik} AND NOT formType:NT`,
    from: '0', // start with first filing. used for pagination/skipping entries
    size: '4', // limit response to # of filings
    sort: [{ filedAt: { order: 'desc' } }], // sort result by filedAt, newest first
  }

  return await queryApi.getFilings(query);
}

// Takes in form 13F-HR in object form and returns an object with a filename and csvString entries
function form13FHRtoCSV(formObj) {
  // Generate filename from data
  // formObj.filedAt.split('T')[0] — turn time filed into simple date
  const filename = `${replaceSpaceWithDashAndRemoveSpecialCharacters(formObj.companyName)}_${formObj.cik}_${formObj.periodOfReport}_${formObj.formType}.csv`

  // Array of holding objects
  const holdings = formObj.holdings

  // Hardcoding CSV headers because header names are not the same as object keys in the data
  let headers = ["nameOfIssuer", "cusip", "value", "shares", "SharesOrPRN"]

  let csvString = ""
  // Creates header row for CSV
  for (let i = 0; i < headers.length; i++) {
    csvString += headers[i].toUpperCase()

    if (i < headers.length - 1) {
      csvString += ","
    } else {
      csvString += "\n"
    }
  }

  for (const holding of holdings) {
    // Hard coding these in the desired order—less flexible but easier to edit and move around
    csvString += holding.nameOfIssuer
    csvString += ','
    csvString += holding.cusip
    csvString += ','
    csvString += holding.value
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamt
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamtType

    csvString += '\n'
  }

  return { filename: filename, csv: csvString }
}

function replaceSpaceWithDashAndRemoveSpecialCharacters(string) {
  return string.replace(/\s+/g, '-').replace(/[^0-9a-z]/gi, "")
}


// =======================================MAIN=======================================
async function main() {
  // Loop through CIK numbers & request/process data for each
  for (const cik of cikArray) {

    // Grab full filings object
    const secData = await getLastFourForm13FHR(cik)
    // Test Data—comment out above line and the for loop going through the cikArray to use
    // const secData = JSON.parse(fs.readFileSync("./output.json"))
    let filings = secData.filings

    // Creates folder on user's Desktop
    const filepath = path.join(os.homedir(), 'Desktop', "sec_csv", `${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].companyName)}_${filings[0].cik}_${filings[0].formType}_${filings[filings.length - 1].periodOfReport}_to_${filings[0].periodOfReport}`);

    fs.mkdirSync(filepath, { recursive: true }, (e) => {
      if (e) {
        console.error(e)
      } else {
        console.log(`Created folder ${filepath}`)
      }
    })

    // Save original json data for reference
    fs.writeFile(path.join(filepath, `rawData_${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].companyName)}_${filings[filings.length - 1].periodOfReport}_to_${filings[0].periodOfReport}.json`), csvData.csv, err => {
        if (err) {
          console.error(err);
        } else {
          // file written successfully
        }
      });

    // Loop through the filings to process each form
    for (const form of filings) {
      // Returns in format {filename: "filename", csv: "csvString"}
      const csvData = form13FHRtoCSV(form)

      fs.writeFile(path.join(filepath, csvData.filename), csvData.csv, err => {
        if (err) {
          console.error(err);
        } else {
          // file written successfully
        }
      });
    }
  }
  console.log("Finished")
}

main()