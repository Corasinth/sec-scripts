// ==========================Main Variables & Modules==========================
// Modules
require('dotenv').config({ quiet: true })
const fs = require("node:fs")
const path = require('path');
const os = require('os')
const { form13FCoverPagesApi } = require('sec-api');
const { start } = require('node:repl');

// Set API Key for sec-api
const API_KEY = process.env.API_KEY
form13FCoverPagesApi.setApiKey(API_KEY);

// Useful to have these dates for query/filenames
const date = new Date()
let endDate = date.toISOString().split('T')[0]
let startDate = `${new Date(date.setFullYear(date.getFullYear() - 1, date.getMonth(), date.getDate())).toISOString().split('T')[0]}`

// Tracks how many API credits were used
APICounter = 0

// Change to test file path to use
const testFile = "./canadian_test_file.json"
// const testFile = ""

// ==========================Functions==========================
// Uses current date to return query string to search the last 4 quarters
function queryStringGenerator() {

    // return `formType:13F AND NOT formType:NT AND NOT formType:A AND periodOfReport:[${startDate} TO ${endDate}] AND (filingManager.address.stateOrCountry:(A0 OR A1 OR A2 OR A3 OR A4 OR A5 OR A6 OR A7 OR A8 OR A9 OR B0 OR Z4))`

    return `formType:13F AND NOT formType:NT AND periodOfReport:[${startDate} TO ${endDate}] AND (filingManager.address.stateOrCountry:(A0 OR A1 OR A2 OR A3 OR A4 OR A5 OR A6 OR A7 OR A8 OR A9 OR B0 OR Z4))`
}

// Sends a query for cover pages. 'from' skips the first x results, results are ordered by oldest to newest file date, returns {data, loopContinue}
async function queryCoverPages(queryString, from = 0) {
    let query = {
        query: `${queryString}`,
        from: `${from}`, // start with first filing. used for pagination/skipping entries
        size: '50', // limit response to # of filings, max 50
        sort: [{ "periodOfReport": { "order": "asc" } }]// sort result by filedAt, oldest first
    }
    // Returns {total:object,data:arrayOfCoverPages}
    let coverPageQueryResponse = await form13FCoverPagesApi.getData(query)
    APICounter++

    // Checks if we have reached the end of the results and reports back to stop loop if so
    let loopContinue = from + 50 < coverPageQueryResponse.total.value

    return { data: coverPageQueryResponse.data, loopContinue: loopContinue }
}

// Takes in array, outputs object with CIK keys attatched to relevant coverPage info as so: {###:{various keys}}
function processDataIntoCIKObject(data) {
    let CIKObject = {}

    for (let coverPage of data) {
        // Generates a string of other managers if present to be added later
        let otherManagersListString = ""
        if (coverPage.otherManagersReportingForThisManager.length > 0) {
            otherManagersListString += collectOtherManagersIntoList(coverPage.otherManagersReportingForThisManager)
        }

        // Checks if an entry currently exists, adds any managers from this cover page to the entry, and moves on    
        if (CIKObject[coverPage.cik]) {
            // Tack on the new manager data to the current entry, then clean up duplicates
            let otherManagersCombinedString = `${CIKObject[coverPage.cik]["Other_Managers"]}${otherManagersListString}`

            CIKObject[coverPage.cik]["Other_Managers"] = eliminateDuplicatesFromStringList(otherManagersCombinedString, ';')

            continue
        }

        CIKObject[coverPage.cik] = {
            Company_Name: coverPage.filingManager.name,
            CIK: coverPage.cik,
            State_or_Country: countryCodeToStateOrCountry(coverPage.filingManager.address.stateOrCountry),
            Other_Managers: otherManagersListString,
        }
    }
    return CIKObject
}

// Takes in an array of manager objects, returns a list as a string
function collectOtherManagersIntoList(managerArray) {
    let listString = ""
    for (let manager of managerArray) {
        listString += `${manager.name} (CIK:${manager.cik});`
    }
    return listString
}

// Takes SEC country/state codes for Canada and returns the actual name
function countryCodeToStateOrCountry(code) {
    switch (code) {
        case "A0":
            return 'Alberta, Canada'
        case "A1":
            return 'British Columbia, Canada'
        case "A2":
            return 'Manitoba, Canada'
        case "A3":
            return 'New Brunswick, Canada'
        case "A4":
            return 'Newfoundland, Canada'
        case "A5":
            return 'Nova Scotia, Canada'
        case "A6":
            return 'Ontario, Canada'
        case "A7":
            return 'Prince Edward Island, Canada'
        case "A8":
            return 'Quebec, Canada'
        case "A9":
            return 'Saskatchewan, Canada'
        case "B0":
            return 'Yukon, Canada'
        case "Z4":
            return 'Canada (Federal Level)'
        default:
            `Unrecognized country code: ${code}`
    }
}

// Takes in a string list and seperator, turns into an array, a set, an array, back into a string
function eliminateDuplicatesFromStringList(listString, separatorString) {
    let listArray = listString.split(separatorString)
    let listSet = new Set(listArray)
    let duplicateFreeArray = [...listSet]
    return duplicateFreeArray.join(separatorString)
}

// Takes in the CIK object of this form ({###:{various keys}}) and uses the various keys as a header row and csv table
function processCIKObjectIntoCSVString(CIKObject) {
    // Turns the object into an array of objects which are sorted alphabetically by company name and then turned into a matrix of those object's values with the first array being comprised of the object keys
    let CSVMatrix = arrayOfIdenticalObjectsIntoCSVTable(Object.values(CIKObject).sort(function (a, b) {
        let val = a["Company_Name"].localeCompare(b["Company_Name"])
        // Arbitrary order if theý're equal—but they shouldn't be equal
        if (val === 0) {
            val = 1
        }
        return val
    }))

    // Joins the inner arrays
    let rowArray = []
    for(let row of CSVMatrix){
        rowArray.push(row.join(','))
    }
    // Join the outer array
    let CSVString = rowArray.join('\n')
    
    return CSVString
}

// Returns matrix where first entry is Object.keys() array
function arrayOfIdenticalObjectsIntoCSVTable(objectArray) {
    let matrix = []
    let keysArray = Object.keys(objectArray[0])
    matrix.push(keysArray)

    for (let obj of objectArray) {
        let tempArray = []
        for (key of keysArray) {
            tempArray.push(obj[key])
        }
        matrix.push(tempArray)
    }
    return sanitizeMatrix(matrix)
}

// Removes quotes and new line characters from matrix of values + puts string in quotes to make compatible with CSV string
function sanitizeMatrix(matrix) {
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            if (matrix[i][j]) {
                matrix[i][j] = `"${matrix[i][j].toString().replace(/["'“”‘’\n\r\t]/g, "")}"`
            }
        }
    }
    return matrix
}

// Saves CSV string in the sec_csv folder on desktop
function saveCanadian13FFilersAsCSV(CSVString) {
    // Create destination folder
    fs.mkdirSync(path.join(os.homedir(), "Desktop", "sec_csv"), { recursive: true }, (e) => {
        if (e) {
            console.error(e)
        } else {
            // console.log(`Created folder ${sec_csv}`)
        }
    })

    fs.writeFileSync(path.join(os.homedir(), "Desktop", "sec_csv", `All_Canadian_Filers_From_${startDate}_to_${endDate}.csv`), CSVString, err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
}

// Saves queried data in sec_csv folder as a JSON file for future use
function saveFilingDataAsJSON(data) {
    fs.mkdirSync(path.join(os.homedir(), "Desktop", "sec_csv"), { recursive: true }, (e) => {
        if (e) {
            console.error(e)
        } else {
            // console.log(`Created folder ${sec_csv}`)
        }
    })

    fullData = {
        startDate: startDate,
        endDate: endDate,
        totalEntries: data.length,
        data: data
    }

    fs.writeFileSync(path.join(os.homedir(), "Desktop", "sec_csv", `raw_cover_pages_for_all_canadian_filers_${startDate}_to_${endDate}_timestamp_${Date.now()}.json`), JSON.stringify(fullData), err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
}

// ==========================Main==========================
async function main() {
    let data = []

    if (testFile) {
        let testData = JSON.parse(fs.readFileSync(testFile))
        startDate = testData.startDate
        endDate = testData.endDate
        data = testData.data
    } else {
        let counter = 0
        let loopContinue = true
        let queryString = queryStringGenerator()
        // Iterates through the pages of a query response to collect all the coverPages into one array to be processed
        while (loopContinue) {
            // Returns {data: data, loopContinue: loopContinue }
            let queryResponse = await queryCoverPages(queryString, counter)

            // Collecting all cover pages into one array
            for (let coverPage of queryResponse.data) {
                data.push(coverPage)
            }

            loopContinue = queryResponse.loopContinue
            counter += 50
        }
    }

    let CIKObject = processDataIntoCIKObject(data)
    let CSVString = processCIKObjectIntoCSVString(CIKObject)

    saveCanadian13FFilersAsCSV(CSVString)

    if (!testFile) {
        saveFilingDataAsJSON(data)
    }
    console.log(`Made ${APICounter} API calls.`)
}
main()




