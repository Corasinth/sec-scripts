# sec-scripts

## Description 
Some scripts to assist with gathering and organizing SEC filing data.


## Table of Contents

* [Installation and Usage](#installation-and-usage)
    * [sql-command-generator](#sql-command-generator)
    * [sec-to-csv](#sec-to-csv)
* [Contributing](#contributing)    

## Installation and Usage

### sql-command-generator

To install `sql-command-generator.ahk`, you need to first install [AutoHotKeyScript v2](https://www.autohotkey.com/). 

Then click the green `Code` button on this repository and download it as a zip file. Unpack it, run `sql-command-generator.ahk`, follow the dialogue prompts, and the SQL command will be copied to your clipboard. 

You can change the default value for the name of the main database table by opening the `sql-command-generator.ahk` file with a text editor like Notepad and changing the `databaseFileName` variable. Simply change the text in the quotes next to the variable, save, and the next time you run the `sql-command-generator.ahk` script the default text should have changed.

### sec-to-csv

This script is installed in the same manner as `sql-command-generator.ahk`. Once installed, copy form 13F-HR to your clipboard, run the script, and save the file when the appropriate dialogue box appears. Forms other than 13F-HR are unlikely to work as intended. The script uses semi-colons as delimiters for the `.csv` file.

## Contributing

Contributions to this repository are welcome. 

--- 
