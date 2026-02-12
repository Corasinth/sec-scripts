#Requires AutoHotkey v2.0
#SingleInstance Force

; This is the name of the main table 
; You can change it to change the default entry in the dialogue box that pops up asking for the main database name
databaseFileName := "FULL_LIST_becca_2"

; This is the sql command as taken from LibreBase
; Anytime {1} appears it is a placeholder for the database file name
; Anytimes {2} appears it is a placeholder for the SEC table name
sqlcommandTemplate := 'SELECT "{1}"."ISSUER", "{1}"."CUSIP", "{2}"."VALUE", "{2}"."SHARES", "{1}"."WP", "{1}"."AFSC", "{1}"."UN", "{1}"."WBW", "{1}"."DBIO", "{1}"."PALESTINE", "{1}"."SYRIAN_GOLAN", "{1}"."MILITARY", "{1}"."SECURITY", "{1}"."CONSTRUCTION", "{1}"."SETTLEMENTS", "{1}"."FINANCE", "{1}"."NAT_RESOURCES", "{1}"."SURVEILLANCE" FROM "{2}", "{1}" WHERE "{2}"."CUSIP" = "{1}"."CUSIP"'

; Creates a dialogue box to input the database table name
databaseInputBox := InputBox("Please input the name of the main database table", "SQL Command Generator", "", databaseFileName)

; Creates a dialogue box to input the SEC filing table name
secInputBox := InputBox("Please input the name of the new table", "SQL Command Generator")

; Formats the SQL command with the correct table names
sqlCommand := Format(sqlcommandTemplate, databaseInputBox.Value, secInputBox.Value)

; Copies command to clipboard and creates notification
A_Clipboard := sqlCommand
ToolTip("Copied!", 0, 0)
Sleep(5000)
ToolTip("", 0, 0)
ExitApp()