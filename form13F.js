// =======================================MODULES=======================================
require('dotenv').config({ quiet: true })
const fs = require("node:fs")
const path = require('path');
const os = require('os')
const { queryApi } = require('sec-api');

// =======================================MAIN VARIABLES=======================================
// Set API Key for sec-api
const API_KEY = process.env.API_KEY
queryApi.setApiKey(API_KEY);
// Path to database file—change if needed
const databaseCSVPath = "./database.csv"
// Get headers and turn database .csv file into more easily usable object
const { headerArray, databaseMatrix } = getHeadersAndMatrix()
const mainDatabaseObject = getDatabaseObj(databaseMatrix)
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
    console.error("\nPlease add as space-seperated arguments the CIK numbers of the companies you are interested\n\nAs follows: node form13F.js ########## ########## ##########\nThe script will now exit.")
    process.exit()
  }
  return cikArray
}

function getHeadersAndMatrix() {
  let databaseStr = fs.readFileSync(databaseCSVPath, "utf-8")

  // Create database matrix
  let databaseMatrix = []
  for (entry of databaseStr.split("\n")) {
    // If escapeDetection is false than we are not detecting that we are inside a quoted string
    // If escapeDetection is true than we are detecting that we are inside a quoted string
    let escapeDetection = false
    let rowArr = []
    let tempStr = ''
    for (let i = 0; i < entry.length; i++) {
      // Toggle this if we see a quote mark 
      if (entry[i] === '"') {
        escapeDetection = !escapeDetection
      }

      if ((entry[i] !== "," && !escapeDetection) || escapeDetection) {
        tempStr += entry[i]
      }

      if ((entry[i] === "," || i === entry.length - 1) && !escapeDetection) {
        rowArr.push(tempStr.replace(/[\n\r\t]/gm, ""))
        tempStr = ""
      }
    }
    databaseMatrix.push(rowArr)
  }

  // Create neat headerArray
  let headers = []
  for (entry of databaseMatrix[0]) {
    // Trim spaces around header, replace spaces within header with _, uppercase header, remove line breaks
    headers.push(entry.trim().replace(/\s+/g, '_').toUpperCase().replace(/[\n\r\t]/gm, ""))
  }
  // Add slice to get rid of header row
  return { headerArray: headers, databaseMatrix: databaseMatrix.slice(1) }

}

function getDatabaseObj(databaseMatrix) {
  // Organizing CSV by CUSIP #
  let cusipObj = {}

  for (row of databaseMatrix) {
    // Second column (index 1) is the CUSIP column
    // This sets each row of the .csv file as an object labeled by its CUSIP number so CUSIP numbers can be easily compared when creating final analyzed data
    if (row[1]) {
      cusipObj[row[1]] = {}

    } else {
      console.log(`${row[0]} has no CUSIP number!—skipping entry`)
      continue
    }
    for (let i = 0; i < row.length; i++) {
      // Labels each value by the column header, removes line break characters
      cusipObj[row[1]][headerArray[i]] = row[i].replace(/[\n\r]/gm, "")
    }
  }
  return cusipObj
}

// Makes api request; returns json result
async function getForm13FHR(cik) {
  // Trims leading 0s from CIK for query formatting
  cik = cik.toString().replace(/^0+/, '');

  let query = {
    query: `formType:13F AND cik:${cik} AND NOT formType:NT AND NOT formType:A`,
    from: '0', // start with first filing. used for pagination/skipping entries
    size: '4', // limit response to # of filings, max 50
    sort: [{ filedAt: { order: 'desc' } }], // sort result by filedAt, newest first
  }

  return await queryApi.getFilings(query);
}

// Takes in form 13F-HR in object form and returns an object with a filename and csvString entries
function form13FHRtoCSV(formObj) {
  // Generate filename from data
  // formObj.filedAt.split('T')[0] — turn time filed into simple date
  // Filter out special characters especially from the form name that could cause errors in saving file
  const filename = `${formObj.periodOfReport}_${replaceSpaceWithDashAndRemoveSpecialCharacters(formObj.formType)}_${replaceSpaceWithDashAndRemoveSpecialCharacters(formObj.companyName)}_${formObj.cik}.csv`

  // Array of holding objects
  const holdings = formObj.holdings

  // Hardcoding CSV headers because header names are not the same as object keys in the data
  // let headers = ["nameOfIssuer", "cusip", "value", "shares", "SharesOrPRN"]
  let headers = ["name_Of_Issuer", "cusip", "cik", "title_of_class", "value", "shares/prn_amt", "SharesOrPRN", "investment_discretion", "voting_authority_sole", "voting_authority_shared", "voting_authority_none", "other_manager", "ticker"]

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
    csvString += holding.cik
    csvString += ','
    csvString += holding.titleOfClass
    csvString += ','
    csvString += holding.value
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamt
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamtType
    csvString += ','
    csvString += holding.investmentDiscretion
    csvString += ','
    csvString += holding.votingAuthority.Sole
    csvString += ','
    csvString += holding.votingAuthority.Shared
    csvString += ','
    csvString += holding.votingAuthority.None
    csvString += ','
    csvString += `\"${holding.otherManager}\"`
    csvString += ','
    csvString += holding.ticker

    csvString += '\n'
  }

  return { filename: filename, csv: csvString }
}
// Matches CUSIP numbers from mainDatabase Object, builds table, returns in format {filename: "filename", csv: "csvString"}
function processFormDataWithDatabase(form) {
  const holdings = form.holdings
  const filename = `investment_data_for_${form.periodOfReport}_${replaceSpaceWithDashAndRemoveSpecialCharacters(form.companyName)}_${form.cik}.csv`
  let csvString = ""
  let madeHeaders = false

  // If the current holding has the same CUSIP as an entry in the database, a row is generated for the csv file joining data from sec-api about the holding and investment data from the database
  for (const holding of holdings) {
    if (mainDatabaseObject[holding.cusip]) {

      // Generate headers for the .csv form only if there's a match and only if we haven't already made the headers
      if (!madeHeaders) {
        // csvString += "NAME_OF_ISSUER,CUSIP,CIK,VALUE,SHARES_OR_PRN_AMT,SHARES_OR_PRN_TYPE,"
        csvString += "NAME_OF_ISSUER,CUSIP,VALUE,SHARES_OR_PRN_AMT,"
        // Skipping first two headers
        for (let i = 2; i < headerArray.length; i++) {
          csvString += headerArray[i]
          if (i < headerArray.length - 1) {
            csvString += ','
          }
        }
        csvString += '\n'
        madeHeaders = true
      }


      // Generate row data
      csvString += `${mainDatabaseObject[holding.cusip][headerArray[0]]}`
      csvString += ','
      csvString += holding.cusip
      csvString += ','
      // csvString += holding.cik
      // csvString += ','
      csvString += holding.value
      csvString += ','
      csvString += holding.shrsOrPrnAmt.sshPrnamt
      csvString += ','
      // csvString += holding.shrsOrPrnAmt.sshPrnamtType
      // csvString += ','

      // Skip the first two elements of the header array since they're coming from the sec-api data
      for (let i = 2; i < headerArray.length; i++) {
        csvString += mainDatabaseObject[holding.cusip][headerArray[i]]
        if (i < headerArray.length - 1) {
          csvString += ','
        }
      }
      csvString += '\n'
    }
  }
  return { filename: filename, csv: csvString }
}

function replaceSpaceWithDashAndRemoveSpecialCharacters(string) {
  return string.replace(/\s+/g, '-').replace(/[^0-9a-z]/gi, "")
}


// =======================================MAIN=======================================
// Loops through companies, creating folders, running data processing functions, and recording data to .csv files
async function main() {
  // Loop through CIK numbers & request/process data for each
  for (const cik of cikArray) {
  process.stdout.write("\r\x1b[K")
  process.stdout.write(`Processing 13F-HR filings for company #${cik}...`)

  // Grab full filings object
  const secData = await getForm13FHR(cik)
  // Test Data
  // const secData = JSON.parse(fs.readFileSync("./testData.json"))
  let filings = secData.filings

  // Creates folder on user's Desktop for forms
  const secFormFilepath = path.join(os.homedir(), 'Desktop', "sec_csv", "Form_13F-HR", `${filings[filings.length - 1].periodOfReport}_to_${filings[0].periodOfReport}_${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].companyName)}_${filings[0].cik}_${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].formType)}.csv`);

  fs.mkdirSync(secFormFilepath, { recursive: true }, (e) => {
    if (e) {
      console.error(e)
    } else {
      // console.log(`Created folder ${secFormFilepath}`)
    }
  })

  // Save original json data for reference
  fs.writeFile(path.join(secFormFilepath, `rawData_${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].companyName)}_${filings[filings.length - 1].periodOfReport}_to_${filings[0].periodOfReport}.json`), JSON.stringify(secData), err => {
    if (err) {
      console.error(err);
    } else {
      // file written successfully
    }
  });

  // Creates folder on user's Desktop for analyzed data
  const queriedDataFilepath = path.join(os.homedir(), 'Desktop', "sec_csv", "Queried_Data", `${filings[filings.length - 1].periodOfReport}_to_${filings[0].periodOfReport}_${replaceSpaceWithDashAndRemoveSpecialCharacters(filings[0].companyName)}_${filings[0].cik}_Divestment_Analysis.csv`);

  fs.mkdirSync(queriedDataFilepath, { recursive: true }, (e) => {
    if (e) {
      console.error(e)
    } else {
      // console.log(`Created folder ${queriedDataFilepath}`)
    }
  })

  // Loop through the filings to process each form
  for (const form of filings) {
    // Returns in format {filename: "filename", csv: "csvString"}
    const csvData = form13FHRtoCSV(form)

    // Returns in format {filename: "filename", csv: "csvString"}
    const queriedData = processFormDataWithDatabase(form)

    fs.writeFileSync(path.join(secFormFilepath, csvData.filename), csvData.csv, err => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
      }
    });

    // Only writes file if data exists
    if (queriedData.csv) {
      fs.writeFileSync(path.join(queriedDataFilepath, queriedData.filename), queriedData.csv, err => {
        if (err) {
          console.error(err);
        } else {
          // file written successfully
        }
      });
    }

  }
  }
  console.log("Finished")
}

main()