// =======================================DATAFLOW EXPLANATION=======================================
// When running the script, it is nessecary to add space seperated CIK numbers for the companies you're interested in. The script takes these numbers, trims the leading 0s, splits them into groups of ten, generates a queryStr for the API, and puts them into an array. It does this because the max number of filings that the API returns is 50, and the script is setup to search for 13F-HR files (excluding amendments and 13F-NT files) in the last year, specifically filings with a period of report between when the script was run and exactly 1 year ago. With a filing each quarter, 10 companies produces 40 filings—and the extra ten are just in case we get up to 5 filings/company, for some reason. It may be that the script only produces three filings for the last year as well, due to mismatches in the period of report, but if so this can be fixed by editing how the startDate value is calculated, and by editing the number of CIK numbers grouped together to not exceed the total 50.
 
// The script will take the filing info from these companies and compare them against the ./database.csv file assumed to be in this folder. To turn the csv file into something more useful for data comparisons, each row in the file is converted into a an object entry in a larger object, with the key name being the second column of the database.csv file, assumed to be CUSIP. Additionally, the headers of the columns, assumed to be the first row, are saved as a seperate array and used to both set the keys for the row data and retrieve them later in the correct order. 

// The main script then runs, looping through the cikArray and making a query with each string. For each query result, three things happen. The resulting data is saved to a temporary folder as raw json. Each individual filing from the query is sent to a function that takes the JSON holdings and saves a .csv file of that filing data with a filename that includes the period of report, the form type, the company name, and the company cik number. Each row is manually built out, and the header row is defined by a hardcoded array. Changing the order of the headers requires changing this array AND the order in which each row is built out, since headers for each column are not the same as the keys used to access the data from the API query. 

// And of course, the full query is processed to create the analyzed database csv files. Because the API query returns a list of filings sorted by period of report (latest to oldest—I could not figure out how to have the query sorted by company name or other identifier), the first thing to do is to create an object that holds a series of arrays, one for each company, where the keys are the CIK numbers of those companies. Then, the script loops through that object and sends each company array to be processed. 

// Each filing is looped through, and its period of report saved (newest to oldest). The holdings of each filing are looped through, and saved to an object that duplicates the filing entry, while also adding a new data over time key to the holding object. There, the values, shares, holding type, and period of report are copied to an object labeled by the period of report. Once the script has looped through each filing, compiling the holding data for each one, it loops through the compiled object to create an array that can be sorted alphanumerically by company name. The company name is preferred to come from the database.csv file, since sometimes these differ from the API query data and results in a non-alphabetical output csv file.

// The sorted array is then looped through, each holdings CUSIP number being checked against the database.csv object. Headers are made for the csv string first, producing columns for company name, CUSIP, and then for each period of report a values, shares, and shares comparison column. If there's a match with the database.csv object a new row is added to the csv string by looping through the period of report array made earlier as well as the headers from the database.csv object.

// Lastly, the temp JSON data files are brought into memory collected into one object, and written to a single file before having their temporary folder deleted.

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
const date = new Date()
const endDate = date.toISOString().split('T')[0]
const startDate = `${new Date(date.setFullYear(date.getFullYear() - 1, date.getMonth(), date.getDate())).toISOString().split('T')[0]}`
const periodOfReportTracker = {
  earliest: new Date(),
  latest: new Date()
}
// cikArray = ["0000928047"]
const cikArray = processArgs()

// =======================================FUNCTIONS=======================================
// Takes in arguments, throws an error if there aren't any, and generates query strings used for API calls
function processArgs() {
  let cikArray = []
  let tempCikArray = process.argv.slice(2)
  let tempCikStr = ""

  // Creates a comma+space seperated string of trimmed CIK numbers to create an array of query strings
  for (let i = 0; i < tempCikArray.length; i++) {
    // Trims leading 0s from CIK for query formatting
    let cik = `${tempCikArray[i].toString().replace(/^0+/, '')}`
    tempCikStr += cik

    if ((i % 10 === 0 && i !== 0) || i === tempCikArray.length - 1) {
      cikArray.push(`(formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[${startDate} TO ${endDate}]) AND (cik:(${tempCikStr}))`)
      tempCikStr = ""
    } else {
      tempCikStr += ", "
    }
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
async function getForm13FHR(queryStr) {
  let query = {
    query: `${queryStr}`,
    from: '0', // start with first filing. used for pagination/skipping entries
    size: '50', // limit response to # of filings, max 50
    sort: [{ periodOfReport: { order: 'desc' } }], // sort result by filedAt, newest first
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
  let headers = ["name_Of_Issuer", "ticker", "cusip", "cik", "title_of_class", "value", "shares/prn_amt", "SharesOrPRN", "investment_discretion", "voting_authority_sole", "voting_authority_shared", "voting_authority_none", "other_manager"]

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
    csvString += holding.nameOfIssuer ?? ""
    csvString += ','
    csvString += holding.ticker ?? ""
    csvString += ','
    csvString += holding.cusip ?? ""
    csvString += ','
    csvString += holding.cik ?? ""
    csvString += ','
    csvString += holding.titleOfClass ?? ""
    csvString += ','
    csvString += holding.value ?? ""
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamt ?? ""
    csvString += ','
    csvString += holding.shrsOrPrnAmt.sshPrnamtType ?? ""
    csvString += ','
    csvString += holding.investmentDiscretion ?? ""
    csvString += ','
    csvString += holding.votingAuthority.Sole ?? ""
    csvString += ','
    csvString += holding.votingAuthority.Shared ?? ""
    csvString += ','
    csvString += holding.votingAuthority.None ?? ""
    csvString += ','
    csvString += `\"${holding.otherManager ?? ""}\"`


    csvString += '\n'
  }

  return { filename: filename, csv: csvString }
}

// Compiles together all filings in given array (assumed to be a single company), matches CUSIP numbers from mainDatabase Object, builds table, returns in format {filename: "filename", csv: "csvString"}
// companyFilingArr will be newest to oldest
function processFormDataWithDatabase(companyFilingArr) {
  // Holds periods of report for filings to later iterate through—newest to oldest
  const periodOfReportArray = []
  const companyFilingObject = {}

  // Compare and set periodOfReportTracker
  if (new Date(companyFilingArr[0].periodOfReport).getTime() > periodOfReportTracker.latest.getTime()) {
    periodOfReportTracker.latest = new Date(companyFilingArr[0].periodOfReport)
  }
  if (new Date(companyFilingArr[companyFilingArr.length - 1].periodOfReport).getTime() < periodOfReportTracker.earliest.getTime()) {
    periodOfReportTracker.earliest = new Date(companyFilingArr[companyFilingArr.length - 1].periodOfReport)
  }

  // Set filename
  const filename = `${companyFilingArr[companyFilingArr.length - 1].periodOfReport}_to_${companyFilingArr[0].periodOfReport}_investment_data_${replaceSpaceWithDashAndRemoveSpecialCharacters(companyFilingArr[0].companyName)}_${companyFilingArr[0].cik}.csv`

  // Variables for CSV construction
  let csvString = ""
  let madeHeaders = false

  // Build Reference Object to compare with database—collects data from across filings and associates it with a period of report
  for (let i = 0; i < companyFilingArr.length; i++) {
    const currentPeriodOfReport = companyFilingArr[i].periodOfReport
    periodOfReportArray.push(currentPeriodOfReport)

    for (const holding of companyFilingArr[i].holdings) {
      if (!companyFilingObject[holding.cusip]) {
        companyFilingObject[holding.cusip] = {}
        companyFilingObject[holding.cusip].dot = {}
        for (let key in holding) {
          companyFilingObject[holding.cusip][key] = holding[key]
        }
        // Prefer mainDatabaseObject issuerNames to sec filing data
        if (!!mainDatabaseObject[holding.cusip]) {
          companyFilingObject[holding.cusip].nameOfIssuer = mainDatabaseObject[holding.cusip][headerArray[0]]
        }
      }

      if (companyFilingObject[holding.cusip].dot[currentPeriodOfReport]) {
        // If entry for current period of report already exists, there's some funky reporting. This records the multiple entries under the same CUSIP number
        companyFilingObject[holding.cusip].dot[currentPeriodOfReport] = { periodOfReport: currentPeriodOfReport, value: `${companyFilingObject[holding.cusip].dot[currentPeriodOfReport].value}/${holding.value}`, shares: `${companyFilingObject[holding.cusip].dot[currentPeriodOfReport].shares}/${holding.shrsOrPrnAmt.sshPrnamt}`, holdingType: `${companyFilingObject[holding.cusip].dot[currentPeriodOfReport].holdingType}/${holding.shrsOrPrnAmt.sshPrnamtType}` }

      } else {
        // dot.{periodOfReport, value, shares, holdingType}
        companyFilingObject[holding.cusip].dot[currentPeriodOfReport] = { periodOfReport: currentPeriodOfReport, value: holding.value, shares: holding.shrsOrPrnAmt.sshPrnamt, holdingType: holding.shrsOrPrnAmt.sshPrnamtType }
      }


    }
    // Saving memory?
    companyFilingArr[i] = ""
  }

  // Sort! Objects into array alphanumerically by company name
  companyFilingArr = []
  for (key in companyFilingObject) {
    companyFilingArr.push(companyFilingObject[key])
  }
  companyFilingArr.sort(function (a, b) {
    // Nessecary to remove special characters because escaped quotes throws it all off
    let val = replaceSpaceWithDashAndRemoveSpecialCharacters(a.nameOfIssuer).localeCompare(replaceSpaceWithDashAndRemoveSpecialCharacters(b.nameOfIssuer))
    // Arbitrary order if theý're equal—but they shouldn't be equal
    if (val === 0) {
      val = 1
    }
    return val
  })

  // If the current holding has the same CUSIP as an entry in the database, a row is generated for the csv file joining data from sec-api about the holding and investment data from the database
  // Data is taken to identify the company, then provide value and share data for multiple periods of reports, then fill in row data from the database.csv file
  for (const holding of companyFilingArr) {
    if (mainDatabaseObject[holding.cusip]) {
      // Generate headers for the .csv form only if there's a match and only if we haven't already made the headers
      if (!madeHeaders) {
        // csvString += "NAME_OF_ISSUER,CUSIP,CIK,VALUE,SHARES_OR_PRN_AMT,SHARES_OR_PRN_TYPE,"
        csvString += "NAME_OF_ISSUER,CUSIP,"

        // Go oldest to newest, but periodOfReportArray is newest to oldest
        for (let i = periodOfReportArray.length - 1; i > -1; i--) {
          const por = periodOfReportArray[i]

          csvString += `VALUE_${por},`
          csvString += `SHARES_${por},`
          csvString += `TYPE,`

          if (i !== periodOfReportArray.length - 1) {
            csvString += `SHARES_DIFF_${periodOfReportArray[i + 1]}_TO_${por},`
          }
        }

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
      // Name of Company form database.csv
      csvString += `${mainDatabaseObject[holding.cusip][headerArray[0]]}`
      csvString += ','

      csvString += holding.cusip
      csvString += ','
      // csvString += holding.cik
      // csvString += ','

      for (let i = periodOfReportArray.length - 1; i > -1; i--) {
        if (!holding.dot[periodOfReportArray[i]]) {
          holding.dot[periodOfReportArray[i]] = { periodOfReport: false, value: 0, shares: 0, holdingType: "" }
        }
        const por = holding.dot[periodOfReportArray[i]]

        // Values
        csvString += `${por["value"]},`
        // Shares
        csvString += `${por["shares"]},`
        // Shares or PRN
        csvString += `${por["holdingType"]},`

        if (i !== periodOfReportArray.length - 1) {
          // Difference
          csvString += `${Number(por.shares) - Number(holding.dot[periodOfReportArray[i + 1]].shares)},`
        }
      }

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

async function createFoldersAndFilePaths(form) {
  // Creates file paths
  const secFormFilepath = path.join(os.homedir(), 'Desktop', "sec_csv", "Form13F-HR", `${replaceSpaceWithDashAndRemoveSpecialCharacters(form.companyName)}_CIK_${form.cik}_${replaceSpaceWithDashAndRemoveSpecialCharacters(form.formType)}.csv`);

  const queriedDataFilepath = path.join(os.homedir(), 'Desktop', "sec_csv", "Queried_Data", `${replaceSpaceWithDashAndRemoveSpecialCharacters(form.companyName)}_CIK_${form.cik}_Divestment_Analysis.csv`);

  // Creates folder on user's Desktop for forms
  fs.mkdirSync(secFormFilepath, { recursive: true }, (e) => {
    if (e) {
      console.error(e)
    } else {
      // console.log(`Created folder ${secFormFilepath}`)
    }
  })

  // Creates folder on user's Desktop for analyzed data
  fs.mkdirSync(queriedDataFilepath, { recursive: true }, (e) => {
    if (e) {
      console.error(e)
    } else {
      // console.log(`Created folder ${queriedDataFilepath}`)
    }
  })
  return { secFormFilepath: secFormFilepath, queriedDataFilepath: queriedDataFilepath }
}

function replaceSpaceWithDashAndRemoveSpecialCharacters(string) {
  return string.replace(/\s+/g, '-').replace(/[^0-9a-z]/gi, "")
}


// =======================================MAIN=======================================
// Loops through companies, creating folders, running data processing functions, and recording data to .csv files
async function main() {
  process.stdout.write("\r\x1b[K")
  process.stdout.write(`Processing 13F-HR filings...`)
  fs.mkdirSync(path.join(os.homedir(), "Desktop", "sec_csv", "tempJSON"), { recursive: true }, (e) => {
    if (e) {
      console.error(e)
    } else {
      // console.log(`Created folder)
    }
  })
  // Loop through CIK numbers & request/process data for each
  for (let i = 0; i < cikArray.length; i++) {
    const queryStr = cikArray[i]
    // Grab full filings object
    const secData = await getForm13FHR(queryStr)
    // Test Data
    // let i = 1
    // const secData = JSON.parse(fs.readFileSync("./testData.json"))
    let filings = secData.filings
    const filingsByCompany = {}

    // Creates separate arrays for each company
    for (const filing of filings) {
      if (!filingsByCompany[filing.cik]) {
        filingsByCompany[filing.cik] = []
      }
      filingsByCompany[filing.cik].push(filing)
    }

    // Process data for each array of company filings
    for (const key in filingsByCompany) {
      const companyFilingArr = filingsByCompany[key]

      const { secFormFilepath, queriedDataFilepath } = await createFoldersAndFilePaths(companyFilingArr[0])


      // Record each form seperately
      for (const form of companyFilingArr) {
        // Returns in format {filename: "filename", csv: "csvString"}
        const csvData = form13FHRtoCSV(form)
        fs.writeFile(path.join(secFormFilepath, csvData.filename), csvData.csv, err => {
          if (err) {
            console.error(err);
          } else {
            // file written successfully
          }
        });
      }

      // Returns in format {filename: "filename", csv: "csvString"}
      const queriedData = processFormDataWithDatabase(companyFilingArr)
      // Only writes file if data exists
      if (queriedData.csv) {
        fs.writeFile(path.join(queriedDataFilepath, queriedData.filename), queriedData.csv, err => {
          if (err) {
            console.error(err);
          } else {
            // file written successfully
          }
        });
      }
    }

    // Save this queries JSON data temporarily
    fs.writeFileSync(path.join(os.homedir(), "Desktop", "sec_csv", "tempJSON", `rawData_${i}.json`), JSON.stringify(secData), err => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
      }
    });
  }

  // Collate raw data JSON temp files into a single object
  const fullJSONFilings = {
    cikArray: process.argv.slice(2),
    startDateOfSearch: startDate,
    endDateOfSearch: endDate,
    earliestPeriodOfReport: periodOfReportTracker.earliest.toISOString().split("T")[0],
    latestPeriodOfReport: periodOfReportTracker.latest.toISOString().split("T")[0],
    filings: []
  }

  const fullFilepath = path.join(os.homedir(), "Desktop", "sec_csv", "tempJSON")
  const fileList = fs.readdirSync(fullFilepath)

  for (let file of fileList) {
    if (file.match(/\.[json]+$/i)) {
      const obj = JSON.parse(fs.readFileSync(path.join(fullFilepath, file), "utf-8"))
      fullJSONFilings.filings = fullJSONFilings.filings.concat(obj.filings)
    }
  }

  fs.rmSync(fullFilepath, { recursive: true, force: true });
  fs.writeFileSync(path.join(os.homedir(), "Desktop", "sec_csv", `rawData_for_13F-HR_${periodOfReportTracker.earliest.toISOString().split("T")[0]}_to_${periodOfReportTracker.latest.toISOString().split("T")[0]}_timestamp_${endDate}.json`), JSON.stringify(fullJSONFilings), err => {
    if (err) {
      console.error(err);
    } else {
      // file written successfully
    }
  });
  console.log("Finished")
}

main()