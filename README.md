# sec-scripts

## Description 
Some scripts to assist with gathering and organizing SEC filing data.


## Table of Contents

* [Installation and Usage](#installation-and-usage)
    * [Script: sql-command-generator](#script-sql-command-generator)
    * [Script: sec-to-csv](#script-sec-to-csv)
    * [Script: form13F.js](#script-form13F.js)
* [Contributing](#contributing)    

## Installation and Usage

### Script: sql-command-generator

To use `sql-command-generator.ahk`, you need to first install [AutoHotKeyScript v2](https://www.autohotkey.com/). 

Then click the green `Code` button on this repository and download it as a zip file. Unpack it, run `sql-command-generator.ahk`, follow the dialogue prompts, and the SQL command will be copied to your clipboard. 

You can change the default value for the name of the main database table by opening the `sql-command-generator.ahk` file with a text editor like Notepad and changing the `databaseFileName` variable. Simply change the text in the quotes next to the variable, save, and the next time you run the `sql-command-generator.ahk` script the default text should have changed.

### Script: sec-to-csv

This script also requires the installation of [AutoHotKeyScript v2](https://www.autohotkey.com/). Once installed, copy form 13F-HR to your clipboard, run the script, and save the file when the appropriate dialogue box appears. Forms other than 13F-HR are unlikely to work as intended. The script uses semi-colons as delimiters for the `.csv` file, since some numbers come with commas.

### Script: form13F.js

To run this script, you need to first install [Node](https://nodejs.org/en/download). Then, download and extract this zipfile. 

Open a terminal window in the folder that contains this script. You can do that by opening any terminal, like Powershell or Command Prompt, and navigating to this folder using the `cd` command. For example, you can type `cd ~/Desktop` and press enter to navigate to your Desktop folder. You can then use `cd ./FOLDERNAME` to navigate to a specific folder, or `cd ../` to go to the folder your current folder is in. You can also use Tab to autocomplete folder names, and the `ls` command to verify you are in the correct place.

Once you have a terminal window open in the folder containing this script, enter `npm install` to install necessary modules. 

You can then run this script by entering the command `node form13F.js ########## ##########`, where the `##########`'s stand in for the CIK numbers of the companies whose 13F-HR forms you want. The script will then save the relevant `.csv` files onto your Desktop in a folder called `sec_csv`. By default, the query returns the last four filings of form 13F-HR, though it may return fewer if fewer than four filings for the company exist.

Because this script uses a free, but limited service, it can only make a limited number of queries. Each CIK number you enter uses one query, and while the script can take as many CIK numbers as you wish, it will be unable to complete more than 100 queries per free API key. 

You will need an API key from [the website providing this API service](https://sec-api.io/pricing). It should be placed in a file named `.env` in the same folder as this `.js` script, as so:
```
API_KEY = "Paste Key Here"
```

## Contributing

Contributions to this repository are welcome. 

--- 
